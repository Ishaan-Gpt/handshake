# Flip the Switch submission

- **Project:** Handshake
- **Track:** Track 01, Best Business Workflow. Side: Best Blog (blog in `docs/BLOG.md`), #HowISwitch.
- **Repo:** https://github.com/Ishaan-Gpt/handshake
- **Demo video:** _your YouTube link_

## One-line pitch
Two companies' AI agents negotiate a deal in one team-chat room, each taking orders only from its own people and
keeping its playbook in a private war room the other side's agent can never enter, with a human approving every move.

## Description (paste)
Handshake is the first way to seat two companies' AI agents at the same negotiating table without either one being
able to pry the other's secrets loose. Each company gets its own Switch agent and its own private war room, where its
playbook lives as a room document; the two agents meet in a shared deal room, trade offers addressed to each other, and
every move is drafted in the war room and sent only after that company's human replies yes.

Switch is the security model, not a transport. Each agent is owned by a different person and identity-linked to their
Mattermost account; an addressing policy lets each agent take instructions only from its owner anywhere and from the
counterpart agent only at the deal table, so when Globex's lead orders Acme's agent to accept his price, Switch itself
refuses him; room membership returns 403 whenever Globex's agent tries to read or post in Acme's war room; linked rooms
and room groups organise the deal; room documents hold the playbooks and the term sheet; and the agents run on Switch's
agent protocol, resuming from the stream cursor after a crash so a killed agent picks up the offer it missed.

We measured it: 20 attacks on Acme's walk-away price through four routes leaked it 0 times in 80 through Handshake,
while a shared deal bot leaked it 4-5 times in 20 and Acme's own bot with its playbook in its prompt 8-9 times in 20.
`python scripts/up.py` brings up self-hosted Switch 0.31.0 with Mattermost and the whole deal in one command, and the
repo ships the leak test, a crash drill and 10 tests.

## How Switch is used (short list for the form)
Agents owned by different users · identity claims · addressing policy (owner anywhere, counterpart agent in the deal
room only) · room membership isolation · Mattermost-bridged rooms (private and public) with room instructions · room
documents (playbooks, term sheet) · linked rooms · room groups · agent protocol over WebSocket with cursor resume ·
agent operations (create_room, create_room_group, invite_agent_to_room, link_rooms, connect_to_room, read_context,
create_room_document) · Gateway API (users, keys, identities, policies) · self-hosted Switch 0.31.0 with Mattermost.

## #HowISwitch post (X / LinkedIn)
> I let two rival companies' AI agents negotiate in the same chat room.
>
> One of them tried to just order the other to accept its price. Watch what happens.
>
> [clip: Gil types the order, Switch turns him away]

Reply under it:
> Built on @switch_ai_ for #HowISwitch and @WeMakeDevs Flip the Switch. Each agent has a private war room the other
> can't enter: 0 leaks in 80 attacks. Code: https://github.com/Ishaan-Gpt/handshake
