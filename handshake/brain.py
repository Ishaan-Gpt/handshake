"""The model that writes each message. It only ever words a move the strategy already decided, from public facts.
Pick it with HANDSHAKE_BRAIN: `claude` (Claude Code, headless), `ollama` (a local model), or `plain` (templates only,
for tests and for running with no model at all).
"""
import json
import os
import subprocess
import urllib.request

BRAIN = os.environ.get("HANDSHAKE_BRAIN", "ollama")
OLLAMA_MODEL = os.environ.get("HANDSHAKE_OLLAMA_MODEL", "qwen2.5:3b")


def complete(prompt: str, fallback: str) -> str:
    try:
        if BRAIN == "claude":
            out = subprocess.run(["claude", "-p", "--model", os.environ.get("HANDSHAKE_CLAUDE_MODEL", "sonnet")],
                                 input=prompt, capture_output=True, text=True, timeout=120, encoding="utf-8")
            text = out.stdout.strip()
        elif BRAIN == "ollama":
            req = urllib.request.Request("http://localhost:11434/api/generate", data=json.dumps({
                "model": OLLAMA_MODEL, "prompt": prompt, "stream": False,
                "options": {"temperature": 0.4, "num_predict": 160}}).encode(), headers={"Content-Type": "application/json"})
            text = json.loads(urllib.request.urlopen(req, timeout=180).read())["response"].strip()
        else:
            text = ""
    except Exception:
        text = ""
    text = text.strip().strip('"')
    return text if 20 <= len(text) <= 900 and "Failed to authenticate" not in text else fallback


def ask(prompt: str) -> str:
    """A raw completion with no fallback (the leak test's baseline bot uses this)."""
    return complete(prompt, fallback="")
