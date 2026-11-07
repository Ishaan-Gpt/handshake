"""Seats: anyone can join and get a negotiator agent that belongs to them.

Joining makes a Switch user and a Mattermost account, links the two (so Switch knows who is typing), and registers
`<name>-negotiator` with a key that person owns. Its addressing policy: its owner may instruct it anywhere, other
agents may talk to it (that's how two negotiators bargain), and no other human can ever give it an order.

The seat is an identity, not a brain: run our negotiator on it (python -m handshake.negotiator), or point your own
Claude Code or Cursor at Switch's MCP endpoint with the seat's key (python scripts/seat.py <name>).
"""
import json
import re
import secrets
from pathlib import Path

import httpx

from handshake.switch_api import SWITCH, gateway, mattermost

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / ".state.json"
PROFILE = {"connection_model": "always_on", "message_exchange": True, "pre_invocation_mediation": [],
           "post_invocation_mediation": [], "event_reporting": []}


def env() -> dict:
    return dict(l.split("=", 1) for l in (ROOT / "deploy/.env").read_text().splitlines() if "=" in l and not l.startswith("#"))


def load() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(s: dict):
    STATE.write_text(json.dumps(s, indent=1))


def bridge_and_team(s: dict, e: dict):
    if "bridge_id" not in s:
        admin = gateway(e["GATEWAY_ADMIN_EMAIL"], e["GATEWAY_ADMIN_PASSWORD"])
        s["bridge_id"] = admin.get("/gateway/collaborations").json()[0]["bridge_id"]
        mm = mattermost(e["MATTERMOST_ADMIN_USER"], e["MATTERMOST_ADMIN_PASSWORD"])
        s["team_id"] = mm.get(f"/api/v4/teams/name/{e['MATTERMOST_TEAM_NAME']}").json()["id"]
    return s["bridge_id"], s["team_id"]


def register(owner: httpx.Client, name: str, display: str, description: str) -> tuple[str, str]:
    key = owner.post("/gateway/api-keys", json={"label": f"{name} registration", "expires_in_days": 30}).json()["key"]
    r = httpx.post(f"{SWITCH}/agents", headers={"Authorization": f"Bearer {key}"}, timeout=30, json={
        "name": name, "display_name": display, "connector_type": "handshake-python", "description": description,
        "integration_profile": PROFILE, "overwrite": True})
    r.raise_for_status()
    return r.json()["id"], r.json()["api_key"]


def join(username: str, display_name: str, email: str | None = None) -> dict:
    """Gives `username` a seat (idempotent). Returns the seat: password, Mattermost id, agent id and key."""
    username = re.sub(r"[^a-z0-9._-]", "", username.lower())
    s, e = load(), env()
    bridge, team = bridge_and_team(s, e)
    seat = s.setdefault("seats", {}).setdefault(username, {})
    seat.setdefault("password", "Hs-" + secrets.token_hex(10))
    seat["name"], seat["email"] = display_name, email or f"{username}@handshake.example"
    admin = gateway(e["GATEWAY_ADMIN_EMAIL"], e["GATEWAY_ADMIN_PASSWORD"])
    admin.post("/gateway/users", json={"name": display_name, "email": seat["email"], "password": seat["password"]})
    mm_admin = mattermost(e["MATTERMOST_ADMIN_USER"], e["MATTERMOST_ADMIN_PASSWORD"])
    first, *rest = display_name.split()
    r = mm_admin.post("/api/v4/users", json={"username": username, "email": seat["email"], "password": seat["password"],
                                             "first_name": first, "last_name": " ".join(rest)})
    mm_user = r.json() if r.is_success else mm_admin.get(f"/api/v4/users/username/{username}").json()
    mm_admin.post(f"/api/v4/teams/{team}/members", json={"team_id": team, "user_id": mm_user["id"]})
    seat["mm_user_id"] = mm_user["id"]
    lobby = mm_admin.get(f"/api/v4/teams/{team}/channels/name/handshake-lobby")
    if lobby.is_success:  # everyone with a seat sits in the lobby, where deals are opened
        mm_admin.post(f"/api/v4/channels/{lobby.json()['id']}/members", json={"user_id": mm_user["id"]})
    me = gateway(seat["email"], seat["password"])
    linked = [i for i in me.get("/gateway/auth/me/identities").json() if i.get("bridge_id") == bridge and i.get("verified", True)]
    if not linked:
        r = me.post(f"/gateway/collaborations/{bridge}/identities",
                    json={"external_user_id": mm_user["id"], "username": username, "expects_confirmation": True})
        if r.is_success and r.json().get("link_request") is not None:
            mm = mattermost(username, seat["password"])
            me.post(f"/gateway/collaborations/{bridge}/identities/{r.json()['id']}/verify-session",
                    json={"token": mm.headers["Authorization"].split()[1]})
    if "agent_id" not in seat:
        seat["agent"] = f"{username}-negotiator"
        seat["agent_id"], seat["agent_key"] = register(
            me, seat["agent"], f"{display_name.split()[0]}'s negotiator",
            f"Negotiates for {display_name}. Takes instructions from {display_name} only.")
    # Its owner, anywhere; other agents, anywhere it is (deal tables); never another human.
    me.put(f"/gateway/agents/{seat['agent_id']}/addressing-policy", json={"policy": {"rules": [
        {"rooms": "*", "room_groups": "*", "users": [], "agents": [], "owner": True},
        {"rooms": "*", "room_groups": "*", "users": [], "agents": "*"},
    ]}})
    save(s)
    return seat


def ensure_concierge() -> dict:
    """The `handshake` agent that opens deals from the lobby. It belongs to the server's admin and answers anyone
    who has a seat; it sits in the lobby and at each deal table, never in a war room."""
    s, e = load(), env()
    bridge, _ = bridge_and_team(s, e)
    c = s.setdefault("concierge", {})
    admin = gateway(e["GATEWAY_ADMIN_EMAIL"], e["GATEWAY_ADMIN_PASSWORD"])
    if "agent_id" not in c:
        c["agent_id"], c["agent_key"] = register(admin, "handshake", "Handshake",
                                                 "Opens deal rooms: a shared table and a private war room for each side.")
    admin.put(f"/gateway/agents/{c['agent_id']}/addressing-policy", json={"policy": {"rules": [
        {"rooms": "*", "room_groups": "*", "users": "*", "agents": []}]}})
    save(s)
    return c
