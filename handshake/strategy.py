"""The negotiating strategy: plain code over the private playbook, so the numbers are decided here, not by a model.

A buyer opens low and climbs by a step; a seller opens high and comes down; neither ever crosses its walk-away.
When the other side's last number is already inside what we'd offer next, we accept it.
"""
from dataclasses import dataclass, field

from handshake.terms import money, round_money


@dataclass
class Playbook:
    party: str
    role: str            # "buyer" or "seller"
    opening: float       # money, in plain units
    target: float
    walk_away: float     # the secret: most a buyer pays, least a seller takes
    step: float
    must_haves: list[str] = field(default_factory=list)

    @classmethod
    def from_terms(cls, party: str, t: dict) -> "Playbook":
        return cls(party, t["role"], t["opening"], t["target"], t["walk_away"], t["step"], t.get("must_haves", []))


@dataclass
class Move:
    kind: str            # "offer" or "accept"
    price: float
    note: str            # private reasoning, shown only to our own human


def deal_report(pb: Playbook, price: float) -> str:
    """One plain line telling our own human how an agreed price sits against their private limits (never sent to the table)."""
    buyer = pb.role == "buyer"
    room = (pb.walk_away - price) if buyer else (price - pb.walk_away)      # >= 0 means inside the limit
    vs_target = (price - pb.target) if buyer else (pb.target - price)       # > 0 means worse than the target
    limit = f"{money(abs(room))} {'inside' if room >= 0 else 'past'} your walk-away"
    if vs_target > 0:
        goal = f"{money(vs_target)} short of your target ({money(pb.target)})"
    elif vs_target < 0:
        goal = f"{money(abs(vs_target))} better than your target ({money(pb.target)})"
    else:
        goal = f"exactly your target ({money(pb.target)})"
    return f"{money(price)} is {limit} and {goal}."


def next_move(pb: Playbook, mine: list[float], theirs: list[float]) -> Move:
    buyer = pb.role == "buyer"
    if not mine:
        nxt = pb.opening
    else:
        nxt = mine[-1] + pb.step if buyer else mine[-1] - pb.step
        nxt = min(nxt, pb.walk_away) if buyer else max(nxt, pb.walk_away)
    nxt = round_money(nxt)  # money, not floats: 2.10M - 0.15M must equal 1.95M
    if theirs:
        last = theirs[-1]
        if (buyer and last <= nxt) or (not buyer and last >= nxt):
            return Move("accept", last, f"Their {money(last)} is inside our next step ({money(nxt)}), so accepting saves "
                                        f"{money(abs(nxt - last))} against conceding further. {deal_report(pb, last)}")
    room = abs(pb.walk_away - nxt)
    return Move("offer", nxt, f"Next offer {money(nxt)}; {money(room)} left before our walk-away ({money(pb.walk_away)}).")
