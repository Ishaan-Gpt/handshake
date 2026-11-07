"""scripts/simulate.py plays whole negotiations offline: any overlapping pair of ranges lands a deal inside both limits."""
import pytest

from scripts.simulate import BUYER, SELLER, play


def test_the_demo_pair_agrees_inside_both_limits():
    out = play(BUYER, SELLER)
    assert 78_000 <= out["price"] <= 90_000 and out["rounds"] <= 12


@pytest.mark.parametrize("buyer, seller", [
    ("I'm buying. Open at $1.5M, aim for 1.75M, walk away above $2.05M", "Selling. Open at $2.4M, I'd like $2.1M, floor $1.85M"),
    ("buying a car: open at 4 lakh, aim for 5 lakh, walk away above 6.5 lakh", "selling my car. Open at 8 lakh, I'd like 7 lakh, won't go below 6 lakh"),
])
def test_other_sizes_and_units(buyer, seller):
    out = play(buyer, seller)
    assert out["seller"].walk_away <= out["price"] <= out["buyer"].walk_away


def test_no_overlap_means_no_deal():
    with pytest.raises(SystemExit):
        play("I'm buying. Open at $10K, aim for $12K, walk away above $15K", "Selling. Open at $40K, I'd like $30K, floor $25K")
