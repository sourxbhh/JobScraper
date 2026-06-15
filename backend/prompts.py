"""Prompt templates for the local LLM, adapted from career-ops modes/*.md.

Kept tight and structured so a small 4B model returns clean, parseable output.
All builders take a job dict + optional resume/CV text and return (system, user).
"""

_MAX_DESC = 6000   # clip very long JDs to keep the context small for a 4B model
_MAX_CV = 6000


def _clip(s: str | None, n: int) -> str:
    s = (s or "").strip()
    return s[:n]


def _job_block(job) -> str:
    return (
        f"TITLE: {job.title}\n"
        f"COMPANY: {job.company or 'N/A'}\n"
        f"LOCATION: {job.location or 'N/A'}\n"
        f"REMOTE: {bool(job.is_remote)}\n"
        f"JOB DESCRIPTION:\n{_clip(job.description, _MAX_DESC)}"
    )


# ── Resume evaluation (Layer 1) ──────────────────────────────────────────────

def resume_eval(job, resume_text: str):
    system = (
        "You are a pragmatic technical recruiter and resume coach. You compare a "
        "candidate's resume against a specific job and give honest, concrete, actionable "
        "feedback. Be specific; never invent experience the candidate does not have. "
        "Respond ONLY with a JSON object."
    )
    user = (
        f"=== JOB ===\n{_job_block(job)}\n\n"
        f"=== CANDIDATE RESUME ===\n{_clip(resume_text, _MAX_CV)}\n\n"
        "Evaluate fit and return JSON with exactly these keys:\n"
        "{\n"
        '  "fit_score": <integer 0-100, how well this resume matches THIS job>,\n'
        '  "verdict": "<one sentence overall judgement>",\n'
        '  "strengths": ["<resume points that match the job>", ...],\n'
        '  "gaps": ["<job requirements weak or missing in the resume>", ...],\n'
        '  "suggestions": ["<specific edit to make the resume stronger for this job>", ...],\n'
        '  "missing_keywords": ["<important JD keywords absent from the resume>", ...]\n'
        "}\n"
        "Keep each list to at most 6 short items."
    )
    return system, user


# ── AI deep job evaluation A-F (Layer 2) ─────────────────────────────────────

def job_deep_eval(job, cv_text: str):
    system = (
        "You are a senior career strategist evaluating whether a job is worth a "
        "candidate's time and how to position for it. Be concrete and honest. Use the "
        "candidate's CV when provided; do not fabricate. Respond ONLY with a JSON object."
    )
    cv_part = (
        f"\n\n=== CANDIDATE CV ===\n{_clip(cv_text, _MAX_CV)}"
        if cv_text else "\n\n(No candidate CV provided; evaluate the role generally.)"
    )
    user = (
        f"=== JOB ===\n{_job_block(job)}{cv_part}\n\n"
        "Return JSON with exactly these keys:\n"
        "{\n"
        '  "summary": "<2-3 sentence TL;DR of the role and fit>",\n'
        '  "fit_score": <integer 0-100>,\n'
        '  "role_fit": "<how the role aligns with the candidate; archetype/domain/function>",\n'
        '  "cv_match": "<which requirements are met, which are gaps, how to mitigate>",\n'
        '  "level_strategy": "<seniority read and how to position without overclaiming>",\n'
        '  "comp_notes": "<likely compensation range / demand notes; say if unknown>",\n'
        '  "personalization": "<top concrete CV/LinkedIn tweaks to stand out for this role>",\n'
        '  "red_flags": ["<concerns or risks>", ...],\n'
        '  "recommendation": "<apply / maybe / skip, with one-line reason>"\n'
        "}"
    )
    return system, user


# ── Interview STAR+R stories (Layer 3) ───────────────────────────────────────

def interview_stories(job, cv_text: str):
    system = (
        "You are an interview coach. From the candidate's real CV and a target job, draft "
        "STAR+Reflection behavioral stories the candidate can adapt. Ground every story in "
        "the CV; do not invent achievements. Respond ONLY with a JSON object."
    )
    user = (
        f"=== JOB ===\n{_job_block(job)}\n\n"
        f"=== CANDIDATE CV ===\n{_clip(cv_text, _MAX_CV)}\n\n"
        "Draft 3-5 stories. Return JSON:\n"
        "{\n"
        '  "stories": [\n'
        "    {\n"
        '      "title": "<short story title>",\n'
        '      "theme": "<e.g. leadership, conflict, impact, failure>",\n'
        '      "situation": "<...>",\n'
        '      "task": "<...>",\n'
        '      "action": "<...>",\n'
        '      "result": "<quantified if possible>",\n'
        '      "reflection": "<what was learned>",\n'
        '      "best_for": "<types of questions this answers>"\n'
        "    }\n"
        "  ]\n"
        "}"
    )
    return system, user


# ── Cover letter / outreach (Layer 4) ────────────────────────────────────────

def document(job, cv_text: str, doc_type: str):
    if doc_type == "outreach":
        what = (
            "a short, warm LinkedIn outreach message (max ~120 words) to a recruiter or "
            "hiring manager for this role. Friendly, specific, no fluff, clear ask for a chat."
        )
    else:  # cover_letter
        what = (
            "a tailored cover letter (~250-350 words) for this role: a strong opening, 2 short "
            "body paragraphs mapping the candidate's real experience to the job's needs, and a "
            "confident close. Professional, specific, no clichés or invented experience."
        )
    system = (
        "You are an expert career writer. Write only from the candidate's real CV; never "
        "fabricate experience. Output plain text only (no markdown headers, no preamble)."
    )
    user = (
        f"Write {what}\n\n"
        f"=== JOB ===\n{_job_block(job)}\n\n"
        f"=== CANDIDATE CV ===\n{_clip(cv_text, _MAX_CV)}"
    )
    return system, user
