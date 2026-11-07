"""Sets who may make each negotiator act, as its owner, through Switch's addressing policy (run after rooms.py).

  acme-negotiator answers   Asha, anywhere            and globex-negotiator, only in #deal-acme-globex
  globex-negotiator answers Gil, anywhere             and acme-negotiator, only in #deal-acme-globex

Nobody else, and that includes the other company's human: Gil typing "@acme-negotiator accept" is refused by Switch.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from handshake.switch_api import gateway  # noqa: E402
from scripts.bootstrap import SIDES  # noqa: E402

STATE = ROOT / ".state.json"


def rules(deal_room: str, counterpart_agent: str) -> dict:
    return {"policy": {"rules": [
        {"rooms": "*", "room_groups": "*", "users": [], "agents": [], "owner": True},
        {"rooms": [deal_room], "room_groups": "*", "users": [], "agents": [counterpart_agent]},
    ]}}


def main():
    s = json.loads(STATE.read_text())
    for side, other in (("acme", "globex"), ("globex", "acme")):
        g = gateway(SIDES[side]["email"], s[side]["password"])
        r = g.put(f"/gateway/agents/{s[side]['agent_id']}/addressing-policy",
                  json=rules(s["rooms"]["deal"], s[other]["agent_id"]))
        print(side, r.status_code, r.text[:300])


if __name__ == "__main__":
    main()
