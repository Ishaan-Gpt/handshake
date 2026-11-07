"""The small slice of Switch's HTTP API that Handshake uses: Gateway sign-in, users, keys, agent registration,
identity links, and agent operations. Everything here is a documented endpoint that Switch's own setup and Console use.
"""
import httpx

SWITCH = "http://localhost:8000"
MATTERMOST = "http://localhost:8065"


def gateway(email: str, password: str) -> httpx.Client:
    """A Gateway client signed in as one person (cookie-based session, replayed as a header)."""
    c = httpx.Client(base_url=SWITCH, timeout=30)
    r = c.post("/gateway/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    c.headers["Cookie"] = f"switch_auth={r.cookies['switch_auth']}"
    return c


def mattermost(user: str, password: str) -> httpx.Client:
    c = httpx.Client(base_url=MATTERMOST, timeout=30)
    r = c.post("/api/v4/users/login", json={"login_id": user, "password": password})
    r.raise_for_status()
    c.headers["Authorization"] = f"Bearer {r.headers['token']}"
    return c


class Agent:
    """One registered agent, calling Switch operations with its own API key."""

    def __init__(self, agent_id: str, api_key: str, name: str = ""):
        self.id, self.key, self.name = agent_id, api_key, name
        self.http = httpx.Client(base_url=SWITCH, timeout=60, headers={"Authorization": f"Bearer {api_key}"})
        self.connection_id: str | None = None

    def op(self, _op: str, **args):
        headers = {"X-Switch-Connection-Id": self.connection_id} if self.connection_id else {}
        r = self.http.post(f"/agents/{self.id}/ops/{_op}", json=args, headers=headers)
        if r.status_code >= 400:
            raise RuntimeError(f"{self.name} {_op} -> {r.status_code} {r.text[:400]}")
        return r.json().get("result")

    def say(self, room_id: str, content: str):
        r = self.http.post(f"/agents/{self.id}/message", json={"room_id": room_id, "content": content})
        if r.status_code >= 400:
            raise RuntimeError(f"{self.name} message -> {r.status_code} {r.text[:400]}")
        return r.json()

    def ops(self) -> dict:
        return self.http.get(f"/agents/{self.id}/ops").json()["operations"]
