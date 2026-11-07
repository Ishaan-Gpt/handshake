"""Keeps a live demo going: a fresh deal between the two demo seats every few minutes, played through the chat.

    python scripts/live.py            # with the concierge and the negotiators running
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import demo  # noqa: E402

SUBJECTS = ["a one-year design retainer, 20 hours a month", "a six-month data-labelling contract", "a website rebuild, fixed price",
            "a three-year software licence for 200 seats"]

if __name__ == "__main__":
    n = 0
    while True:
        sys.argv = [sys.argv[0], "--subject", f"{SUBJECTS[n % len(SUBJECTS)]} ({time.strftime('%H:%M')})"]
        try:
            demo.main()
        except Exception as e:
            print("deal failed:", e)
        n += 1
        time.sleep(240)
