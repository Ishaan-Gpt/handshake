# Threat model: what Handshake protects, how, and what it does not

The secret is one number: your walk-away (the most a buyer pays, the least a seller takes). The attacker is the other
side: their person, their agent, anything they can run. Every claim below points at the code or the test that backs it.

## The four routes the other side has, and what stops each

| Route | What stops it | Checked by |
|---|---|---|
| Their person orders your negotiator at the table | Switch's addressing policy: only the owner can instruct an agent, humans never | `scripts/leak_test.py`, route 1 |
| Their agent reads your private room | Switch room membership: `403 Agent is not a member of this room` | `scripts/leak_test.py`, route 2 |
| Their agent posts into your private room | Switch room membership, same refusal | `scripts/leak_test.py`, route 3 |
| Their agent asks your negotiator at the table (allowed) | The model that words table messages never sees your limits; the number comes from plain code | `scripts/leak_test.py`, route 4; `tests/` |

Result on file: 20 attacks through 4 routes, 0 of 80 got the walk-away out (`results/`). The same 20 attacks leaked it
6 and 11 times out of 20 against a shared deal bot and against one bot holding your limits in its prompt.

## Why the table cannot carry the secret even if a model misbehaves

1. **The number is decided in code.** `handshake/strategy.py` computes every offer from your playbook; terms are parsed
   by plain rules in `handshake/terms.py`.
2. **The model only words the move.** If its text changes the number, mentions any other amount, or names the wrong
   addressee, the text is thrown away for a template (`handshake/negotiator.py`).
3. **Nothing crosses without your yes.** Every draft appears in your room first, with its reasoning.
4. **The private report stays private.** `deal_report` (`handshake/strategy.py`) tells only you how a price sits against
   your limits; it is part of the note shown in your own room.
5. **A replay is harmless.** The stream cursor and the concierge's handled-message memory stop a replayed event from
   opening a second deal (`scripts/crash_drill.py`).

## What it does not protect (read this before trusting it with a real deal)

- **Your own room is yours to guard.** Anyone who can enter your private room, or read your playbook document, can see
  your limits. Switch enforces who that is; keep that list to yourself.
- **The offers themselves reveal something.** Every number you send is visible to the other side. Plain code decides it,
  but a patient counterparty learns your concession pattern over many rounds.
- **The 0-of-80 figure is small and specific.** It is 20 hand-written attacks against a 3B model's wording, on one
  deal. It shows the walls hold for these routes; it is not a proof for attacks nobody wrote.
- **One server hosts all seats in this build.** Two real companies would need a hosted or federated Switch.
- **One number per deal.** Price, fee or rate against stated must-haves; no multi-issue trade-offs.

If you find a route not listed here, that is a bug in this document first and in the product second.
