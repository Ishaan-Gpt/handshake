"""Play a whole negotiation between two plain-words playbooks, offline: no Docker, no model, no chat server.

    python scripts/simulate.py                       # the Priya / Tomas retainer from the demo
    python scripts/simulate.py "I'm buying. Open at $1.5M, aim for 1.75M, walk away above $2.05M" \
                               "Selling. Open at $2.4M, I'd like $2.1M, floor $1.85M"

It runs the exact strategy code the negotiators use (handshake/strategy.py), prints each side's private reasoning the
way its own human would see it, and checks two promises: nobody crosses a walk-away and the deal lands inside both
limits. (That the walk-away never leaves the room is a separate test: scripts/leak_test.py, against a live Switch.)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from handshake.strategy import Playbook, deal_report, next_move  # noqa: E402
from handshake.terms import money, parse_terms  # noqa: E402

BUYER = ("I'm buying: we're hiring this agency. Open at $60K, aim for $72K, and walk away above $90K. "
         "Must-haves: 48-hour turnaround; we own the files")
SELLER = "We're selling the retainer. Open at $110K, I'd like $95K, and my floor is $78K. Must-haves: 12-month minimum"


def play(buyer_words: str, seller_words: str, rounds: int = 40) -> dict:
    a = Playbook.from_terms("Buyer", parse_terms(buyer_words))
    b = Playbook.from_terms("Seller", parse_terms(seller_words))
    sides, turn, log = {"Buyer": [], "Seller": []}, "Buyer", []
    for _ in range(rounds):
        me, other, pb = (sides["Buyer"], sides["Seller"], a) if turn == "Buyer" else (sides["Seller"], sides["Buyer"], b)
        move = next_move(pb, me, other)
        said = f"{turn} {'accepts' if move.kind == 'accept' else 'offers'} {money(move.price)}"
        log.append((turn, said, move.note))
        if move.kind == "accept":
            assert b.walk_away <= move.price <= a.walk_away, "deal outside a limit"
            return {"price": move.price, "rounds": len(log), "log": log, "buyer": a, "seller": b}
        assert (move.price <= a.walk_away) if turn == "Buyer" else (move.price >= b.walk_away), "crossed a walk-away"
        me.append(move.price)
        turn = "Seller" if turn == "Buyer" else "Buyer"
    raise SystemExit("no deal inside the limits (the two ranges do not overlap)")


def main(argv: list[str]) -> None:
    buyer_words, seller_words = (argv[1], argv[2]) if len(argv) >= 3 else (BUYER, SELLER)
    out = play(buyer_words, seller_words)
    for _, said, note in out["log"]:
        print(f"table : {said}\n  (private to that side) {note}")
    print(f"\nDEAL at {money(out['price'])} after {out['rounds']} moves")
    print("  buyer sees :", deal_report(out["buyer"], out["price"]))
    print("  seller sees:", deal_report(out["seller"], out["price"]))
    print("checks passed: no walk-away crossed, deal inside both limits")


if __name__ == "__main__":
    main(sys.argv)
