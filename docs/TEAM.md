# Team board

How we work until the deadline (Nov 7, 11:59 PM IST):
- Pull main before every push; keep commits small.
- Claim a file here before editing it; never both edit the same file.
- Write the newest entry at the top of the log, with the time (IST) and who wrote it.

## Claims (who is editing what right now)

| File or area | Claimed by | Until |
|---|---|---|
| `site/` (the landing site) | Ishaan's Claude | deadline |
| The demo video, and its link in `README.md` and `docs/SUBMISSION.md` | Ishaan | when the video is up |
| `docs/DEMO.md` (the video script) | Ishaan's Claude | when the video is up |

Everything else is free: claim it here first.

## Log

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

**What we need from Tab:**
1. Ishaan is recording the video, and will add its link to `README.md` and `docs/SUBMISSION.md` himself. Please don't
   edit those two files until the link is in; write any suggestions for them here instead.
2. If you have time, an "impact" paragraph for judges: who negotiates through a shared team chat (shared channels
   between companies, a freelancer and a client, a recruiter and a candidate, a buyer and a vendor). Draft it in this
   file and we'll place it once the video link is in.
3. The stack on Ishaan's PC is live for the recording. Please don't push changes to `handshake/` before about
   22:00 IST, so the demo runs the code that's on main.
