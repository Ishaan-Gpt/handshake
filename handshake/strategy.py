"""The negotiating strategy: plain code over the private playbook, so the numbers are decided here, not by a model.

A buyer opens low and climbs by a step; a seller opens high and comes down; neither ever crosses its walk-away.
When the other side's last number is already inside what we'd offer next, we accept it.
"""
from dataclasses import dataclass, field


@dataclass
class Playbook:
    company: str
    role: str            # "buyer" or "seller"
    opening: float       # $M
    target: float
    walk_away: float     # the secret: most a buyer pays, least a seller takes
    step: float
    must_haves: list[str] = field(default_factory=list)

    @classmethod
    def parse(cls, text: str) -> "Playbook":
        kv = {}
        for line in text.splitlines():
            if ":" in line and not line.lstrip().startswith("#"):
                k, v = line.split(":", 1)
                kv[k.strip().lower().replace(" ", "_").replace("-", "_")] = v.strip()
        num = lambda k: float(kv[k].replace("$", "").replace("M", "").replace(",", ""))
        return cls(company=kv["company"], role=kv["role"], opening=num("opening"), target=num("target"),
                   walk_away=num("walk_away"), step=num("step"),
                   must_haves=[m.strip() for m in kv.get("must_haves", "").split(";") if m.strip()])


@dataclass
class Move:
    kind: str            # "offer" or "accept"
    price: float
    note: str            # private reasoning, shown only to our own human


def next_move(pb: Playbook, mine: list[float], theirs: list[float]) -> Move:
    buyer = pb.role == "buyer"
    if not mine:
        nxt = pb.opening
    else:
        nxt = mine[-1] + pb.step if buyer else mine[-1] - pb.step
        nxt = min(nxt, pb.walk_away) if buyer else max(nxt, pb.walk_away)
    nxt = round(nxt, 2)  # money, not floats: 2.10 - 0.15 must equal 1.95
    if theirs:
        last = theirs[-1]
        if (buyer and last <= nxt) or (not buyer and last >= nxt):
            return Move("accept", last, f"Their ${last:.2f}M is inside our next step (${nxt:.2f}M), so accepting saves "
                                        f"${abs(nxt - last):.2f}M against conceding further.")
    room = abs(pb.walk_away - nxt)
    return Move("offer", round(nxt, 2), f"Next offer ${nxt:.2f}M; ${room:.2f}M left before our walk-away "
                                        f"(${pb.walk_away:.2f}M).")
