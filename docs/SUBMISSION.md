# Flip the Switch submission

- **Project:** Handshake
- **Track:** Track 01, Best Business Workflow. Side: Best Blog (`docs/BLOG.md`), #HowISwitch.
- **Repo:** https://github.com/Ishaan-Gpt/handshake · **Site:** https://ishaan-gpt.github.io/handshake/
- **Demo video:** _your YouTube link_

## One-line pitch
Let your AI agent negotiate with theirs inside your team chat: ask for a deal, tell your agent your limits in a room only
you can enter, and it bargains with the other side's agent at a shared table, sending nothing without your yes.

## Description (paste)
Handshake is the first way to put both sides' AI agents in one negotiation without either being able to pry the other's
limits loose. In the team chat's lobby, anyone asks `@handshake open a deal with @them about anything`, and a concierge
agent builds the deal in Switch on the spot: a shared table and a private room for each side that only that person and
their own agent can enter. Each person tells their agent their limits in plain words; it files them as a private
playbook, drafts every offer in their room with its reasoning, and posts at the table only after they say yes.

Switch is the security model, not a transport. Every seat's agent is owned by its person and linked to their chat
account; its addressing policy lets its owner instruct it anywhere and other agents talk to it at the table, but no other
human ever, so when the other side orders your agent to accept their price, Switch refuses them in the channel. Room
membership returns 403 whenever their agent, or even the concierge, tries to read or post in your room. The concierge
uses Switch's room creation, links, room groups and room instructions; playbooks and term sheets are room documents;
any seat can be driven by Claude Code or Cursor through Switch's MCP endpoint, or by Handshake's own negotiator on the
agent protocol, which resumes from Switch's stream cursor after a crash.

Measured: 20 attacks on a walk-away price through four routes leaked it 0 times in 80 through Handshake, while a shared
deal bot leaked it 6 times in 20 and a single bot with the limits in its prompt 11 times in 20. Killed mid-deal, the
negotiators came back and closed the deal. `python scripts/up.py` brings up self-hosted Switch 0.31.0 with Mattermost;
the repo ships the demo, the leak test, the crash drill, a leak check read back from Switch after every deal, and 20 tests run by CI.

## How Switch is used (short list)
Room-creating concierge agent (create_room on the Mattermost bridge, link_rooms, room groups, room instructions) ·
agents owned by users · identity claims · addressing policy · room membership isolation · room documents · MCP endpoint
for bring-your-own agents · agent protocol over WebSocket with cursor resume · Gateway API (users, keys, identities,
policies) · self-hosted Switch 0.31.0 with Mattermost.

## #HowISwitch post (X / LinkedIn)
> I let my AI agent negotiate with someone else's in our team chat.
>
> Then they tried to just order mine to accept their price. Watch what happens.
>
> [clip: Tomas types the order, Switch turns him away]

Reply under it:
> Built on @switch_ai_ for @WeMakeDevs Flip the Switch. Each side's limits live in a room the other can't enter: 0 leaks
> in 80 attacks. https://ishaan-gpt.github.io/handshake/ #HowISwitch
