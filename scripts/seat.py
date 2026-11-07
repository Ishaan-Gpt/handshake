"""Bring your own agent: seat Claude Code, Cursor or any MCP client in one company's chair.

    python scripts/seat.py globex          # or acme

Prints the commands that point your client at Switch's MCP endpoint with that seat's agent key. Your agent then has
Switch's room tools (read_context, post_message, send_targeted_message, create_room_document, ...) as that negotiator,
inside the same walls: it can read its own war room and the deal table, and gets 403 on the other company's room.
Stop the built-in negotiator for that side first (python -m handshake.negotiator <side>), so one agent holds the seat.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(side: str):
    s = json.loads((ROOT / ".state.json").read_text())
    key, deal, war = s[side]["agent_key"], s["rooms"]["deal"], s["rooms"][side]
    url = "http://localhost:8000/mcp/"
    print(f"# Claude Code\nclaude mcp add handshake-{side} --transport http {url} --header \"Authorization: Bearer {key}\"\n")
    print("# Cursor / any MCP client (mcp.json)")
    print(json.dumps({"mcpServers": {f"handshake-{side}": {"url": url, "headers": {"Authorization": f"Bearer {key}"}}}}, indent=2))
    company = {"acme": "Acme Robotics (buyer)", "globex": "Globex Logistics (seller)"}[side]
    print(f"\n# Then tell your agent:\nYou are the negotiator for {company}. Your war room is {war}; the deal table is {deal}. "
          f"Call connect_to_room on your war room, read your playbook with load_internal_documents, read the table with "
          f"read_context, and post offers at the table with post_message after your owner approves them in the war room.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "globex")
