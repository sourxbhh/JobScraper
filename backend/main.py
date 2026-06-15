from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.database import Base, engine, SessionLocal
from models.scrape_config import ScrapeConfig
# Import all model modules so their tables register on create_all().
from models import resume, ai_eval, interview, document, settings  # noqa: F401
from routes import jobs, scraper, analytics, llm, resumes, ai, interview as interview_routes, documents, ats
from services.scheduler import init_scheduler, shutdown_scheduler
from services.ats_scanner import ensure_ats_config


def seed_default_configs():
    """Pre-seed the app with default scrape configurations."""
    db = SessionLocal()
    try:
        if db.query(ScrapeConfig).count() > 0:
            return

        configs = [
            ScrapeConfig(
                name="Data & BI Analyst — Charlotte",
                search_terms=[
                    "data analyst", "business analyst", "BI analyst",
                    "business intelligence analyst", "reporting analyst",
                ],
                sites=["indeed", "linkedin", "glassdoor", "google", "zip_recruiter"],
                locations=["Charlotte, NC"],
                distance=50,
                max_age_hours=72,
                results_per_site=25,
                job_types=["internship", "co-op", "fulltime"],
                include_remote=True,
                schedule="daily",
                is_active=True,
            ),
            ScrapeConfig(
                name="Analytics & Data Engineering",
                search_terms=[
                    "analytics engineer", "data engineer",
                    "ETL developer", "data visualization analyst",
                ],
                sites=["indeed", "linkedin", "glassdoor", "google"],
                locations=["Charlotte, NC"],
                distance=50,
                max_age_hours=168,
                results_per_site=15,
                job_types=["internship", "co-op", "fulltime"],
                include_remote=True,
                schedule="daily",
                is_active=True,
            ),
            ScrapeConfig(
                name="Remote Data Roles",
                search_terms=[
                    "remote data analyst", "remote BI analyst",
                    "remote business intelligence",
                ],
                sites=["indeed", "linkedin", "google"],
                locations=["United States"],
                distance=0,
                max_age_hours=72,
                results_per_site=20,
                job_types=["internship", "co-op", "fulltime"],
                include_remote=True,
                schedule="every 12h",
                is_active=True,
            ),
        ]
        for c in configs:
            db.add(c)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_configs()
    db = SessionLocal()
    try:
        ensure_ats_config(db)  # seed the pseudo-config used to log ATS scan runs
    finally:
        db.close()
    init_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="JobHunt Pro", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(scraper.router)
app.include_router(analytics.router)
app.include_router(llm.router)
app.include_router(resumes.router)
app.include_router(ai.router)
app.include_router(interview_routes.router)
app.include_router(documents.router)
app.include_router(ats.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
