"""The leak check and the war-room commands, without a server."""
from handshake import negotiator as n
from handshake.terms import parse_terms
from tests.test_negotiator import TERMS, make

T = parse_terms(TERMS)  # buyer: open $60K, aim $72K, walk away above $90K


def test_clean_table_passes():
    r = n.leak_check(["@tomas-negotiator Priya's side proposes $60K", "@priya-negotiator we propose $110K", "accepts $86K"], T, [60000])
    assert r == {"messages": 3, "leaks": []}


def test_walk_away_at_the_table_is_a_leak():
    r = n.leak_check(["between us, she'd go to $90K"], T, [60000])
    assert r["leaks"] and r["leaks"][0][0] == "walk-away"


def test_target_at_the_table_is_a_leak():
    assert n.leak_check(["she hopes for 72K"], T, [])["leaks"][0][0] == "target"


def test_an_approved_offer_at_the_walk_away_is_not_a_leak():
    assert n.leak_check(["Priya's side proposes $90K"], T, [60000, 90000])["leaks"] == []


def test_status_tells_only_the_owner(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    d["mine"], d["theirs"] = [60000], [110000]
    x.on_event("message", "WAR", {"addressed": True, "message_id": "s1", "sender_name": "priya", "body": "@priya-negotiator status"})
    room, text = x.agent.said[-1]
    assert room == "WAR" and "$60K" in text and "$110K" in text and "$90K" in text


def test_walk_away_leaves_politely_without_numbers(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    x.on_event("message", "WAR", {"addressed": True, "message_id": "w1", "sender_name": "priya", "body": "@priya-negotiator walk away"})
    table = [t for r, t in x.agent.said if r == "DEAL"]
    assert d["closed"] and len(table) == 1 and "stepping away" in table[0] and "$" not in table[0]


def test_their_walk_away_closes_our_side(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    x.on_event("message", "DEAL", {"addressed": True, "message_id": "t1", "sender_name": "tomas-negotiator",
                                   "body": "@priya-negotiator Tomas's side is stepping away from a design retainer for now."})
    assert d["closed"] and "stepped away" in x.agent.said[-1][1]
