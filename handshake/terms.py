"""Turning what a person types in their private room into a playbook, and money back into words.

    "I'm buying. Open at $1.5M, aim for 1.75M, walk away above $2.05M. Must-haves: 99.5% uptime, 30-day payment"

Plain rules, no model: the private numbers never pass through a language model, here or anywhere else.
"""
import math
import re

UNITS = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mn": 1e6, "million": 1e6, "b": 1e9, "bn": 1e9, "billion": 1e9,
         "lakh": 1e5, "lakhs": 1e5, "l": 1e5, "cr": 1e7, "crore": 1e7, "crores": 1e7}
AMOUNT = re.compile(r"(\$|usd\s?|rs\.?\s?|₹|inr\s?)?(\d[\d,]*(?:\.\d+)?)\s?(k|thousand|mn|m|million|bn|b|billion|lakhs?|l|cr|crores?)?\b", re.I)
WALK = re.compile(r"walk[\s-]?away|ceiling|max(imum)?|at most|no more than|won'?t (pay|go) (more|above|over)|floor|minimum|at least|no less than|bottom[\s-]?line|limit|won'?t go (below|under)", re.I)
TARGET = re.compile(r"\b(aim\w*|target\w*|hop(e|ing)|ideal(ly)?|happy (at|with)|(would|i'?d) like|like to get|goal|prefer)", re.I)
OPEN = re.compile(r"\b(open|start|first offer|begin|ask(ing)? (for|at)|list(ed)? at|anchor)", re.I)
BUY = re.compile(r"\b(buy(ing|er)?|purchas\w*|procur\w*|pay(ing)?|hire|hiring|rent(ing)? from|license from)\b", re.I)
SELL = re.compile(r"\b(sell(ing|er)?|vendor|supplier|charg\w*|my (price|rate|fee)|quote|licens(e|ing) to)\b", re.I)
MUST = re.compile(r"(must[\s-]?haves?|non[\s-]?negotiables?|need(s)?|require(s|ments)?)\s*[:\-]?\s*(.+)$", re.I)


def amounts(text: str, need_marker: bool = False) -> list[float]:
    """Money in a piece of text, in plain units. With need_marker, a bare number ("40 robots") doesn't count."""
    out = []
    for cur, num, unit in AMOUNT.findall(text):
        if need_marker and not (cur or unit):
            continue
        v = float(num.replace(",", ""))
        out.append(round(v * UNITS.get((unit or "").lower(), 1), 2))
    return out


def money(v: float) -> str:
    if v >= 1e6:
        return f"${v / 1e6:.2f}M".replace(".00M", "M")
    if v >= 1e4:
        return f"${v / 1e3:,.1f}K".replace(".0K", "K")
    return f"${v:,.0f}"


def round_money(v: float) -> float:
    """To three significant figures, so steps land on numbers people actually say."""
    if v <= 0:
        return 0.0
    unit = 10 ** max(0, int(math.floor(math.log10(v))) - 2)
    return round(v / unit) * unit


def parse_terms(text: str) -> dict:
    """Pulls role, opening, target, walk-away and must-haves from plain words. Missing pieces are filled sensibly
    from the walk-away and target; `missing` names anything that can't be."""
    t = text.strip()
    found = {}
    for clause in re.split(r"(?<!\d)\.(?!\d)|[;,\n]|\bbut\b|\band\b(?!\s*\d)", t, flags=re.I):
        vals = amounts(clause)
        if not vals:
            continue
        v = vals[0]
        if WALK.search(clause):
            found.setdefault("walk_away", v)
        elif TARGET.search(clause):
            found.setdefault("target", v)
        elif OPEN.search(clause):
            found.setdefault("opening", v)
    role = "buyer" if BUY.search(t) and not SELL.search(t) else "seller" if SELL.search(t) and not BUY.search(t) else None
    if role is None and "walk_away" in found and "target" in found:
        role = "buyer" if found["walk_away"] > found["target"] else "seller"
    must = MUST.search(t)
    must_haves = [m.strip(" .") for m in re.split(r"[;,]| and ", must.group(4)) if m.strip(" .")] if must else []
    missing = [k for k in ("role", "walk_away") if (role if k == "role" else found.get(k)) is None]
    if missing:
        return {"missing": missing, "found": found, "role": role}
    w = found["walk_away"]
    tgt = found.get("target") or round_money(w * (0.85 if role == "buyer" else 1.15))
    opening = found.get("opening") or round_money(tgt - (w - tgt) * 0.8 if role == "buyer" else tgt + (tgt - w) * 0.8)
    step = round_money(max(abs(w - opening) / 4, 1))
    return {"role": role, "opening": opening, "target": tgt, "walk_away": w, "step": step, "must_haves": must_haves[:4],
            "missing": []}


def describe(terms: dict) -> str:
    return (f"you're the **{terms['role']}**: open at {money(terms['opening'])}, aim for {money(terms['target'])}, "
            f"walk away {'above' if terms['role'] == 'buyer' else 'below'} {money(terms['walk_away'])}, steps of "
            f"{money(terms['step'])}" + (f"; must-haves: {', '.join(terms['must_haves'])}" if terms["must_haves"] else ""))
