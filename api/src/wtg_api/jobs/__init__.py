"""Scheduled jobs invoked by host cron (see infra/cron/crontab).

Each module exposes `main()` and a `python -m wtg_api.jobs.<name>` entry
point so the cron script can shell into the api container without relying
on an HTTP surface.
"""
