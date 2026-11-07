"""Opens the live demo to anyone with a link, from the machine running the stack.

    cloudflared tunnel --url http://localhost:8065          # prints https://<random>.trycloudflare.com
    python scripts/public.py https://<random>.trycloudflare.com

Only Mattermost goes public; the Switch API, the Gateway and the database stay on localhost. It tells Mattermost its
public address, turns off open sign-up, and makes one shared visitor account that can sit in the deal room (never the
war rooms). A visitor can watch the agents bargain and try ordering one about: Switch refuses them, because a visitor
is nobody's owner. scripts/live.py then runs a fresh deal every few minutes so there's always something happening.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from handshake.switch_api import mattermost  # noqa: E402
from scripts.bootstrap import ENV  # noqa: E402

VISITOR, VISITOR_PASSWORD = "visitor", "try-to-break-it"  # public on purpose: it's printed on the site


def main(url: str):
    url = url.rstrip("/")
    override = ROOT / "deploy" / "public.override.yml"
    override.write_text(
        "services:\n  mattermost:\n    environment:\n"
        f"      MM_SERVICESETTINGS_SITEURL: {url}\n"
        "      MM_TEAMSETTINGS_ENABLEOPENSERVER: \"false\"\n"
        "      MM_TEAMSETTINGS_ENABLEUSERCREATION: \"false\"\n")
    subprocess.run(["docker", "compose", "-f", "standalone-docker-compose.yml", "-f", "public.override.yml",
                    "--env-file", ".env", "-p", "handshake", "--profile", "collab", "--profile", "gateway",
                    "up", "-d", "mattermost"], cwd=ROOT / "deploy", check=True)
    import time
    for _ in range(60):
        try:
            mm = mattermost(ENV["MATTERMOST_ADMIN_USER"], ENV["MATTERMOST_ADMIN_PASSWORD"])
            break
        except Exception:
            time.sleep(3)
    team = mm.get(f"/api/v4/teams/name/{ENV['MATTERMOST_TEAM_NAME']}").json()
    r = mm.post("/api/v4/users", json={"username": VISITOR, "email": "visitor@handshake.example",
                                       "password": VISITOR_PASSWORD, "first_name": "Visitor", "last_name": "(anyone)"})
    user = r.json() if r.is_success else mm.get(f"/api/v4/users/username/{VISITOR}").json()
    mm.post(f"/api/v4/teams/{team['id']}/members", json={"team_id": team["id"], "user_id": user["id"]})
    deal = mm.get(f"/api/v4/teams/{team['id']}/channels/name/deal-acme-globex").json()
    mm.post(f"/api/v4/channels/{deal['id']}/members", json={"user_id": user["id"]})
    print(f"\nLive: {url}/switch/channels/deal-acme-globex\nSign in: {VISITOR} / {VISITOR_PASSWORD}")


if __name__ == "__main__":
    main(sys.argv[1])
