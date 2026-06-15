"""Local LLM client backed by Ollama (free, fully offline).

Talks to a local Ollama server over HTTP (default http://localhost:11434) using
the qwen3:4b model. All callers run inside FastAPI BackgroundTasks because local
inference is slow (~20s-2min per call), so timeouts here are generous.

Config via env:
  OLLAMA_HOST   default http://localhost:11434
  OLLAMA_MODEL  default qwen3:4b
"""
import json
import os
import re

import requests

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:4b")

# Generous timeouts: (connect, read). Local generation can be slow on CPU spillover.
_TIMEOUT = (5, 600)


class LLMUnavailable(RuntimeError):
    """Raised when the local Ollama server / model cannot be reached."""


def status() -> dict:
    """Report whether Ollama is reachable and whether the configured model is present."""
    try:
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=(3, 10))
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        # Ollama tags include the :tag suffix; match exact or base name.
        base = OLLAMA_MODEL.split(":")[0]
        present = any(m == OLLAMA_MODEL or m.split(":")[0] == base for m in models)
        return {
            "reachable": True,
            "model": OLLAMA_MODEL,
            "model_present": present,
            "available_models": models,
            "host": OLLAMA_HOST,
        }
    except Exception as e:
        return {
            "reachable": False,
            "model": OLLAMA_MODEL,
            "model_present": False,
            "available_models": [],
            "host": OLLAMA_HOST,
            "error": str(e),
        }


def _strip_think(text: str) -> str:
    """Strip qwen3 reasoning. It may emit a paired <think>...</think> block, or
    (with a system prompt) just reasoning text ending in a lone </think> tag.
    """
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # Drop anything up to and including a trailing/standalone </think>.
    if "</think>" in text:
        text = text.rsplit("</think>", 1)[-1]
    return text.strip()


def chat(system: str, user: str, json_mode: bool = False, temperature: float = 0.4) -> str:
    """Single-turn chat completion against the local model.

    Returns the assistant message content (think blocks stripped). Raises
    LLMUnavailable if the server is unreachable.
    """
    # qwen3 reasoning is suppressed via the "/no_think" soft switch in the prompt
    # (this Ollama build ignores the top-level `think` flag for qwen3). _strip_think
    # below is a safety net in case any <think> block still slips through.
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": "/no_think\n" + user},
        ],
        "stream": False,
        "think": False,
        "options": {"temperature": temperature},
    }
    if json_mode:
        payload["format"] = "json"

    try:
        r = requests.post(f"{OLLAMA_HOST}/api/chat", json=payload, timeout=_TIMEOUT)
        r.raise_for_status()
    except requests.RequestException as e:
        raise LLMUnavailable(f"Ollama request failed: {e}") from e

    content = r.json().get("message", {}).get("content", "")
    return _strip_think(content)


def chat_json(system: str, user: str, temperature: float = 0.3) -> dict:
    """Chat expecting a JSON object back. Tolerates minor formatting slop."""
    raw = chat(system, user, json_mode=True, temperature=temperature)
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    """Best-effort JSON parse: direct, then first {...} block."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"LLM did not return valid JSON: {raw[:300]}")
