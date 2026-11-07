"""Everything in one process: the concierge and every seat's negotiator, with new seats picked up as they join.

    python -m handshake
"""
import asyncio

from handshake import negotiator
from handshake.concierge import Concierge


async def main():
    await asyncio.gather(Concierge().run(), negotiator.main([]))


if __name__ == "__main__":
    asyncio.run(main())
