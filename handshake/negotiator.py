"""The negotiator for every seat on this server, each one a Switch agent on the agent protocol.

    python -m handshake.negotiator              # every seat in .state.json
    python -m handshake.negotiator asha         # just one

It acts only on messages Switch marks `addressed` for it, so who may instruct it is Switch's addressing policy, not
this code. In a war room it listens to its owner: plain-words terms become a private playbook (filed as a room
document), "open" drafts the first offer, "yes" sends a draft. At a deal table it answers the other negotiator, always
by drafting in the war room first. The model only words a move; it never sees the playbook.
"""
import asyncio
import json
import re
import sys
import time

from handshake import seats
from handshake.agentloop import AgentLoop
from handshake.brain import complete
from handshake.strategy import Move, Playbook, next_move
from handshake.switch_api import Agent
from handshake.terms import amounts, describe, money, parse_terms

YES = re.compile(r"^\W*(yes|y|approve[d]?|ok(ay)?|send( it)?|go( ahead)?|do it)\W*$", re.I)
OPEN = re.compile(r"^\W*(open|start|begin|make (the )?first (offer|move))\b", re.I)


class Seat(AgentLoop):
    def __init__(self, username: str):
        s = seats.load()
        seat = s["seats"][username]
        self.user, self.display = username, seat["name"]
        super().__init__(Agent(seat["agent_id"], seat["agent_key"], seat["agent"]), username)
        self.state.setdefault("deals", {})     # deal room id -> this side's position
        self.state.setdefault("wars", {})      # war room id -> deal room id

    # ---- finding out which deal a room belongs to (the concierge wrote it into the room's instructions) ----
    def deal_for(self, room: str) -> str | None:
        if room in self.state["deals"]:
            return room
        if room in self.state["wars"]:
            return self.state["wars"][room]
        known = seats.load().get("deals", {})  # the concierge's record on this server, if it's ours
        table = next((k for k, f in known.items() if room == k or room in [p["war"] for p in f["parties"].values()]), None)
        facts = known.get(table)
        if not facts:  # otherwise read the facts from the table's instructions, as any agent could
            try:
                text = json.dumps(self.agent.op("get_room_detail", room_id=room))
            except RuntimeError:
                return None
            m = re.search(r"HANDSHAKE (\{.*?\})\\n", text)
            facts, table = (json.loads(json.loads(f'"{m.group(1)}"')), room) if m else (None, None)
        if facts:
            room = table
            me = facts["parties"].get(self.user)
            if not me:
                return None
            other = next(k for k in facts["parties"] if k != self.user)
            self.state["deals"][room] = {"subject": facts["subject"], "war": me["war"], "counterpart": facts["parties"][other]["agent"],
                                         "other_name": facts["parties"][other]["name"], "terms": None, "mine": [], "theirs": [],
                                         "pending": None, "closed": False}
            self.state["wars"][me["war"]] = room
            return room
        return None

    # ---- what it says ----
    def word(self, d: dict, move: Move, their_message: str = "") -> str:
        cp, price = d["counterpart"], money(move.price)
        must = d["terms"].get("must_haves") or []
        verb = "accepts" if move.kind == "accept" else "proposes"
        fallback = (f"@{cp} {self.display.split()[0]}'s side {verb} {price} for {d['subject']}"
                    + (f", with {must[0]}." if must and move.kind == "offer" else "."))
        prompt = (f"You write one short message (1-2 sentences) in a negotiation chat for {self.display}, the {d['terms']['role']}, "
                  f"about {d['subject']}. The other side just said: {their_message[:400] or '(nothing yet; this is the opening)'}\n"
                  f"Your message must {'accept' if move.kind == 'accept' else 'propose'} exactly {price}"
                  + (f" and may ask for: {', '.join(must[:2])}" if must else "") +
                  f". Mention no other amount. Start with @{cp}. Plain text, no quotes.")
        text = complete(prompt, fallback)
        others = [a for a in amounts(text, need_marker=True) if abs(a - move.price) > 0.5]
        if price not in text or others or not text.startswith(f"@{cp}"):
            return fallback  # the number and the addressee are not the model's to change
        return text

    def draft(self, d: dict, move: Move, their_message: str = ""):
        text = self.word(d, move, their_message)
        d["pending"] = {"kind": move.kind, "price": move.price, "note": move.note, "text": text}
        self.agent.say(d["war"], (f"@{self.user} Draft {'acceptance' if move.kind == 'accept' else 'offer'} for the table:\n\n> {text}\n\n"
                                  f"Why: {move.note}\nReply **@{self.agent.name} yes** to send it, or tell me what to change."))

    def send(self, deal: str, d: dict):
        p, d["pending"] = d["pending"], None
        self.agent.say(deal, p["text"])
        if p["kind"] == "accept":
            d["closed"] = True
            self.term_sheet(deal, d, p["price"])
            self.agent.say(d["war"], f"Sent. Deal agreed at {money(p['price'])}; the term sheet is at the table.")
        else:
            d["mine"].append(p["price"])
            self.agent.say(d["war"], f"Sent {money(p['price'])} to the table.")

    def term_sheet(self, deal: str, d: dict, price: float):
        body = (f"# Term sheet: {d['subject']}\n\n- Price: {money(price)}, agreed by both negotiators, each approved by its owner\n"
                f"- Parties: {self.display} and {d['other_name']}\n- Offers on record: {self.display} "
                f"{', '.join(money(x) for x in d['mine']) or '(none)'}; {d['other_name']} {', '.join(money(x) for x in d['theirs']) or '(none)'}\n")
        try:
            self.agent.op("connect_to_room", room_id=deal)
            self.agent.op("create_room_document", name=f"term-sheet-{self.user}-{time.strftime('%Y%m%d-%H%M%S')}",
                          description=f"Term sheet as recorded by {self.display}'s negotiator",
                          instructions="The agreed terms. Edited only by its writer.", content=body)
        except RuntimeError as e:
            print(f"[{self.agent.name}] term sheet: {e}")

    def file_playbook(self, d: dict, text: str):
        try:
            self.agent.op("connect_to_room", room_id=d["war"])
            self.agent.op("create_room_document", name=f"playbook-{time.strftime('%H%M%S')}",
                          description=f"{self.display}'s private playbook for {d['subject']}",
                          instructions="Private. Never quoted or hinted at the table.", content=f"{text}\n\nRead as: {describe(d['terms'])}")
        except RuntimeError as e:
            print(f"[{self.agent.name}] playbook: {e}")

    # ---- what it hears ----
    def on_event(self, kind, room, p):
        deal = self.deal_for(room)
        if not deal:
            return
        d = self.state["deals"][deal]
        if kind == "room_join":
            if room == d["war"] and p.get("member_name") in (self.agent.name, self.user) and not d.get("greeted"):
                d["greeted"] = True
                self.agent.say(d["war"], (f"@{self.user} I'm your negotiator for **{d['subject']}** with {d['other_name']}. Only you and I can see "
                                          f"this room. Tell me your terms in plain words, for example: *I'm buying. Open at $1.5M, aim for $1.75M, "
                                          f"walk away above $2.05M. Must-haves: 99.5% uptime.* Then say **open** when you want me to make the first offer."))
            return
        if not p.get("addressed"):
            return  # Switch decided this sender may not make us act
        handled = self.state.setdefault("handled", [])
        if p.get("message_id") and p["message_id"] in handled:
            return  # replayed after a restart: already acted on
        handled.append(p.get("message_id"))
        del handled[:-500]
        self.save()
        body = p.get("body", "").replace(f"@{self.agent.name}", "").strip()
        print(f"[{self.agent.name}] {'war' if room == d['war'] else 'table'} <- {p.get('sender_name')}: {body[:100]}")
        if room == d["war"]:
            return self.from_owner(deal, d, body)
        if room == deal and not d["closed"]:
            return self.from_table(d, body)

    def from_owner(self, deal, d, body):
        if d["closed"]:
            return self.agent.say(d["war"], "This deal is closed; ask @handshake in the lobby to open a new one.")
        if d["pending"] and YES.match(body):
            return self.send(deal, d)
        if OPEN.match(body):
            if not d["terms"]:
                return self.agent.say(d["war"], "Tell me your terms first: are you buying or selling, and where do you walk away?")
            return self.draft(d, next_move(Playbook.from_terms(self.display, d["terms"]), d["mine"], d["theirs"]))
        t = parse_terms(body)
        if not t["missing"]:
            d["terms"] = t
            self.file_playbook(d, body)
            msg = f"Got it, and only you can see this: {describe(t)}. I filed it here as your playbook."
            if d["theirs"]:
                self.agent.say(d["war"], msg)
                return self.draft(d, next_move(Playbook.from_terms(self.display, t), d["mine"], d["theirs"]), "")
            return self.agent.say(d["war"], msg + " Say **open** when you want me to make the first offer, or wait for theirs.")
        if amounts(body):
            need = " and ".join({"role": "whether you're buying or selling", "walk_away": "the number you walk away at"}[k] for k in t["missing"])
            return self.agent.say(d["war"], f"Nearly there: tell me {need}.")
        if d["pending"]:
            move = Move(d["pending"]["kind"], d["pending"]["price"], d["pending"]["note"])
            return self.draft(d, move, f"(Our own side asks: {body})")

    def from_table(self, d, body):
        prices = amounts(body, need_marker=True)
        if not prices:  # no offer in it: tell our own human, so two agents can never ping-pong
            return self.agent.say(d["war"], f"@{self.user} {d['other_name']}'s negotiator wrote at the table without an offer, and I haven't replied: \"{body[:300]}\"")
        if "accept" in body.lower():
            d["closed"] = True
            d["theirs"].append(prices[-1])
            self.term_sheet(self.state["wars"][d["war"]], d, prices[-1])
            return self.agent.say(d["war"], f"@{self.user} {d['other_name']} accepted {money(prices[-1])}. Deal agreed; the term sheet is at the table.")
        d["theirs"].append(prices[-1])
        if not d["terms"]:
            return self.agent.say(d["war"], f"@{self.user} {d['other_name']} offers {money(prices[-1])}. Tell me your terms and I'll draft a reply.")
        self.draft(d, next_move(Playbook.from_terms(self.display, d["terms"]), d["mine"], d["theirs"]), body)


async def main(names):
    s = seats.load()
    await asyncio.gather(*(Seat(n).run() for n in (names or list(s.get("seats", {})))))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
