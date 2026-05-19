# -*- coding: utf-8 -*-
"""CleanupJob: purges old execution and audit log rows from the database.

Add this job via the scheduler UI like any other job.
Configure the two arguments to control how many days of history to keep.
Set either argument to 0 to skip purging that table.

Example: schedule daily at 03:00 with arguments [90, 30]
  -> keeps last 90 days of executions, last 30 days of audit logs.
"""

import logging

from ndscheduler import job
from ndscheduler import utils

logger = logging.getLogger(__name__)


class CleanupJob(job.JobBase):

    @classmethod
    def meta_info(cls):
        return {
            'job_class_string': '%s.%s' % (cls.__module__, cls.__name__),
            'notes': ('Purges old rows from scheduler_execution and scheduler_jobauditlog tables. '
                      'Schedule daily (e.g. 03:00) to keep the SQLite DB from growing indefinitely.'),
            'arguments': [
                {
                    'type': 'int',
                    'description': 'Executions retention days (0 = skip)',
                },
                {
                    'type': 'int',
                    'description': 'Audit logs retention days (0 = skip)',
                },
            ],
            'example_arguments': '[90, 30]',
        }

    def run(self, executions_retention_days=90, audit_logs_retention_days=30, *args, **kwargs):
        executions_retention_days = int(executions_retention_days)
        audit_logs_retention_days = int(audit_logs_retention_days)

        datastore = utils.get_datastore_instance()
        results = {}

        if executions_retention_days:
            before = self._count_executions(datastore)
            datastore.purge_old_executions(executions_retention_days)
            after = self._count_executions(datastore)
            deleted = before - after
            logger.info('CleanupJob: purged %d execution row(s) older than %d days.',
                        deleted, executions_retention_days)
            results['executions_deleted'] = deleted
        else:
            results['executions_deleted'] = 'skipped'

        if audit_logs_retention_days:
            before = self._count_audit_logs(datastore)
            datastore.purge_old_audit_logs(audit_logs_retention_days)
            after = self._count_audit_logs(datastore)
            deleted = before - after
            logger.info('CleanupJob: purged %d audit log row(s) older than %d days.',
                        deleted, audit_logs_retention_days)
            results['audit_logs_deleted'] = deleted
        else:
            results['audit_logs_deleted'] = 'skipped'

        return results

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _count_executions(datastore):
        from ndscheduler.core.datastore import tables
        from sqlalchemy import select, func
        result = datastore.engine.execute(
            select([func.count()]).select_from(tables.EXECUTIONS))
        return result.scalar()

    @staticmethod
    def _count_audit_logs(datastore):
        from ndscheduler.core.datastore import tables
        from sqlalchemy import select, func
        result = datastore.engine.execute(
            select([func.count()]).select_from(tables.AUDIT_LOGS))
        return result.scalar()


if __name__ == '__main__':
    j = CleanupJob.create_test_instance()
    print(j.run(90, 30))

