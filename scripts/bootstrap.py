"""Sets up the two sides of a Handshake deal on a running Switch server (deploy/ brings one up).

    python scripts/bootstrap.py

For each company it creates a Switch user, a Mattermost account on the bundled server, links the two (so Switch
knows who is speaking in chat), and registers that person's negotiator agent with a registration key they own, so
the agent answers its owner and nobody else. Then it builds the rooms (see scripts/rooms.py). Safe to re-run.
State, including agent API keys, goes to .state.json, which is gitignored.
"""
import json
import secrets
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from handshake.switch_api import SWITCH, gateway, mattermost  # noqa: E402

ENV = dict(l.split("=", 1) for l in (ROOT / "deploy/.env").read_text().splitlines() if "=" in l and not l.startswith("#"))
STATE = ROOT / ".state.json"
SIDES = {
    "acme": {"name": "Asha Rao", "email": "asha@acme.example", "mm": "asha", "agent": "acme-negotiator",
             "display": "Acme negotiator", "company": "Acme Robotics"},
    "globex": {"name": "Gil Moreau", "email": "gil@globex.example", "mm": "gil", "agent": "globex-negotiator",
               "display": "Globex negotiator", "company": "Globex Logistics"},
}
PROFILE = {"connection_model": "always_on", "message_exchange": True, "pre_invocation_mediation": [],
           "post_invocation_mediation": [], "event_reporting": []}


def load():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(s):
    STATE.write_text(json.dumps(s, indent=1))


def main():
    s = load()
    admin = gateway(ENV["GATEWAY_ADMIN_EMAIL"], ENV["GATEWAY_ADMIN_PASSWORD"])
    mm_admin = mattermost(ENV["MATTERMOST_ADMIN_USER"], ENV["MATTERMOST_ADMIN_PASSWORD"])
    team = mm_admin.get(f"/api/v4/teams/name/{ENV['MATTERMOST_TEAM_NAME']}").json()
    bridge = admin.get("/gateway/collaborations").json()[0]
    s["bridge_id"], s["team_id"] = bridge["bridge_id"], team["id"]
    bridge["id"] = bridge["bridge_id"]

    for side, p in SIDES.items():
        me = s.setdefault(side, {})
        me.setdefault("password", "Hs-" + secrets.token_hex(10))
        # 1. The Switch user.
        r = admin.post("/gateway/users", json={"name": p["name"], "email": p["email"], "password": me["password"]})
        print(side, "switch user", r.status_code)
        # 2. The Mattermost account, on the team the bridge serves.
        r = mm_admin.post("/api/v4/users", json={"username": p["mm"], "email": p["email"], "password": me["password"],
                                                  "first_name": p["name"].split()[0], "last_name": p["company"]})
        mm_user = r.json() if r.is_success else mm_admin.get(f"/api/v4/users/username/{p['mm']}").json()
        mm_admin.post(f"/api/v4/teams/{team['id']}/members", json={"team_id": team["id"], "user_id": mm_user["id"]})
        me["mm_user_id"] = mm_user["id"]
        print(side, "mattermost", r.status_code, mm_user["id"])
        # 3. Sign in as the person: link their chat account, and register their agent with a key they own.
        g = gateway(p["email"], me["password"])
        ids = [i for i in g.get("/gateway/auth/me/identities").json() if i.get("bridge_id") == bridge["id"]]
        if not any(i.get("verified") for i in ids):
            r = g.post(f"/gateway/collaborations/{bridge['id']}/identities",
                       json={"external_user_id": mm_user["id"], "username": p["mm"], "expects_confirmation": True})
            ident = r.json()
            if r.is_success and ident.get("link_request") is not None:
                mm = mattermost(p["mm"], me["password"])
                v = g.post(f"/gateway/collaborations/{bridge['id']}/identities/{ident['id']}/verify-session",
                           json={"token": mm.headers["Authorization"].split()[1]})
                print(side, "identity verify", v.status_code, v.text[:120])
            else:
                print(side, "identity", r.status_code, r.text[:160])
        if "agent_id" not in me:
            key = g.post("/gateway/api-keys", json={"label": f"{side} registration", "expires_in_days": 30}).json()["key"]
            r = httpx.post(f"{SWITCH}/agents", headers={"Authorization": f"Bearer {key}"}, timeout=30, json={
                "name": p["agent"], "display_name": p["display"], "connector_type": "handshake-python",
                "description": f"Negotiates for {p['company']}. Takes instructions from {p['name']} only.",
                "integration_profile": PROFILE, "overwrite": True})
            r.raise_for_status()
            me["agent_id"], me["agent_key"] = r.json()["id"], r.json()["api_key"]
            print(side, "agent", me["agent_id"])
        save(s)
    print("done:", {k: v.get("agent_id") for k, v in s.items() if isinstance(v, dict)})


if __name__ == "__main__":
    main()
