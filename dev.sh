#!/bin/bash

virtualenv .venv

. .venv/bin/activate

pip install -r simple_scheduler/requirements.txt

export NDSCHEDULER_SETTINGS_MODULE=simple_scheduler.dev_settings

python simple_scheduler/scheduler.py