"""Proof under failure: kill the negotiators in the middle of a deal, start them again, and the deal still closes.

    python scripts/crash_drill.py           # concierge running; stop any negotiator you started yourself

It runs the negotiators itself, plays a fresh demo deal, kills the negotiator process right after the second approval
(while the other side's counter is on its way), waits ten seconds and starts it again. Each seat reopens Switch's
stream from its last handled event, Switch replays what it missed, and the deal finishes.
"""
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts import demo  # noqa: E402

LOG = ROOT / "results" / "crash-negotiator.log"
ENV = {**os.environ, "PYTHONUNBUFFERED": "1", "HANDSHAKE_BRAIN": os.environ.get("HANDSHAKE_BRAIN", "plain")}


def start():
    return subprocess.Popen([sys.executable, "-m", "handshake.negotiator"], cwd=ROOT, env=ENV,
                            stdout=open(LOG, "a", encoding="utf-8"), stderr=subprocess.STDOUT)


def main():
    LOG.parent.mkdir(exist_ok=True)
    LOG.write_text("")
    proc = {"p": start()}
    time.sleep(5)

    def killer():
        while LOG.read_text(encoding="utf-8").count("war <- ") < 4:  # terms twice, then "open", then the first yes
            time.sleep(0.3)
        while LOG.read_text(encoding="utf-8").count(": yes") < 2:
            time.sleep(0.3)
        time.sleep(0.4)
        proc["p"].kill()
        print(f"\n*** {time.strftime('%H:%M:%S')} killed the negotiators (pid {proc['p'].pid}) mid-deal; restarting in 10 s ***\n")
        time.sleep(10)
        proc["p"] = start()
        print(f"*** {time.strftime('%H:%M:%S')} negotiators are back ***\n")

    threading.Thread(target=killer, daemon=True).start()
    sys.argv = [sys.argv[0], "--subject", f"a crash-tested supply contract {time.strftime('%H%M%S')}"]
    try:
        demo.main()
    finally:
        proc["p"].kill()
    print("\n--- negotiator log ---\n" + LOG.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
