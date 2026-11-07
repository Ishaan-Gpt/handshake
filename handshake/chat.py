"""Typing in the bundled Mattermost as a person, for the demo and the tests (people normally just type in the app)."""
from handshake import seats
from handshake.switch_api import mattermost


class Person:
    def __init__(self, username: str, password: str | None = None):
        s = seats.load()
        self.user = username
        self.mm = mattermost(username, password or s["seats"][username]["password"])
        self.team = s["team_id"]
        self.id = self.mm.get("/api/v4/users/me").json()["id"]

    def channel(self, room_name: str) -> str:
        for c in self.mm.get(f"/api/v4/users/me/teams/{self.team}/channels").json():
            if c["name"] == room_name or c["display_name"] == room_name:
                return c["id"]
        r = self.mm.get(f"/api/v4/teams/{self.team}/channels/name/{room_name}")
        r.raise_for_status()
        return r.json()["id"]

    def channels(self, prefix: str = "") -> list[dict]:
        return [c for c in self.mm.get(f"/api/v4/users/me/teams/{self.team}/channels").json() if c["name"].startswith(prefix)]

    def say(self, room_name: str, text: str) -> dict:
        r = self.mm.post("/api/v4/posts", json={"channel_id": self.channel(room_name), "message": text})
        r.raise_for_status()
        return r.json()

    def posts_since(self, channel_id: str, since_ms: int) -> list[dict]:
        posts = self.mm.get(f"/api/v4/channels/{channel_id}/posts", params={"since": since_ms}).json().get("posts", {})
        return sorted(posts.values(), key=lambda p: p["create_at"])
