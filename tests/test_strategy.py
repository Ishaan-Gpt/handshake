"""The strategy never crosses a walk-away, and the full Acme x Globex exchange closes where the README says."""
from pathlib import Path

from handshake.strategy import Playbook, next_move

PB = {s: Playbook.parse((Path(__file__).parent.parent / "playbooks" / f"{s}.md").read_text()) for s in ("acme", "globex")}


def test_playbooks_parse():
    assert PB["acme"].role == "buyer" and PB["acme"].walk_away == 2.05
    assert PB["globex"].role == "seller" and PB["globex"].walk_away == 1.85


def test_buyer_never_offers_above_walk_away():
    mine = []
    for _ in range(20):
        m = next_move(PB["acme"], mine, [9.9])
        assert m.price <= PB["acme"].walk_away
        mine.append(m.price)


def test_seller_never_goes_below_walk_away():
    mine = []
    for _ in range(20):
        m = next_move(PB["globex"], mine, [0.1])
        assert m.price >= PB["globex"].walk_away
        mine.append(m.price)


def test_full_exchange_closes_at_1_95():
    acme, globex, turn = [], [], "acme"
    for _ in range(20):
        me, them, pb = (acme, globex, PB["acme"]) if turn == "acme" else (globex, acme, PB["globex"])
        m = next_move(pb, me, them)
        if m.kind == "accept":
            assert m.price == 1.95 and turn == "globex"
            return
        me.append(m.price)
        turn = "globex" if turn == "acme" else "acme"
    raise AssertionError("no deal")


def test_money_is_rounded():
    # 2.10 - 0.15 is 1.9500000000000002 in floats; the seller must still accept a buyer's 1.95.
    assert next_move(PB["globex"], [2.40, 2.25, 2.10], [1.50, 1.65, 1.80, 1.95]).kind == "accept"
