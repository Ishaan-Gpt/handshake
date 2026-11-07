"""Plain words become a playbook, the strategy never crosses a walk-away, and any two parties reach a deal."""
from handshake.strategy import Playbook, next_move
from handshake.terms import amounts, money, parse_terms

BUYER = "I'm buying: we're hiring this agency. Open at $60K, aim for $72K, and walk away above $90K. Must-haves: 48-hour turnaround; we own the files"
SELLER = "We're selling the retainer. Open at $110K, I'd like $95K, and my floor is $78K. Must-haves: 12-month minimum"


def test_terms_from_plain_words():
    b, s = parse_terms(BUYER), parse_terms(SELLER)
    assert (b["role"], b["opening"], b["target"], b["walk_away"]) == ("buyer", 60_000, 72_000, 90_000)
    assert (s["role"], s["opening"], s["target"], s["walk_away"]) == ("seller", 110_000, 95_000, 78_000)
    assert b["must_haves"][:2] == ["48-hour turnaround", "we own the files"]


def test_terms_in_other_units_and_missing_pieces():
    car = parse_terms("selling my car, won't go below 6 lakh, hoping for 7 lakh")
    assert car["role"] == "seller" and car["walk_away"] == 600_000 and car["target"] == 700_000
    assert parse_terms("buying a laptop")["missing"] == ["walk_away"]
    assert parse_terms("Open at $1.5M, aim for 1.75M, walk away above $2.05M. I'm buying")["walk_away"] == 2_050_000


def test_amounts_need_a_money_marker_at_the_table():
    assert amounts("Priya's side proposes $67.5K for 40 robots and 12 months", need_marker=True) == [67_500]
    assert money(1_950_000) == "$1.95M" and money(86_000) == "$86K" and money(850) == "$850"


def test_never_crosses_a_walk_away():
    for text, high in ((BUYER, True), (SELLER, False)):
        pb, mine = Playbook.from_terms("x", parse_terms(text)), []
        for _ in range(20):
            m = next_move(pb, mine, [10_000_000 if high else 1])
            assert (m.price <= pb.walk_away) if high else (m.price >= pb.walk_away)
            mine.append(m.price)


def test_any_two_parties_reach_a_deal_inside_both_limits():
    a, b = Playbook.from_terms("a", parse_terms(BUYER)), Playbook.from_terms("b", parse_terms(SELLER))
    sides, turn = {"a": [], "b": []}, "a"
    for _ in range(30):
        me, other, pb = (sides["a"], sides["b"], a) if turn == "a" else (sides["b"], sides["a"], b)
        m = next_move(pb, me, other)
        if m.kind == "accept":
            assert b.walk_away <= m.price <= a.walk_away
            return
        me.append(m.price)
        turn = "b" if turn == "a" else "a"
    raise AssertionError("no deal")


def test_money_is_rounded():
    pb = Playbook("s", "seller", 2_400_000, 2_100_000, 1_850_000, 150_000)
    assert next_move(pb, [2_400_000, 2_250_000, 2_100_000], [1_950_000]).kind == "accept"


def test_deal_report_reads_against_private_limits():
    from handshake.strategy import deal_report
    b = Playbook.from_terms("a", parse_terms(BUYER))
    assert deal_report(b, 86_000) == "$86K is $4K inside your walk-away and $14K short of your target ($72K)."
    assert "better than your target" in deal_report(b, 70_000)
    s = Playbook.from_terms("b", parse_terms(SELLER))
    assert deal_report(s, 86_000) == "$86K is $8K inside your walk-away and $9K short of your target ($95K)."
    assert "past your walk-away" in deal_report(s, 70_000)


def test_accept_note_is_the_whole_private_explanation():
    pb = Playbook.from_terms("a", parse_terms(BUYER))
    m = next_move(pb, [60_000, 67_500, 75_000, 82_500], [82_000])
    assert m.kind == "accept" and m.price == 82_000
    assert m.note == ("Their $82K is inside our next step ($90K), so accepting saves $8K against conceding further. "
                      "$82K is $8K inside your walk-away and $10K short of your target ($72K).")


def test_report_amounts_never_mix_styles():
    from handshake.strategy import deal_report
    pb = Playbook.from_terms("a", parse_terms(BUYER))
    assert deal_report(pb, 84_500) == "$84.5K is $5.5K inside your walk-away and $12.5K short of your target ($72K)."
    assert deal_report(pb, 86_000) == "$86K is $4K inside your walk-away and $14K short of your target ($72K)."
