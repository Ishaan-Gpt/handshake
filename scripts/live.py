"""Keeps the live demo alive: a fresh Acme x Globex deal every few minutes, with Asha and Gil approving each move.

    python scripts/live.py            # with both negotiators running
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from handshake.chat import Person  # noqa: E402
from scripts import drive  # noqa: E402

GAP = 240  # seconds between deals


def main():
    asha, gil = Person("acme"), Person("globex")
    while True:
        gil.say("globex-war-room", "@globex-negotiator new deal")  # Globex's agent forgets the last deal too
        time.sleep(3)
        try:
            drive.main()
        except Exception as e:
            print("deal failed:", e)
        time.sleep(GAP)


if __name__ == "__main__":
    main()
