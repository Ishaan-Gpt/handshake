"""Builds the deal's rooms in Switch, through each agent's own key (run after bootstrap.py; safe to re-run).

  #acme-war-room      Asha + Acme's agent. Private. Acme's playbook lives here.
  #globex-war-room    Gil + Globex's agent. Private. Globex's playbook lives here.
  #deal-acme-globex   Both people, both agents. The only room both sides share.

Each war room is linked to the deal room ("deal table"), and all three are filed in one room group.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from handshake.switch_api import Agent  # noqa: E402

STATE = ROOT / ".state.json"
DEAL_RULES = (
    "This is a negotiation between Acme Robotics (buyer) and Globex Logistics (seller) over a one-year contract for "
    "40 warehouse robots plus support. Each company's negotiator agent speaks for its own side only and takes "
    "instructions only from its own people. Agents never post a number or a commitment here before their own human "
    "approves it in their war room. The term sheet is kept as a room document."
)


def war_room_rules(company, person):
    return (f"{company}'s private war room. Only {person} and {company}'s negotiator are here. The playbook "
            f"(targets and walk-away terms) is attached here and must never be quoted or hinted at in the deal room. "
            f"The negotiator drafts each move here and waits for {person} to reply 'yes' before posting it.")


def main():
    s = json.loads(STATE.read_text())
    acme = Agent(s["acme"]["agent_id"], s["acme"]["agent_key"], "acme-negotiator")
    globex = Agent(s["globex"]["agent_id"], s["globex"]["agent_key"], "globex-negotiator")
    rooms = s.setdefault("rooms", {})
    common = dict(bridge_id=s["bridge_id"], group_name="Deal: Acme x Globex")
    for agent, group in ((acme, "Deal: Acme x Globex"), (globex, "Deal: Globex x Acme")):
        try:
            agent.op("create_room_group", name=group, description="Rooms for the Acme x Globex robots contract")
        except RuntimeError as e:
            print("group", group, str(e)[:120])

    if "acme" not in rooms:
        r = acme.op("create_room", name="acme-war-room", description="Acme's private war room for the Globex deal",
                    agent_names=["acme-negotiator"], user_names=["asha"], channel_type="channel_private",
                    instructions=war_room_rules("Acme Robotics", "Asha"), read_visibility="private", **common)
        rooms["acme"] = r.get("room_id") or r.get("id") or r
        print("acme war room", rooms["acme"])
    if "globex" not in rooms:
        r = globex.op("create_room", name="globex-war-room", description="Globex's private war room for the Acme deal",
                      agent_names=["globex-negotiator"], user_names=["gil"], channel_type="channel_private",
                      instructions=war_room_rules("Globex Logistics", "Gil"), read_visibility="private",
                      group_name="Deal: Globex x Acme", bridge_id=s["bridge_id"])
        rooms["globex"] = r.get("room_id") or r.get("id") or r
        print("globex war room", rooms["globex"])
    if "deal" not in rooms:
        r = acme.op("create_room", name="deal-acme-globex", description="Acme x Globex: robots contract",
                    agent_names=["acme-negotiator"], user_names=["asha", "gil"], channel_type="channel_public",
                    instructions=DEAL_RULES, read_visibility="public", write_visibility="public", **common)
        rooms["deal"] = r.get("room_id") or r.get("id") or r
        print("deal room", rooms["deal"])
        STATE.write_text(json.dumps(s, indent=1))
    try:
        print("invite globex:", acme.op("invite_agent_to_room", room_id=rooms["deal"], agent_name="globex-negotiator"))
    except RuntimeError as e:
        print("invite globex by acme failed, globex joins itself:", e)
        print(globex.op("invite_agent_to_room", room_id=rooms["deal"], agent_name="globex-negotiator"))
    for agent, side in ((acme, "acme"), (globex, "globex")):
        try:
            print("link", side, agent.op("link_rooms", source_room_id=rooms[side], target_room_id=rooms["deal"], label="deal table"))
        except RuntimeError as e:
            print("link", side, e)
    STATE.write_text(json.dumps(s, indent=1))


if __name__ == "__main__":
    main()
