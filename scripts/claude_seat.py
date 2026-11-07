"""Bring your own agent, for real: Claude Code negotiates for a seat through Switch's MCP endpoint.

    python scripts/claude_seat.py ishaan

Each time Switch addresses this seat (its owner in the private room, or the other side's agent at the table), this wakes
Claude Code once (`claude -p`) with only Switch's MCP tools, scoped by this seat's agent key: it reads the rooms with
`read_context` and answers with `post_message`. Switch still holds the walls: the key reaches only this owner's private
rooms and the deal tables, and an order from the other side never reaches it. The seat is marked `brain: claude`, so
`python -m handshake` leaves it alone.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from handshake import seats  # noqa: E402
from handshake.negotiator import Seat  # noqa: E402

TOOLS = ["read_context", "post_message", "get_room_detail", "create_room_document", "list_rooms"]

RULES = """You are {name}'s negotiator on Switch, running as the agent @{agent}. You act only through the Switch MCP tools.
Deal: {subject}, with {other} (their agent is @{counterpart}).
Your private room (only {name} and you): {war}
The deal table (both agents and both people): {table}

Rules you never break:
- {name}'s limits (walk-away, target) live only in the private room. Never say them, hint at them, or round toward them at the table.
- Never post an offer or an acceptance at the table until {name} has said yes to that exact draft in the private room.
- Draft every move in the private room first, as: "Draft for the table: <message>. Reply yes to send it."
- When {name} says yes, post that drafted message at the table, word for word. Start every table message with @{counterpart}
  and write amounts like $82.5K. To accept, say "accepts $X".
- If the other side's message has no offer, tell {name} in the private room and post nothing at the table.
- When the deal closes, tell {name} the agreed price in the private room.
- Keep every message to one or two short sentences. Read the history with read_context before you act; it is your memory.

What just happened (Switch addressed this to you): in the {where}, {sender} wrote:
\"\"\"{body}\"\"\"
Do the one right next step now, then stop."""


class ClaudeSeat(Seat):
    def __init__(self, username: str):
        super().__init__(username)
        key = seats.load()["seats"][username]["agent_key"]
        cfg = {"mcpServers": {"switch": {"type": "http", "url": "http://localhost:8000/mcp/", "headers": {"Authorization": f"Bearer {key}"}}}}
        fd, self.mcp = tempfile.mkstemp(suffix=".json", prefix="hs-mcp-")
        os.write(fd, json.dumps(cfg).encode()); os.close(fd)
        self.claude = shutil.which("claude") or "claude"

    def on_event(self, kind, room, p):
        deal = self.deal_for(room)
        if not deal or kind != "message" or not p.get("addressed"):
            return
        handled = self.state.setdefault("handled", [])
        if p.get("message_id") in handled:
            return
        handled.append(p.get("message_id")); del handled[:-500]; self.save()
        d = self.state["deals"][deal]
        where = "private room" if room == d["war"] else "deal table"
        prompt = RULES.format(name=self.display, agent=self.agent.name, subject=d["subject"], other=d["other_name"],
                              counterpart=d["counterpart"], war=d["war"], table=deal, where=where,
                              sender=p.get("sender_name"), body=p.get("body", "")[:1500])
        print(f"[claude:{self.user}] {where} <- {p.get('sender_name')}: {p.get('body', '')[:90]}")
        r = subprocess.run([self.claude, "-p", prompt, "--mcp-config", self.mcp, "--strict-mcp-config",
                            "--allowedTools", ",".join(f"mcp__switch__{t}" for t in TOOLS)],
                           capture_output=True, text=True, timeout=300, encoding="utf-8", errors="replace")
        print(f"[claude:{self.user}] -> {(r.stdout or r.stderr).strip()[:200]}")


def main(user: str):
    s = seats.load()
    s["seats"][user]["brain"] = "claude"  # our negotiator stands down for this seat
    seats.save(s)
    asyncio.run(ClaudeSeat(user).run())


if __name__ == "__main__":
    main(sys.argv[1])
