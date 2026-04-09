import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.scrape_config import ScrapeConfig

scheduler = BackgroundScheduler()

SCHEDULE_MAP = {
    "every 6h": IntervalTrigger(hours=6),
    "every 12h": IntervalTrigger(hours=12),
    "daily": IntervalTrigger(hours=24),
}


def _run_scrape_sync(config_id: int):
    from services.scraper_service import run_scrape
    db = SessionLocal()
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_scrape(db, config_id))
        loop.close()
    finally:
        db.close()


def schedule_config(config: ScrapeConfig):
    job_id = f"scrape_config_{config.id}"
    # Remove existing job if any
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    if not config.is_active or not config.schedule:
        return

    trigger = SCHEDULE_MAP.get(config.schedule)
    if not trigger and config.schedule.strip():
        # Try as cron expression
        try:
            parts = config.schedule.strip().split()
            if len(parts) == 5:
                trigger = CronTrigger.from_crontab(config.schedule.strip())
        except Exception:
            return

    if trigger:
        scheduler.add_job(
            _run_scrape_sync,
            trigger=trigger,
            id=job_id,
            args=[config.id],
            replace_existing=True,
        )


def init_scheduler():
    db = SessionLocal()
    try:
        configs = db.query(ScrapeConfig).filter(ScrapeConfig.is_active == True).all()
        for config in configs:
            schedule_config(config)
    finally:
        db.close()
    scheduler.start()


def shutdown_scheduler():
    scheduler.shutdown(wait=False)
