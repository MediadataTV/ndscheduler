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
All sub-processes run sequentially; only the return code is captured (no stdout/stderr
buffering so there is no risk of blocking or memory pressure in production).
"""

from __future__ import absolute_import

import json
import logging

from subprocess import call

from ndscheduler import job
from ndscheduler.core import scheduler_manager
from ndscheduler import constants

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
        """Execute base_args + per-key extra args for every key in multi_config.

        :param list base_args: Base command token list.
        :param dict multi_config: Maps config key name to list of extra arg strings.
        :return: Dict mapping each key to its return code.
        :rtype: dict
        """
        results = {}

        if not isinstance(base_args, (list, tuple)):
            raise ValueError('base_args must be a JSON array of strings')

        if not isinstance(multi_config, dict):
            raise ValueError('multi_config must be a JSON object')

        datastore = None
        try:
            scheduler = scheduler_manager.SchedulerManager.get_instance()
            datastore = scheduler.get_datastore()
        except Exception:
            # If we cannot reach the datastore for audit logging, continue anyway
            logger.warning('ShellMultiJob: could not get datastore for audit logging')

        for key, extra_args in multi_config.items():
            if not isinstance(extra_args, (list, tuple)):
                logger.warning('ShellMultiJob: skipping key %r — value is not a list', key)
                results[key] = {'returncode': -1, 'error': 'value must be a list of strings'}
                continue

            cmd = list(base_args) + list(extra_args)

            logger.info('ShellMultiJob [%s]: running %r', key, cmd)

            # Log the per-key dispatch to the audit log so each variant is traceable
            if datastore and self.job_id:
                try:
                    datastore.add_audit_log(
                        self.job_id,
                        'ShellMultiJob',
                        constants.AUDIT_LOG_CUSTOM_RUN,
                        description='key=%s execution_id=%s cmd=%s' % (
                            key, self.execution_id, json.dumps(cmd)
                        )
                    )
                except Exception as exc:
                    logger.warning('ShellMultiJob: audit log failed for key %r: %s', key, exc)

            try:
                rc = call(cmd)
            except Exception as exc:
                logger.exception('ShellMultiJob [%s] raised an exception: %s', key, exc)
                rc = -1

            results[key] = {'returncode': rc}
            logger.info('ShellMultiJob [%s]: finished with returncode=%d', key, rc)

        return results


if __name__ == '__main__':
    # Quick local smoke-test
    j = ShellMultiJob.create_test_instance()
    result = j.run(
        ['echo', 'hello'],
        {'KEY1': ['world'], 'KEY2': ['python']}
    )
    print(result)


