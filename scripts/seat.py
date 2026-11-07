"""Bring your own agent: drive a seat with Claude Code, Cursor or any MCP client instead of our negotiator.

    python scripts/seat.py priya

Prints the config that points your client at Switch's MCP endpoint with that seat's agent key. Your agent then has
Switch's room tools (read_context, post_message, send_targeted_message, create_room_document, ...) as that seat,
inside the same walls: its owner's war rooms and the deal tables, and a 403 anywhere else. Stop our negotiator for
that seat first, so one brain holds it.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from handshake import seats  # noqa: E402

PROMPT = ("You are {name}'s negotiator. Use list_rooms to find your war rooms (only {name} and you) and deal tables. "
          "In a war room, read {name}'s terms with read_context; keep them secret. At a table, read the other side with "
          "read_context, draft each reply in the war room, and post it at the table with post_message only after {name} says yes.")

if __name__ == "__main__":
    user = sys.argv[1]
    seat = seats.load()["seats"][user]
    url, key = "http://localhost:8000/mcp/", seat["agent_key"]
    print(f"# Claude Code\nclaude mcp add handshake-{user} --transport http {url} --header \"Authorization: Bearer {key}\"\n")
    print("# Cursor / any MCP client (mcp.json)")
    print(json.dumps({"mcpServers": {f"handshake-{user}": {"url": url, "headers": {"Authorization": f"Bearer {key}"}}}}, indent=2))
    print("\n# Then tell your agent:\n" + PROMPT.format(name=seat["name"]))
