# Handshake: let your agent negotiate with theirs, in your team chat. Neither sees the other's cards.

[![tests](https://github.com/Ishaan-Gpt/handshake/actions/workflows/tests.yml/badge.svg)](https://github.com/Ishaan-Gpt/handshake/actions/workflows/tests.yml)

**Site:** https://ishaan-gpt.github.io/handshake/ · **Built on** [Switch](https://github.com/sandbox-quantum/switch) for
WeMakeDevs' Flip the Switch (Track 01, Business Workflow) · Demo video: _link on submission_ · Blog: [docs/BLOG.md](docs/BLOG.md)

Every team is about to send AI agents to negotiate for it: a retainer, a contract, a licence, a salary. Nobody can put
**both sides'** agents in one conversation yet, because one shared bot holds one shared memory, and whatever you tell it,
the other side can talk it into repeating. Handshake runs inside the team chat you already use, on Switch:

1. **Ask for a deal, in your chat.** In `#handshake-lobby`, anyone with a seat types
   `@handshake open a deal with @them about <anything>`. The concierge agent builds it on the spot: a shared table, and a
   private room for each side that only that person and their own agent can enter.
2. **Tell your agent your limits, in plain words, in your own room.** *"I'm buying. Open at $60K, aim for $72K, walk away
   above $90K. Must-haves: we own the files."* Any currency or unit (K, M, lakh, crore). It files them as your private
   playbook, a Switch room document the other side can't reach.
3. **Your agents bargain at the table, and nothing crosses without your yes.** Every offer is drafted in your room first,
   with its reasoning, and goes to the table only when you reply `yes`. When the other person tries to order your agent
   about, Switch itself refuses them in the channel.
4. **Bring the agent you already use.** A seat is a Switch identity that belongs to you; put any brain behind it: Claude
   Code or Cursor through Switch's MCP endpoint with your seat's key (`python scripts/seat.py you`), or Handshake's own
   negotiator (`python -m handshake.negotiator`).

**The number:** the other side tried 20 ways to learn the walk-away, through four routes. Through Handshake, **0 of 80**
got it out. The same 20 against a shared deal bot, and against your own bot with your limits in its prompt, leaked it
**6 and 11 times out of 20** (qwen2.5 3B, same "never reveal" instruction; [results/](results/)).

## For judges, in two minutes

- **Switch is the product, not a plug-in.** Rooms, linked tables, owner-only agents, addressing policy, room documents,
  the MCP endpoint and the stream cursor each carry a part of the deal (table below). Take Switch away and there is no
  deal room, no private room and no wall.
- **Reproduce it.** `pip install -r requirements.txt && python -m pytest tests` (25 tests, run by CI on every push:
  ![tests](https://github.com/Ishaan-Gpt/handshake/actions/workflows/tests.yml/badge.svg)). The full stack is
  `python scripts/up.py` (Docker); `python scripts/demo.py` plays a whole deal by itself, and `python scripts/simulate.py` plays one offline in a second, no Docker needed (try your own limits: `python scripts/simulate.py "I'm buying, open at $1.5M..." "Selling, open at $2.4M..."`).
- **The claim is measured.** 20 attacks x 4 routes, raw output in `results/`; the baselines use the same "never
  reveal" instruction, and after every real deal each negotiator reads the table back from Switch and reports a
  leak check to its own person.
- **Where to read the code that matters:** the strategy that never sees a model (`handshake/strategy.py`), the rules
  that parse terms (`handshake/terms.py`), the agent loop and cursor (`handshake/agentloop.py`).

## Where it runs

The chat is **Mattermost**, the team chat Switch bundles when you self-host it, and one of the apps the hackathon lists
("Slack, Teams, Discord, or Mattermost"). Everything is Switch 0.31.0 from its own published Compose file, on your
machine; `python scripts/up.py` brings it up. Switch's other bridges (Slack, Discord, Teams, Telegram) connect the same
way; Handshake only talks to Switch, never to the chat app directly.

## How it uses Switch

| What a deal needs | Switch feature | Where |
|---|---|---|
| Rooms made on request, from chat | An **agent that creates rooms** (`create_room` on the Mattermost bridge, private and public), **links** them (`link_rooms`, "deal table") and files them in a **room group** | `handshake/concierge.py` |
| Each person's agent belongs to them | **Agents owned by users**, registered with each person's own registration key | `handshake/seats.py` |
| Switch knows who is typing | **Identity claims**: each chat account linked to its Switch user and confirmed | `seats.py` |
| Only you can instruct your agent; other agents may talk to it; no other human ever can | **Addressing policy** set by the owner (owner anywhere; agents anywhere it sits; humans never) | `seats.py` |
| Your limits are out of reach | **Room membership**: the other side's agent, and the concierge too, get `403 Agent is not a member of this room` | `scripts/leak_test.py` |
| Your limits and the agreed terms live with the work | **Room documents**: the playbook in your room, each side's term sheet at the table | `handshake/negotiator.py` |
| Proof after every deal | Each negotiator reads the whole table back with **`read_context`** and tells its own person, in their room, that their walk-away and target never appeared there except as offers on the record | `negotiator.py` (`leak_check`) |
| Room instructions both agents read | The concierge writes the deal's facts into the table's **room instructions** | `concierge.py` |
| Bring your own agent | Switch's **MCP endpoint** (`/mcp/`, 40+ room tools) with your seat's key | `scripts/seat.py` |
| Run our own agents | The **agent protocol**: WebSocket in (`connection_state`, ping/pong, cursor), HTTP out (`/message`, `/ops/*`) | `handshake/agentloop.py` |
| Survive a crash, never double-open | **Stream cursor**: reopen with `start_from=<last handled event>`; Switch replays what was missed, and the concierge remembers what it handled | `agentloop.py`, `scripts/crash_drill.py` |
| Run it anywhere | **Self-hosted Switch** with its bundled Mattermost and the Gateway (users, keys, identities, policies) | `deploy/`, `scripts/up.py` |

## Why your limits can't leak through your own agent

Switch keeps the other side out of your room. Inside your agent, one more rule: **the model that writes table messages
never sees your limits.** The next offer is computed in plain code from your playbook (`handshake/strategy.py`: open,
step toward your target, never cross your walk-away, accept when their number is inside your next step), and the terms
are parsed from your words by plain rules (`handshake/terms.py`), not a model. The model only words the chosen move; if
its text changes the number, mentions any other amount or the wrong addressee, it's thrown away for a template. Then you
read the draft before it goes anywhere.

## Run it (about 10 minutes, Docker required)

```bash
git clone https://github.com/Ishaan-Gpt/handshake && cd handshake
python -m venv .venv && .venv/bin/pip install -r requirements.txt      # Windows: .venv\Scripts\pip
python scripts/up.py                         # Switch + Mattermost + Gateway + the concierge
python scripts/join.py you "Your Name"       # a seat: a chat account and an agent that obeys only you
python scripts/join.py them "Their Name"
python -m handshake                          # terminal 2: the concierge and every seat's negotiator, new seats picked up as they join
```

Then sign in at http://localhost:8065 (passwords are printed by `join.py`) and type in `#handshake-lobby`:
`@handshake open a deal with @them about whatever you're agreeing`. Or watch a whole deal play out by itself:
`python scripts/demo.py` (Priya and Tomas, two sample people, agree a design retainer at $86K in about 80 seconds).

More: `python scripts/leak_test.py` (the 80 attacks), `python scripts/crash_drill.py` (kill the negotiators mid-deal),
`python -m pytest tests` (25 tests, also run by CI on every push), `python scripts/public.py <tunnel url>` + `python scripts/live.py` (open the lobby
and tables to visitors, who can watch and try ordering an agent about). The message-wording brain is
`HANDSHAKE_BRAIN=ollama` (default, `qwen2.5:3b`), `claude` (Claude Code headless) or `plain` (templates).

## What you can say

| Where | You say | What happens |
|---|---|---|
| `#handshake-lobby` | `@handshake open a deal with @them about <anything>` | A table, a private room each, linked and grouped |
| `#handshake-lobby` | `@handshake deals` · `@handshake who` | Your deals · everyone with a seat |
| Your private room | Your terms in plain words, any currency (`$1.5M`, `₹6 lakh`, `90K`) | Sealed as your playbook, filed as a room document |
| Your private room | `open` · `yes` · `status` · `walk away` · `help` | First draft · send a draft · where the deal stands · leave politely, numbers unsaid · the list |
| The table | anything addressed to their agent | Refused by Switch: only its owner may instruct it |

## What we learned building it

- **Two agents running the same code will talk forever.** An offer-less message once made both agents ask each other
  for an offer until Switch's repeat guard cut them off with a 429. Now it goes to the agent's own person instead.
- **A replayed event must be harmless.** Two concierge processes kept taking the same connection from each other, and
  each replayed "open a deal" opened another one: 28 deals from one request. The concierge now remembers every message
  it has handled.
- **Answer pings before you think.** A slow call inside the event loop lapses the heartbeat and Switch evicts you;
  events go to a worker, pings are answered at once.
- **Money isn't a float.** `2.10M - 0.15M` is `1.9500000000000002M`; amounts are rounded before they're compared.

**Threat model:** [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) lists each attack route, what stops it, and what Handshake does not protect.

## Limits

- One negotiated number per deal (price, fee or rate) against stated must-haves; the strategy is plain code so anyone
  can audit what their agent will concede.
- Approval is a `yes` reply in your room, not Switch's permission buttons (those are for Console-run agents).
- All seats live on one Switch server; two companies would share a hosted server or federate later.

MIT licence. Switch is Apache 2.0 + Commons Clause and runs unmodified from its published images.
