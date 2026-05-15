"""Settings to override default settings."""

import logging
import os

#
# Override settings
#
DEBUG = True

HTTP_PORT = 18888
HTTP_ADDRESS = '0.0.0.0'

#
# Set logging level
#
logging.getLogger().setLevel(logging.DEBUG)

JOB_CLASS_PACKAGES = ['simple_scheduler.jobs']

# SQLite
#
DATABASE_CLASS = 'ndscheduler.core.datastore.providers.sqlite.DatastoreSqlite'
DATABASE_CONFIG_DICT = {
    'file_path': os.path.join(os.path.dirname(os.path.realpath(__file__)), 'dev_data', 'datastore.db')
}

STATIC_DIR_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))),
                               'ndscheduler', 'static')
TEMPLATE_DIR_PATH = STATIC_DIR_PATH
APP_INDEX_PAGE = 'index.html' #:the file name of the single page app's html: