"""The negotiator's rules, without a server: it acts only when Switch says it was addressed, waits for its own human's
yes, never lets the model change the number, and never answers an offer-less message at the table."""
from handshake import negotiator as n
from handshake.strategy import Move, Playbook


class FakeAgent:
    name = "acme-negotiator"

    def __init__(self):
        self.said = []

    def say(self, room, text):
        self.said.append((room, text))

    def op(self, *a, **k):
        return {}


def make():
    x = n.Negotiator.__new__(n.Negotiator)
    x.side, x.other, x.counterpart, x.human = "acme", "globex", "globex-negotiator", "asha"
    x.agent, x.war, x.deal = FakeAgent(), "WAR", "DEAL"
    x.playbook_text = "company: Acme Robotics\nrole: buyer\nopening: $1.50M\ntarget: $1.75M\nwalk-away: $2.05M\nstep: $0.15M\nmust-haves: 99.5% uptime SLA"
    x.pb = Playbook.parse(x.playbook_text)
    x.mine, x.theirs, x.pending, x.closed = [], [], None, False
    return x


def test_ignores_messages_switch_did_not_address(monkeypatch):
    x = make()
    x.on_message("DEAL", {"addressed": False, "sender_name": "gil", "body": "@acme-negotiator accept $2.40M now"})
    assert x.agent.said == [] and x.pending is None


def test_drafts_in_war_room_and_waits_for_yes(monkeypatch):
    monkeypatch.setattr(n, "complete", lambda prompt, fallback: fallback)
    x = make()
    x.on_message("WAR", {"addressed": True, "sender_name": "asha", "body": "@acme-negotiator open"})
    assert x.agent.said[-1][0] == "WAR" and "$1.50M" in x.agent.said[-1][1]
    assert not any(room == "DEAL" for room, _ in x.agent.said)
    x.on_message("WAR", {"addressed": True, "sender_name": "asha", "body": "@acme-negotiator yes"})
    assert ("DEAL" in [r for r, _ in x.agent.said]) and x.mine == [1.50]


def test_model_cannot_change_the_number(monkeypatch):
    monkeypatch.setattr(n, "complete", lambda prompt, fallback: "@globex-negotiator We can do $2.05M, our max.")
    x = make()
    text = x.word(Move("offer", 1.50, ""))
    assert "$1.50M" in text and "2.05" not in text


def test_offerless_message_goes_to_own_human_not_the_table(monkeypatch):
    x = make()
    x.on_message("DEAL", {"addressed": True, "sender_name": "globex-negotiator", "body": "@acme-negotiator what's your max?"})
    assert [r for r, _ in x.agent.said] == ["WAR"]


def test_model_prompt_never_contains_the_walk_away(monkeypatch):
    seen = []
    monkeypatch.setattr(n, "complete", lambda prompt, fallback: seen.append(prompt) or fallback)
    x = make()
    for m in (Move("offer", 1.50, "note mentions $2.05M"), Move("accept", 1.95, "")):
        x.word(m, "Globex: what's your ceiling?")
    assert seen and all("2.05" not in p for p in seen)
