"""One Switch agent on the agent protocol: a WebSocket in, HTTP out, and a cursor saved after every event so a
restarted agent reopens with start_from=<last sequence> and Switch replays whatever it missed."""
import asyncio
import json
import uuid
from pathlib import Path

import websockets

from handshake.switch_api import Agent

ROOT = Path(__file__).resolve().parent.parent


class AgentLoop:
    def __init__(self, agent: Agent, memory_name: str):
        self.agent = agent
        self.memory = ROOT / f".memory-{memory_name}.json"
        m = json.loads(self.memory.read_text()) if self.memory.exists() else {}
        self.cursor = m.get("cursor", "head")
        self.connection_id = m.get("connection_id", str(uuid.uuid4()))
        self.state = m.get("state", {})
        if m:
            print(f"[{agent.name}] resumed from cursor {self.cursor}")

    def save(self):
        self.memory.write_text(json.dumps({"cursor": self.cursor, "connection_id": self.connection_id, "state": self.state}))

    def on_connected(self):
        pass

    def on_event(self, kind: str, room: str, payload: dict):
        raise NotImplementedError

    async def run(self):
        backoff = 1
        while True:
            url = (f"ws://localhost:8000/agents/{self.agent.id}/connection/ws?connection_id={self.connection_id}"
                   f"&scope=all&filter=all&start_from={self.cursor}")
            try:
                async with websockets.connect(url, additional_headers={"Authorization": f"Bearer {self.agent.key}"},
                                              open_timeout=30) as ws:
                    backoff = 1
                    await self.serve(ws)
            except (OSError, asyncio.TimeoutError, websockets.WebSocketException) as e:
                print(f"[{self.agent.name}] connection dropped ({e}); resuming from {self.cursor}")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 15)

    async def serve(self, ws):
        """Pings are answered here, at once; events go to a worker that handles them one at a time, off the loop."""
        loop, queue = asyncio.get_running_loop(), asyncio.Queue()

        async def worker():
            while True:
                job = await queue.get()
                seq, job = job[0], job[1:]
                try:
                    await loop.run_in_executor(None, job[0], *job[1:])
                except Exception as e:  # one failed call (a 429, a timeout) must not take the agent down
                    print(f"[{self.agent.name}] could not handle that event: {str(e)[:200]}")
                if seq:
                    self.cursor = seq  # saved only once handled, so a crash replays anything unhandled
                self.save()

        task = asyncio.create_task(worker())
        try:
            async for raw in ws:
                f = json.loads(raw)
                ev, data = f.get("event"), f.get("data", {})
                if ev == "ping":
                    await ws.send(json.dumps({"type": "pong", "cursor": int(self.cursor) if str(self.cursor).isdigit() else 0}))
                elif ev == "connection_state":
                    self.agent.connection_id = data["connection_id"]
                    print(f"[{self.agent.name}] connected")
                    queue.put_nowait((None, self.on_connected))
                elif ev == "message" and data.get("type") in ("message", "room_join"):
                    queue.put_nowait((str(data.get("sequence", "")) or None, self.on_event, data["type"], data["room_id"], data["payload"]))
                elif ev == "evicted":
                    print(f"[{self.agent.name}] evicted: {data.get('code')}")
                    return
        finally:
            task.cancel()
