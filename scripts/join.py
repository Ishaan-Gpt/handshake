"""Give someone a seat: a chat account and a negotiator agent that belongs to them.

    python scripts/join.py priya "Priya Shah"

Prints how to sign in, and how to run the seat with our negotiator or with your own agent over Switch's MCP.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from handshake import seats  # noqa: E402

if __name__ == "__main__":
    user, name = sys.argv[1], " ".join(sys.argv[2:]) or sys.argv[1].title()
    seat = seats.join(user, name)
    print(f"Seat ready for {name}.\n  Chat: http://localhost:8065  (sign in as {user} / {seat['password']})\n"
          f"  Agent: {seat['agent']}, owned by {name}; only {name} can give it orders.\n"
          f"  Run it with our negotiator: python -m handshake.negotiator {user}\n"
          f"  Or with your own agent:     python scripts/seat.py {user}")
