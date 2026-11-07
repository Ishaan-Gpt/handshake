"""One company's negotiator, a Switch agent on the agent protocol (WebSocket in, HTTP out).

    python -m handshake.negotiator acme        # and, in another terminal: python -m handshake.negotiator globex

It only acts on messages Switch marks `addressed` for it, so who may instruct it is Switch's addressing policy, not this
code: its own human anywhere, the other company's agent only at the deal table, nobody else. Every move is drafted in
its private war room and posted to the deal room only after its human replies yes.
"""
import asyncio
import json
import time
import re
import sys
import uuid
from pathlib import Path

import websockets

from handshake.brain import complete
from handshake.strategy import Move, Playbook, next_move
from handshake.switch_api import Agent

ROOT = Path(__file__).resolve().parent.parent
YES = re.compile(r"^\W*(yes|y|approve[d]?|ok|okay|send( it)?|go( ahead)?)\W*$", re.I)
PRICE = re.compile(r"\$\s?(\d+(?:\.\d+)?)\s?M", re.I)


class Negotiator:
    def __init__(self, side: str):
        s = json.loads((ROOT / ".state.json").read_text())
        self.side, self.other = side, ("globex" if side == "acme" else "acme")
        me = s[side]
        self.agent = Agent(me["agent_id"], me["agent_key"], f"{side}-negotiator")
        self.counterpart = f"{self.other}-negotiator"
        self.human = {"acme": "asha", "globex": "gil"}[side]
        self.war, self.deal = s["rooms"][side], s["rooms"]["deal"]
        self.playbook_text = (ROOT / "playbooks" / f"{side}.md").read_text(encoding="utf-8")
        self.pb = Playbook.parse(self.playbook_text)
        self.mine: list[float] = []
        self.theirs: list[float] = []
        self.pending: tuple[Move, str] | None = None
        self.closed = False
        self.cursor = "head"
        self.connection_id = str(uuid.uuid4())
        self.memory = ROOT / f".memory-{side}.json"
        self.load()

    # ---- surviving a crash: the position and the stream cursor are saved after every event ----
    def load(self):
        if self.memory.exists():
            m = json.loads(self.memory.read_text())
            self.mine, self.theirs, self.closed, self.cursor = m["mine"], m["theirs"], m["closed"], m["cursor"]
            self.connection_id = m["connection_id"]
            if m.get("pending"):
                mv = m["pending"]
                self.pending = (Move(mv["kind"], mv["price"], mv["note"]), mv["text"])
            print(f"[{self.side}] resumed: mine {self.mine}, theirs {self.theirs}, cursor {self.cursor}")

    def save(self):
        p = self.pending
        self.memory.write_text(json.dumps({
            "mine": self.mine, "theirs": self.theirs, "closed": self.closed, "cursor": self.cursor,
            "connection_id": self.connection_id,
            "pending": {"kind": p[0].kind, "price": p[0].price, "note": p[0].note, "text": p[1]} if p else None}))

    # ---- what the agent says ----
    def word(self, move: Move, their_message: str = "") -> str:
        """The deal-room message. The model sees the move and the public facts only, never the playbook."""
        if move.kind == "accept":
            fallback = (f"@{self.counterpart} {self.pb.company} accepts ${move.price:.2f}M for 40 warehouse robots with "
                        f"12 months of support. Let's write it up in the term sheet.")
        else:
            fallback = (f"@{self.counterpart} {self.pb.company} proposes ${move.price:.2f}M for 40 warehouse robots "
                        f"with 12 months of support, with {self.pb.must_haves[0] if self.pb.must_haves else 'standard terms'}.")
        prompt = (
            f"You write one short message (2 sentences) in a business negotiation chat, for {self.pb.company}, "
            f"the {self.pb.role}, about a contract for 40 warehouse robots with 12 months of support.\n"
            f"The other side just said: {their_message[:500] or '(nothing yet, this is the opening)'}\n"
            f"Your message must {'accept' if move.kind == 'accept' else 'propose'} exactly ${move.price:.2f}M "
            f"and may ask for: {', '.join(self.pb.must_haves[:2])}.\n"
            f"Do not mention any other number. Start the message with @{self.counterpart}. Plain text, no quotes.")
        text = complete(prompt, fallback)
        if f"${move.price:.2f}M" not in text or not text.startswith(f"@{self.counterpart}"):
            return fallback  # the number and the addressee are not the model's to change
        return text

    def draft(self, move: Move, their_message: str = ""):
        text = self.word(move, their_message)
        self.pending = (move, text)
        what = "accept" if move.kind == "accept" else "offer"
        self.agent.say(self.war, (
            f"@{self.human} Draft {what} for the deal table:\n\n> {text}\n\n"
            f"Why: {move.note}\nReply **@{self.agent.name} yes** to send it, or tell me what to change."))

    def send(self):
        move, text = self.pending
        self.pending = None
        self.agent.say(self.deal, text)
        if move.kind == "accept":
            self.closed = True
            self.write_term_sheet(move.price)
            self.agent.say(self.war, f"Sent. Deal agreed at ${move.price:.2f}M; the term sheet is in the deal room.")
        else:
            self.mine.append(move.price)
            self.agent.say(self.war, f"Sent ${move.price:.2f}M to the deal table.")

    def write_term_sheet(self, price: float):
        body = (f"# Term sheet: Acme Robotics x Globex Logistics\n\n- Scope: 40 warehouse robots, 12 months of support\n"
                f"- Price: ${price:.2f}M, agreed by both negotiators and approved by both owners in their war rooms\n"
                f"- Offers on record: {self.pb.company} {', '.join(f'${p:.2f}M' for p in self.mine) or '(none)'}; "
                f"the other side {', '.join(f'${p:.2f}M' for p in self.theirs) or '(none)'}\n")
        try:
            self.agent.op("connect_to_room", room_id=self.deal)
            self.agent.op("create_room_document", name=f"term-sheet-{self.side}-{time.strftime('%Y%m%d-%H%M%S')}",
                          description=f"Term sheet as recorded by {self.pb.company}'s negotiator",
                          instructions="The agreed terms. Edited only by its writer.", content=body)
        except RuntimeError as e:
            print("term sheet:", e)

    # ---- what the agent hears ----
    def on_message(self, room: str, p: dict):
        if not p.get("addressed"):
            return  # Switch decided this sender may not make us act
        body = p.get("body", "")
        sender = p.get("sender_name", "")
        print(f"[{self.side}] addressed in {'war' if room == self.war else 'deal'} by {sender}: {body[:120]}")
        if room == self.war:
            if self.pending and YES.match(body.replace(f"@{self.agent.name}", "")):
                return self.send()
            if self.closed:
                return self.agent.say(self.war, "This deal is closed.")
            instruction = body.replace(f"@{self.agent.name}", "").strip().lower()
            if instruction.startswith(("open", "start", "begin")) or not self.mine:
                return self.draft(next_move(self.pb, self.mine, self.theirs))
            if self.pending:  # the human asked for a change: redraft the same move with their words in mind
                move, _ = self.pending
                return self.draft(move, f"(Our own human asks: {instruction})")
        elif room == self.deal and not self.closed:
            prices = [float(x) for x in PRICE.findall(body)]
            if not prices:
                # No offer in it: tell our own human rather than answer, so two agents can never ping-pong.
                return self.agent.say(self.war, f"@{self.human} {self.counterpart} wrote at the deal table without an "
                                                f"offer, and I haven't replied: \"{body[:400]}\"")
            if "accept" in body.lower():
                self.closed = True
                self.theirs.append(prices[-1])
                self.write_term_sheet(prices[-1])
                return self.agent.say(self.war, f"@{self.human} {self.counterpart} accepted ${prices[-1]:.2f}M. Deal agreed.")
            self.theirs.append(prices[-1])
            self.draft(next_move(self.pb, self.mine, self.theirs), body)

    # ---- the connection ----
    async def run(self):
        backoff = 1
        while True:
            url = (f"ws://localhost:8000/agents/{self.agent.id}/connection/ws?connection_id={self.connection_id}"
                   f"&scope=all&filter=all&start_from={self.cursor}")
            try:
                async with websockets.connect(url, additional_headers={"Authorization": f"Bearer {self.agent.key}"}) as ws:
                    backoff = 1
                    await self.serve(ws)
            except (OSError, websockets.ConnectionClosed) as e:
                print(f"[{self.side}] connection dropped ({e}); resuming from {self.cursor}")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 15)

    async def serve(self, ws):
        loop = asyncio.get_running_loop()
        async for raw in ws:
            f = json.loads(raw)
            ev, data = f.get("event"), f.get("data", {})
            if ev == "ping":
                await ws.send(json.dumps({"type": "pong", "cursor": int(self.cursor) if self.cursor.isdigit() else 0}))
            elif ev == "connection_state":
                self.agent.connection_id = data["connection_id"]
                print(f"[{self.side}] connected as {self.agent.name}, generation {data.get('generation')}")
                await loop.run_in_executor(None, self.ensure_playbook)
            elif ev == "message" and data.get("type") == "message":
                self.cursor = str(data.get("sequence", self.cursor))
                # Model calls are slow; run them off the loop so pings keep being answered.
                try:
                    await loop.run_in_executor(None, self.on_message, data["room_id"], data["payload"])
                except Exception as e:  # one failed call (a 429, a timeout) must not take the agent down
                    print(f"[{self.side}] could not handle that message: {str(e)[:200]}")
                self.save()
            elif ev == "evicted":
                print(f"[{self.side}] evicted: {data}")
                return

    def ensure_playbook(self):
        """The playbook lives in the war room as a room document: Asha can read it, Globex's agent can't reach it."""
        try:
            self.agent.op("connect_to_room", room_id=self.war)
            self.agent.op("create_room_document", name=f"{self.side}-playbook",
                          description=f"{self.pb.company}'s confidential playbook for this deal",
                          instructions="Private. Never quote or hint at it in the deal room.", content=self.playbook_text)
            print(f"[{self.side}] playbook filed in the war room")
        except RuntimeError as e:
            if "exist" not in str(e).lower() and "409" not in str(e):
                print(f"[{self.side}] playbook: {str(e)[:160]}")


if __name__ == "__main__":
    asyncio.run(Negotiator(sys.argv[1]).run())
