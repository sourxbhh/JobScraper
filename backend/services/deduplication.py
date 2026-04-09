import hashlib


def generate_external_id(job_url: str) -> str:
    """Generate a unique hash from the job URL for deduplication."""
    return hashlib.sha256(job_url.encode("utf-8")).hexdigest()[:16]
