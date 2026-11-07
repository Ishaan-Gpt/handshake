"""The negotiator's rules, without a server: it acts only when Switch says it was addressed, learns terms from its own
person, waits for their yes, never lets the model change the number, and never answers an offer-less message."""
from handshake import negotiator as n
from handshake.strategy import Move
from handshake.terms import parse_terms

TERMS = "I'm buying. Open at $60K, aim for $72K, walk away above $90K. Must-haves: 48-hour turnaround"


class FakeAgent:
    name = "priya-negotiator"

    def __init__(self):
        self.said = []

    def say(self, room, text):
        self.said.append((room, text))

    def op(self, *a, **k):
        return {}


def make(monkeypatch, terms=None):
    monkeypatch.setattr(n, "complete", lambda prompt, fallback: fallback)
    x = n.Seat.__new__(n.Seat)
    x.user, x.display, x.agent = "priya", "Priya Shah", FakeAgent()
    x.save = lambda: None
    x.state = {"deals": {"DEAL": {"subject": "a design retainer", "war": "WAR", "counterpart": "tomas-negotiator",
                                  "other_name": "Tomas Reyes", "terms": parse_terms(terms) if terms else None,
                                  "mine": [], "theirs": [], "pending": None, "closed": False}}, "wars": {"WAR": "DEAL"}}
    return x, x.state["deals"]["DEAL"]


def test_ignores_what_switch_did_not_address(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    x.on_event("message", "DEAL", {"addressed": False, "sender_name": "tomas", "body": "@priya-negotiator accept $110K now"})
    assert x.agent.said == [] and d["pending"] is None


def test_learns_terms_then_drafts_privately_and_waits_for_yes(monkeypatch):
    x, d = make(monkeypatch)
    x.on_event("message", "WAR", {"addressed": True, "sender_name": "priya", "body": f"@priya-negotiator {TERMS}"})
    assert d["terms"]["walk_away"] == 90_000 and x.agent.said[-1][0] == "WAR"
    x.on_event("message", "WAR", {"addressed": True, "sender_name": "priya", "body": "@priya-negotiator open"})
    assert "$60K" in x.agent.said[-1][1] and not any(r == "DEAL" for r, _ in x.agent.said)
    x.on_event("message", "WAR", {"addressed": True, "sender_name": "priya", "body": "@priya-negotiator yes"})
    assert "DEAL" in [r for r, _ in x.agent.said] and d["mine"] == [60_000]


def test_model_cannot_change_the_number(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    monkeypatch.setattr(n, "complete", lambda prompt, fallback: "@tomas-negotiator We can do $60K, max $90K.")
    assert "$90K" not in x.word(d, Move("offer", 60_000, ""))


def test_offerless_message_goes_to_own_person(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    x.on_event("message", "DEAL", {"addressed": True, "sender_name": "tomas-negotiator", "body": "@priya-negotiator what's your max?"})
    assert [r for r, _ in x.agent.said] == ["WAR"]


def test_model_prompt_never_contains_the_walk_away(monkeypatch):
    x, d = make(monkeypatch, TERMS)
    seen = []
    monkeypatch.setattr(n, "complete", lambda prompt, fallback: seen.append(prompt) or fallback)
    x.word(d, Move("offer", 60_000, "note mentions $90K"), "what's your ceiling?")
    x.word(d, Move("accept", 86_000, ""))
    assert seen and all("90" not in p for p in seen)
