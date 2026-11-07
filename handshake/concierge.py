"""The concierge: anyone with a seat asks it, in #handshake-lobby, to open a deal with anyone else about anything.

    @handshake open a deal with @gil about 40 warehouse robots with a year of support

It builds the deal in Switch: a shared table (both people, both negotiators, the concierge) and a private war room for
each side (that person and their negotiator only; the concierge leaves it), links each war room to the table, files
them in a room group, and writes the deal's facts into the table's instructions, where both negotiators read them.
"""
import asyncio
import json
import re
import time

from handshake import seats
from handshake.agentloop import AgentLoop
from handshake.switch_api import Agent

OPEN = re.compile(r"open (?:a )?deal with @?([a-z0-9._-]+)(?: about (.+))?", re.I)
DEALS = re.compile(r"\b(deals|my deals|status|list)\b", re.I)
WHO = re.compile(r"\b(who|seats|people)\b", re.I)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:28].strip("-") or "deal"


class Concierge(AgentLoop):
    def __init__(self):
        c = seats.ensure_concierge()
        super().__init__(Agent(c["agent_id"], c["agent_key"], "handshake"), "concierge")

    def on_connected(self):
        s = seats.load()
        if "lobby" not in s:
            users = list(s.get("seats", {}))
            r = self.agent.op("create_room", name="handshake-lobby", description="Open a deal: @handshake open a deal with @someone about something",
                              agent_names=["handshake"], user_names=users, channel_type="channel_public", bridge_id=s["bridge_id"],
                              instructions="The Handshake lobby. Ask @handshake to open a deal with anyone who has a seat.",
                              read_visibility="public", write_visibility="public")
            s["lobby"] = r.get("room_id") or r.get("id")
            seats.save(s)
            self.agent.say(s["lobby"], "Open a deal with anyone here: **@handshake open a deal with @name about what you're agreeing**. "
                                       "Each of you gets a private room only you and your own agent can enter, and you meet at a shared table.")

    def on_event(self, kind, room, p):
        if kind != "message" or not p.get("addressed"):
            return
        # A replayed event (after a restart or a takeover) must never open a second deal.
        handled = self.state.setdefault("handled", [])
        if p.get("message_id") in handled:
            return
        handled.append(p.get("message_id"))
        del handled[:-500]
        self.save()
        s = seats.load()
        me = p.get("sender_name", "")
        m = OPEN.search(p.get("body", ""))
        if not m and DEALS.search(p.get("body", "")):
            mine = [(k, f) for k, f in s.get("deals", {}).items() if me in f["parties"]]
            if not mine:
                return self.agent.say(room, f"@{me} You have no deals yet. Open one: **@handshake open a deal with @name about something**.")
            lines = [f"- **{f['subject']}** with " + ", ".join(v["name"] for u, v in f["parties"].items() if u != me) for k, f in mine[-8:]]
            return self.agent.say(room, f"@{me} Your deals ({len(mine)}), newest last; each has a table and your private room:\n" + "\n".join(lines))
        if not m and WHO.search(p.get("body", "")):
            people = ", ".join(f"@{u} ({v['name']})" for u, v in s.get("seats", {}).items())
            return self.agent.say(room, f"@{me} People with a seat here: {people}.")
        if not m:
            return self.agent.say(room, f"@{me} Ask me like this: **@handshake open a deal with @name about what you're agreeing**. "
                                        f"I also answer **deals** (your deals) and **who** (people with a seat).")
        other, subject = m.group(1).lower(), (m.group(2) or "a deal").strip().rstrip(".")
        if me not in s.get("seats", {}):
            return self.agent.say(room, f"@{me} You need a seat first (python scripts/join.py {me} \"Your Name\").")
        if other not in s["seats"] or other == me:
            return self.agent.say(room, f"@{me} @{other} doesn't have a seat yet; once they join I can open it.")
        self.open_deal(s, me, other, subject, room)

    def open_deal(self, s, a, b, subject, lobby):
        tag = f"{slug(subject)}-{time.strftime('%H%M%S')}"
        A, B = s["seats"][a], s["seats"][b]
        group = f"Deal {tag}"  # one group per deal, so the name is unique
        try:
            self.agent.op("create_room_group", name=group, description=f"{A['name']} and {B['name']}: {subject}")
        except RuntimeError as e:
            print(f"[handshake] group: {str(e)[:120]}")
        wars = {}
        for who, seat in ((a, A), (b, B)):
            r = self.agent.op("create_room", name=f"{tag}-{who}", description=f"{seat['name']}'s private war room: {subject}",
                              agent_names=[seat["agent"]], user_names=[who], channel_type="channel_private", bridge_id=s["bridge_id"],
                              group_name=group, read_visibility="private",
                              instructions=(f"HANDSHAKE-WAR {{\"owner\": \"{who}\"}}\n{seat['name']}'s private war room. Only {seat['name']} and "
                                            f"their negotiator are here. Tell the negotiator your terms in plain words; it drafts every move "
                                            f"here and waits for your yes."))
            wars[who] = r.get("room_id") or r.get("id")
        facts = {"subject": subject, "parties": {a: {"name": A["name"], "agent": A["agent"], "war": wars[a]},
                                                 b: {"name": B["name"], "agent": B["agent"], "war": wars[b]}}}
        r = self.agent.op("create_room", name=f"deal-{tag}", description=f"{A['name']} x {B['name']}: {subject}",
                          agent_names=["handshake", A["agent"], B["agent"]], user_names=[a, b], channel_type="channel_public",
                          bridge_id=s["bridge_id"], group_name=group, read_visibility="public", write_visibility="public",
                          instructions=(f"HANDSHAKE {json.dumps(facts)}\nThe deal table for {subject}. Each negotiator speaks only for its "
                                        f"own side and posts a number only after its owner approves it in their war room."))
        deal = r.get("room_id") or r.get("id")
        for who in (a, b):
            self.agent.op("link_rooms", source_room_id=wars[who], target_room_id=deal, label="deal table")
            try:  # the concierge never stays in anyone's war room
                self.agent.op("remove_agent_from_room", room_id=wars[who], agent_name="handshake")
            except RuntimeError:
                pass
        s = seats.load()
        s.setdefault("deals", {})[deal] = facts
        seats.save(s)
        self.agent.say(deal, f"Table open for **{subject}**: @{a} and @{b}, your negotiators are here. Each of you has a private "
                             f"war room nobody else can enter; give your negotiator your terms there.")
        self.agent.say(lobby, f"Opened the deal on **{subject}** for @{a} and @{b}: a shared table and a private room each.")
        print(f"[handshake] opened {tag}: table {deal}")


if __name__ == "__main__":
    asyncio.run(Concierge().run())
