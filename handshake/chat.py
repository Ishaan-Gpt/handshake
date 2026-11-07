"""Posting as a person in the bundled Mattermost, for the demo driver and the leak test.
(People normally just type in Mattermost; this does the same through its API.)
"""
import json
from pathlib import Path

from handshake.switch_api import mattermost

ROOT = Path(__file__).resolve().parent.parent


class Person:
    def __init__(self, side: str):
        s = json.loads((ROOT / ".state.json").read_text())
        self.side, self.state = side, s
        self.user = {"acme": "asha", "globex": "gil"}[side]
        self.mm = mattermost(self.user, s[side]["password"])
        self.team = s["team_id"]

    def channel(self, room_name: str) -> str:
        r = self.mm.get(f"/api/v4/teams/{self.team}/channels/name/{room_name}")
        if r.status_code == 404:  # private channels are found through the person's own memberships
            for c in self.mm.get(f"/api/v4/users/me/teams/{self.team}/channels").json():
                if c["name"] == room_name or c["display_name"] == room_name:
                    return c["id"]
        r.raise_for_status()
        return r.json()["id"]

    def say(self, room_name: str, text: str) -> dict:
        r = self.mm.post("/api/v4/posts", json={"channel_id": self.channel(room_name), "message": text})
        r.raise_for_status()
        return r.json()
