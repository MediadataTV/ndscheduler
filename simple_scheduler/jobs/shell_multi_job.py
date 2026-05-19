# -*- coding: utf-8 -*-
"""A job that runs an executable program once per config key, appending per-key arguments.

pub_args layout (JSON array with two elements):
  [0]  base_args  - list of strings: the base command + fixed arguments
                    e.g. ["bin/console", "md:process", "type=linear"]
  [1]  multi_config - dict: keys map to lists of extra arguments
                    e.g. {"LOOP": ["--channels=1,2", "--notify-to=a@b.com"],
                           "RASTER": ["--channels=3,4", "--notify-to=a@b.com"]}

For each key K the job calls:
    base_args + multi_config[K]
All sub-processes run IN PARALLEL via a thread pool (subprocess.call releases the GIL
while the OS waits, so threads are the right primitive here). Only the return code is
captured — no stdout/stderr buffering so there is no risk of blocking or memory pressure.
"""

from __future__ import absolute_import

import json
import logging
import os
import socket

from subprocess import Popen

from ndscheduler import job
from ndscheduler import constants
from ndscheduler import utils
from ndscheduler.core import scheduler_manager

logger = logging.getLogger(__name__)


class ShellMultiJob(job.JobBase):

    @classmethod
    def meta_info(cls):
        return {
            'job_class_string': '%s.%s' % (cls.__module__, cls.__name__),
            'notes': (
                'Runs an executable with a fixed base command once for each key defined in '
                'Multi Config. For every key the extra arguments listed under that key are '
                'appended to the base command before execution. '
                'Base Args must be a JSON array of strings. '
                'Multi Config must be a JSON object whose values are arrays of strings.'
            ),
            'arguments': [
                {
                    'type': 'array',
                    'description': (
                        'Base command arguments (JSON array), '
                        'e.g. ["/usr/bin/myapp", "--mode", "process"]'
                    )
                },
                {
                    'type': 'object',
                    'description': (
                        'Multi config (JSON object). Each key becomes a separate run; '
                        'its value (array of strings) is appended to the base command.'
                    )
                }
            ],
            'example_arguments': (
                '[["bin/console", "md:process", "type=linear"], '
                '{"LOOP": ["--channels=123,5423", "--notify-to=dev@example.com"], '
                '"RASTER": ["--channels=43,356", "--notify-to=dev@example.com"]}]'
            )
        }

    def run(self, base_args, multi_config, **kwargs):
        """Execute base_args + per-key extra args for every key in multi_config IN PARALLEL.

        All sub-processes are spawned first (Popen returns immediately), then we
        wait for every one of them to finish.  No threads, no thread pool —
        pure OS-level process parallelism.

        One execution log row is written to the datastore per config key so that
        each sub-command is individually visible and traceable in the UI.

        :param list base_args: Base command token list.
        :param dict multi_config: Maps config key name to list of extra arg strings.
        :return: Dict mapping each key to {'returncode': <int>}.
        :rtype: dict
        """
        if not isinstance(base_args, (list, tuple)):
            raise ValueError('base_args must be a JSON array of strings')

        if not isinstance(multi_config, dict):
            raise ValueError('multi_config must be a JSON object')

        # Try to get the datastore; not fatal if unavailable
        datastore = None
        try:
            scheduler = scheduler_manager.SchedulerManager.get_instance()
            datastore = scheduler.get_datastore()
        except Exception:
            logger.warning('ShellMultiJob: could not get datastore for sub-execution logging')

        hostname = socket.gethostname()
        pid = os.getpid()

        # Validate all entries and build the command list up-front
        tasks = {}
        results = {}
        for key, extra_args in multi_config.items():
            if not isinstance(extra_args, (list, tuple)):
                logger.warning('ShellMultiJob: skipping key %r — value is not a list', key)
                results[key] = {'returncode': -1, 'error': 'value must be a list of strings'}
                continue
            tasks[key] = list(base_args) + list(extra_args)

        if not tasks:
            return results

        # --- Phase 1: spawn ALL processes immediately (Popen returns at once) ---
        # For each key we also create a dedicated execution row (RUNNING) so the
        # sub-command appears immediately in the UI with its own traceable entry.
        procs = {}   # key -> (Popen, sub_execution_id)
        for key, cmd in tasks.items():
            logger.info('ShellMultiJob [%s]: spawning %r', key, cmd)

            sub_eid = None
            if datastore and self.job_id:
                sub_eid = utils.generate_uuid()
                description = '[%s] hostname: %s | pid: %s | cmd: %s' % (
                    key, hostname, pid, json.dumps(cmd)
                )
                try:
                    datastore.add_execution(
                        sub_eid,
                        self.job_id,
                        constants.EXECUTION_STATUS_RUNNING,
                        hostname=hostname,
                        pid=pid,
                        description=description,
                        task_id='%s:%s' % (self.execution_id, key)
                    )
                except Exception as exc:
                    logger.warning(
                        'ShellMultiJob [%s]: could not add sub-execution row: %s', key, exc
                    )
                    sub_eid = None

            try:
                proc = Popen(cmd)
            except Exception as exc:
                logger.exception('ShellMultiJob [%s] failed to spawn: %s', key, exc)
                proc = None
                results[key] = {'returncode': -1}
                if datastore and sub_eid:
                    try:
                        datastore.update_execution(
                            sub_eid,
                            state=constants.EXECUTION_STATUS_FAILED,
                            description='[%s] spawn failed: %s' % (key, exc)
                        )
                    except Exception:
                        pass

            if proc is not None:
                procs[key] = (proc, sub_eid)

        # --- Phase 2: wait for every spawned process to finish ---
        for key, (proc, sub_eid) in procs.items():
            try:
                rc = proc.wait()
            except Exception as exc:
                logger.exception('ShellMultiJob [%s] wait() raised: %s', key, exc)
                rc = -1

            results[key] = {'returncode': rc}
            logger.info('ShellMultiJob [%s]: finished with returncode=%d', key, rc)

            if datastore and sub_eid:
                state = (constants.EXECUTION_STATUS_SUCCEEDED
                         if rc == 0
                         else constants.EXECUTION_STATUS_FAILED)
                try:
                    datastore.update_execution(
                        sub_eid,
                        state=state,
                        description='[%s] hostname: %s | pid: %s | returncode: %d' % (
                            key, hostname, pid, rc),
                        result=json.dumps({'returncode': rc})
                    )
                except Exception as exc:
                    logger.warning(
                        'ShellMultiJob [%s]: could not update sub-execution row: %s', key, exc
                    )

        return results


if __name__ == '__main__':
    # Quick local smoke-test
    j = ShellMultiJob.create_test_instance()
    result = j.run(
        ['echo', 'hello'],
        {'KEY1': ['world'], 'KEY2': ['python']}
    )
    print(result)
