"""One command from a fresh clone to a deal ready to run:

    python scripts/up.py

Writes deploy/.env with fresh secrets (first run only), starts Switch 0.31.0 with Mattermost and the Gateway in Docker,
waits for it, and registers the Handshake concierge (the agent that opens deals from #handshake-lobby).
"""
import secrets
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy"
SECRET_KEYS = ["DB_PASSWORD", "DB_OWNER_PASSWORD", "AGENT_REGISTRATION_TOKEN", "GATEWAY_ADMIN_PASSWORD",
               "MATTERMOST_ADMIN_PASSWORD", "MATTERMOST_USER_PASSWORD"]


def env_file():
    env = DEPLOY / ".env"
    if env.exists():
        return
    lines = []
    for line in (DEPLOY / ".env.example").read_text().splitlines():
        key = line.split("=", 1)[0]
        if key == "SWITCH_VERSION":
            line = "SWITCH_VERSION=0.31.0"
        elif key in SECRET_KEYS:
            line = f"{key}={secrets.token_hex(24)}"
        elif key == "SECRET_KEYS":
            line = f"SECRET_KEYS=handshake:{secrets.token_hex(32)}"
        lines.append(line)
    env.write_text("\n".join(lines) + "\n")
    print("wrote deploy/.env")


def main():
    env_file()
    subprocess.run(["docker", "compose", "-f", "standalone-docker-compose.yml", "--env-file", ".env", "-p", "handshake",
                    "--profile", "collab", "--profile", "gateway", "up", "-d"], cwd=DEPLOY, check=True)
    for _ in range(90):
        try:
            if b"ok" in urllib.request.urlopen("http://localhost:8000/health", timeout=3).read():
                break
        except OSError:
            pass
        time.sleep(2)
    # The setup container seeds Mattermost and connects it to Switch; wait for it to finish.
    while "exited" not in subprocess.run(["docker", "compose", "-p", "handshake", "ps", "-a", "setup", "--format", "{{.State}}"],
                                         cwd=DEPLOY, capture_output=True, text=True).stdout:
        time.sleep(3)
    sys.path.insert(0, str(ROOT))
    from handshake import seats
    seats.ensure_concierge()
    print("\nReady. Next:\n  python scripts/join.py you \"Your Name\"     (and one for the other side)\n"
          "  python -m handshake                          (terminal 2: the concierge and every seat's negotiator)\n"
          "Then sign in at http://localhost:8065 and type in #handshake-lobby:\n"
          "  @handshake open a deal with @them about whatever you're agreeing\n"
          "Or watch a whole deal play out: python scripts/demo.py")


if __name__ == "__main__":
    main()
