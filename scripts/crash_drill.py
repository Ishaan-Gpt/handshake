"""Proof under failure: kill Acme's negotiator in the middle of the deal, start it again, and the deal still closes.

    python scripts/crash_drill.py

Starts both negotiators itself (fresh deal), lets Asha and Gil approve two rounds, kills Acme's process while Globex's
counter-offer is on its way, waits 10 seconds, restarts it, and lets the deal finish. Acme's agent resumes from the
position and stream cursor it saved, and Switch replays the messages it missed while it was down.
"""
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts import drive  # noqa: E402

PY = sys.executable
ENV = {**os.environ, "PYTHONUNBUFFERED": "1", "HANDSHAKE_BRAIN": os.environ.get("HANDSHAKE_BRAIN", "plain")}


def start(side, log):
    return subprocess.Popen([PY, "-m", "handshake.negotiator", side], cwd=ROOT, env=ENV,
                            stdout=open(log, "a", encoding="utf-8"), stderr=subprocess.STDOUT)


def main():
    for f in ROOT.glob(".memory-*.json"):
        f.unlink()
    logs = ROOT / "results"
    logs.mkdir(exist_ok=True)
    for side in ("acme", "globex"):
        (logs / f"crash-{side}.log").write_text("")
    procs = {s: start(s, logs / f"crash-{s}.log") for s in ("acme", "globex")}
    time.sleep(4)

    def killer():
        # Wait until Acme has had two moves approved, then kill it while Globex is answering.
        while (logs / "crash-acme.log").read_text(encoding="utf-8").count("addressed in war by asha: @acme-negotiator yes") < 2:
            time.sleep(0.3)
        time.sleep(0.5)
        procs["acme"].kill()
        t = time.strftime("%H:%M:%S")
        print(f"\n*** {t} killed Acme's negotiator (pid {procs['acme'].pid}) mid-deal; restarting in 10 s ***\n")
        time.sleep(10)
        procs["acme"] = start("acme", logs / "crash-acme.log")
        print(f"*** {time.strftime('%H:%M:%S')} Acme's negotiator is back ***\n")

    threading.Thread(target=killer, daemon=True).start()
    try:
        drive.main()
    finally:
        for p in procs.values():
            p.kill()
    print("\n--- Acme's log ---\n" + (logs / "crash-acme.log").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
