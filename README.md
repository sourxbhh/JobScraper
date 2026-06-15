# JobHunt Pro

A self-hosted, **fully local** job-search command center. It scrapes jobs from major boards and
company ATS systems, scores them against your resume, and uses a **free local LLM** (no API keys,
no cloud, no cost) to deep-evaluate roles, critique your resume, draft cover letters, and prep you
for interviews.

Everything runs on your machine: a **FastAPI + SQLite** backend, a **React + Vite + Tailwind**
frontend, and **Qwen** running locally via **Ollama**.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Setting Up the Local LLM (Ollama + Qwen)](#setting-up-the-local-llm-ollama--qwen)
- [Using the App](#using-the-app)
  - [1. Scrape jobs](#1-scrape-jobs)
  - [2. Direct ATS scanning](#2-direct-ats-scanning)
  - [3. Upload your resume](#3-upload-your-resume)
  - [4. Score your resume against a job](#4-score-your-resume-against-a-job)
  - [5. AI deep-evaluation of a job](#5-ai-deep-evaluation-of-a-job)
  - [6. Generate cover letters & outreach](#6-generate-cover-letters--outreach)
  - [7. Interview prep](#7-interview-prep)
  - [8. Track applications & analytics](#8-track-applications--analytics)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Features

| Feature | Description | Needs LLM? |
|---|---|---|
| **Multi-board scraping** | Pull jobs from Indeed, LinkedIn, Glassdoor, Google, ZipRecruiter (via JobSpy) | No |
| **Direct ATS scanning** | Pull jobs straight from company Greenhouse / Lever / Ashby APIs (more reliable than board scraping) | No |
| **Employer verification** | Check which tracked companies have live ATS endpoints + count analyst roles | No |
| **Scheduling** | Run scrape configs automatically (daily / every 6h / every 12h / cron) | No |
| **Keyword match scoring** | Instant 0–100 relevance score per job | No |
| **Resume upload & scoring** | Upload your Word/PDF resume; get keyword coverage + gaps vs a job | Optional |
| **AI resume critique** | LLM gap analysis + concrete edit suggestions for a specific job | Yes |
| **AI job deep-evaluation** | Role fit, level strategy, comp notes, personalization, red flags | Yes |
| **Cover letter / outreach** | Tailored drafts generated per job from your resume | Yes |
| **Interview story bank** | STAR+Reflection stories — write your own or auto-generate drafts | Optional |
| **Negotiation notes** | Your personal salary/negotiation cheat sheet | No |
| **Analytics** | Dashboards: sources, timeline, top companies, salaries, skills, funnel | No |
| **CSV export** | Export filtered jobs | No |

> The AI features are **100% free and offline** — they run on a local Qwen model via Ollama.
> Nothing is sent to any cloud service and no API key is required.

---

## Architecture

```
┌─────────────────────┐      /api proxy       ┌──────────────────────┐
│  Frontend (React)   │ ───────────────────▶  │  Backend (FastAPI)   │
│  Vite + Tailwind    │   http://localhost     │  Uvicorn :8000       │
│  http://localhost   │        :8000           │                      │
│        :5173        │                        │  • JobSpy scraping   │
└─────────────────────┘                        │  • ATS scanners      │
                                               │  • APScheduler       │
                                               │  • SQLite (SQLAlchemy)│
                                               └──────────┬───────────┘
                                                          │ HTTP
                                                          ▼
                                               ┌──────────────────────┐
                                               │  Ollama  :11434       │
                                               │  model: qwen3:4b      │
                                               └──────────────────────┘
```

- **Backend** — FastAPI on port `8000`, SQLite at `backend/data/jobhunt.db` (auto-created).
- **Frontend** — Vite dev server on port `5173`, proxies `/api` → backend.
- **LLM** — Ollama server on port `11434` serving the `qwen3:4b` model. All LLM calls run as
  background tasks; the UI polls for results.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Python** | 3.10+ | Backend |
| **Node.js** | 18+ | Frontend |
| **Ollama** | latest | For the AI features — [install here](https://ollama.com/download) |
| **Disk** | ~3 GB | For the `qwen3:4b` model |
| **RAM** | 8 GB+ | 16 GB recommended; a GPU (4 GB+ VRAM) makes it noticeably faster |

> You can run the app **without Ollama** — scraping, scoring, tracking, and analytics all work.
> Only the AI features (resume critique, deep-eval, cover letters, story generation) need it.

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/sourxbhh/JobScraper.git
cd JobScraper
```

### 2. Install Ollama and pull the model (for AI features)

```bash
# After installing Ollama from https://ollama.com/download
ollama pull qwen3:4b
```

### 3. Start the app

**Windows:**
```bat
start.bat
```

**macOS / Linux:**
```bash
bash start.sh
```

This creates the Python virtual environment, installs all dependencies (backend + frontend),
starts both servers, and opens the app in your browser.

- Frontend: **http://localhost:5173**
- Backend API docs (Swagger): **http://localhost:8000/docs**

> First launch takes a few minutes while dependencies install. Subsequent launches are fast.

### Manual start (if you prefer)

```bash
# Backend
cd backend
python -m venv venv
# Windows: venv\Scripts\activate    |    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Frontend (in a second terminal)
cd frontend
npm install --legacy-peer-deps
npm run dev
```

---

## Setting Up the Local LLM (Ollama + Qwen)

The AI features talk to a local **Ollama** server. **Qwen** is the model; Ollama is just the
local runtime that serves it.

1. **Install Ollama:** https://ollama.com/download
2. **Pull the model:**
   ```bash
   ollama pull qwen3:4b
   ```
3. **Make sure Ollama is running** (it usually runs as a background service after install; if not,
   run `ollama serve`).
4. In the app, the **sidebar/header LLM indicator** turns **green** when the model is reachable.

**Want a different/lighter model?** Set environment variables before starting the backend:

```bash
# Example: use a smaller, faster model
set OLLAMA_MODEL=qwen2.5:3b        # Windows
export OLLAMA_MODEL=qwen2.5:3b     # macOS/Linux

# Point at a different Ollama host (default http://localhost:11434)
set OLLAMA_HOST=http://localhost:11434
```

Then `ollama pull <that-model>`.

> Local inference on a 4B model is good for **drafts**, not final copy. Expect ~20–90 seconds per
> AI action depending on your hardware. Always review/edit AI output before using it.

---

## Using the App

### 1. Scrape jobs
Go to **Scrape Tasks**. The app ships with sensible default configs (Data/BI Analyst roles in
Charlotte + remote). Click **Run Now** on a config, or create a new one with **New Config**
(search terms, sites, locations, distance, freshness, schedule). New jobs land in **Jobs**.

### 2. Direct ATS scanning
On **Scrape Tasks**, use the **Direct ATS Scan** panel:
- **Run ATS Scan** — pulls jobs straight from company Greenhouse/Lever/Ashby APIs listed in
  `backend/data/portals.yml`. These results are more reliable than board scraping.
- **Verify Employers** — checks which companies have live endpoints and how many analyst roles
  each currently lists.

### 3. Upload your resume
Go to **Resumes** → **Upload Resume**. Supports `.docx`, `.pdf`, `.md`, `.txt`.
Mark one as **Primary** — that resume becomes the CV context for all AI features.

> Tip: tailor your resume in Word for a role, upload it, then score it (next step).

### 4. Score your resume against a job
Open any job → **Resume Match** tab → pick a resume → **Score**.
- **Keyword coverage** appears instantly (which of the job's skills your resume covers).
- **AI fit score + feedback + suggestions** fill in after the local model runs.
- **Matched** (green) and **Gaps/missing** (amber) keywords are listed so you know what to add.

### 5. AI deep-evaluation of a job
Open a job → **AI Evaluation** tab → **Run AI Evaluation**. After ~30–90s you get:
overall fit score, a recommendation (apply / maybe / skip), and blocks for role fit, CV match,
level strategy, compensation, personalization, and red flags.

### 6. Generate cover letters & outreach
Open a job → **Documents** tab → **Cover Letter** or **Outreach Message**. Drafts are generated
from your **primary resume** + the job description and saved to the job.

### 7. Interview prep
Go to **Interview Prep**:
- Write **STAR+Reflection** stories manually, **or** open a job → **Interview** tab →
  **Generate STAR Stories** to auto-draft stories tailored to that role (then edit them).
- Keep a **Negotiation Notes** cheat sheet (salary anchors, counter-offer scripts, etc.).

### 8. Track applications & analytics
- In **Jobs**, set each job's status (new → reviewing → applied → interview → offer / rejected),
  bookmark, hide, or add notes.
- **Analytics** shows sources, jobs over time, top companies, salary distribution, top skills,
  and your application funnel.
- **Export** filtered jobs to CSV from the Jobs page.

---

## Configuration

| What | Where |
|---|---|
| Tracked ATS companies + title filters | `backend/data/portals.yml` |
| Keyword scoring rules | `backend/services/scraper_service.py` (`SKILL_KEYWORDS`, bonuses) |
| LLM prompts | `backend/prompts.py` |
| LLM model / host | env vars `OLLAMA_MODEL`, `OLLAMA_HOST` |
| Default scrape configs | seeded on first run in `backend/main.py` |
| Ports | backend `8000` (uvicorn), frontend `5173` (`frontend/vite.config.ts`) |

**Editing tracked companies:** open `backend/data/portals.yml`. Each company needs a `name` and
either an `api` (Greenhouse) or a `careers_url` (Lever/Ashby). Set `enabled: false` to skip one.
Edit `title_filter.positive` / `title_filter.negative` to match your target roles.

---

## Project Structure

```
JobScraper/
├── start.bat / start.sh         # one-command launchers
├── backend/
│   ├── main.py                  # FastAPI app, router registration, startup seeding
│   ├── requirements.txt
│   ├── data/
│   │   ├── jobhunt.db           # SQLite (auto-created, git-ignored)
│   │   └── portals.yml          # ATS companies + title filters
│   ├── models/                  # SQLAlchemy models (job, resume, ai_eval, interview, ...)
│   ├── routes/                  # API endpoints (jobs, scraper, ats, resumes, ai, ...)
│   ├── services/                # scraper, ats_scanner, llm_service, resume_service, ...
│   └── prompts.py               # LLM prompt templates
└── frontend/
    └── src/
        ├── pages/               # Dashboard, Jobs, JobDetail, Resumes, InterviewPrep, ...
        ├── components/          # CareerPanels, AtsPanel, FilterBar, JobTable, ...
        ├── hooks/               # useJobs, useScraper, useCareer
        └── lib/                 # axios api client, utils
```

---

## Troubleshooting

**LLM indicator is yellow / AI features error.**
- Make sure Ollama is running: `ollama serve` (or restart the Ollama app).
- Make sure the model is pulled: `ollama list` should show `qwen3:4b`.
- Check the host: default is `http://localhost:11434`.

**AI actions are slow.**
- Normal for local inference, especially without a GPU. Try a smaller model
  (`OLLAMA_MODEL=qwen2.5:3b`) and close memory-heavy apps. One AI action runs at a time.

**Backend won't start / `ModuleNotFoundError`.**
- Re-run `start.bat` / `start.sh` (they install deps), or manually
  `pip install -r backend/requirements.txt` inside the venv.

**Scraping returns few/no results.**
- Public boards (LinkedIn/Indeed/Glassdoor) actively block scraping; results are best-effort.
  The **Direct ATS Scan** is the most reliable source.

**Port already in use.**
- Change the backend port (`uvicorn ... --port XXXX`) and the proxy target in
  `frontend/vite.config.ts`.

**Resume upload fails.**
- Only `.docx`, `.pdf`, `.md`, `.txt` are supported, and the file must contain extractable text
  (scanned-image PDFs won't parse).

---

## FAQ

**Does this cost anything?** No. Scraping and the LLM are both free and run locally.

**Is my data sent anywhere?** No. Everything — jobs, resumes, AI generation — stays on your
machine. The local SQLite database is git-ignored so your personal data is never committed.

**Can I run it without a GPU?** Yes; it just runs slower. A 4 GB+ GPU helps a lot.

**Which model should I use?** `qwen3:4b` is the default (good balance). `qwen2.5:3b` is lighter
and faster; a 7B model is higher quality but slower on modest hardware.

**Is this a "spray-and-pray" auto-applier?** No. It never submits applications for you — it helps
you find, evaluate, and prepare. You always make the final call.
