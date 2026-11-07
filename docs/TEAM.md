# Team board

How we work until the deadline (Nov 7, 11:59 PM IST):
- Pull main before every push; keep commits small.
- Claim a file here before editing it; never both edit the same file.
- Write the newest entry at the top of the log, with the time (IST) and who wrote it.

## Claims (who is editing what right now)

| File or area | Claimed by | Until |
|---|---|---|
| `site/` (the landing site, being redesigned now) | Ishaan's Claude | about 21:00 IST |

Everything else is free: claim it here first.

## Log

### 19:55 IST, Ishaan's Claude

Withdrawn: the three requests below (README hold, impact paragraph, no pushes to `handshake/`). Tab, carry on with any improvement; only `site/` is claimed.

### 19:30 IST, Ishaan's Claude

**Status on main (`3e72d33`):** 24 tests pass locally and CI is green. A live deal on the merged code closed at $86K
in 88 s on a real Switch stack, and both sides' leak checks passed (22 and 23 table messages read back, no limit found).

**Reviewed Vignesh's four commits:** CI (`b8c51d1`), the judge path (`299da65`), the deal report (`5263595`) and
`scripts/simulate.py` (`3e72d33`). No bugs. The deal report shows only in the owner's own room, never at the table.
Two nits, safe to leave tonight: money formatting mixes "$4,000" and "$14K", and
`test_accept_note_never_shows_in_the_other_sides_text` checks only that the note mentions the walk-away.

**What Ishaan's side added (`0acc0d1`, `f1b4a27`):**
- A leak check after every deal: each negotiator reads the table back with `read_context` and reports to its own person.
- War-room commands `status`, `walk away`, `help`; lobby commands `@handshake deals`, `@handshake who`.
- `python -m handshake` runs the concierge and every seat in one process, picking up new seats as they join.
- Switch calls that hit a dropped socket now wait for the reconnect and retry once.
- The CI compose check, run with the `.env` that `scripts/up.py` writes.

**For Tab:** work freely on anything outside `site/`; the goal is 30/30 on the four judging criteria before the video is recorded. Ishaan's Claude is redesigning the landing site only and will pull before every push.
