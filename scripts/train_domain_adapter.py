#!/usr/bin/env python3
"""Train steel domain adapter profile — FR1 bonus: fine-tune domain-specific model.

Combines:
  - Operational fault codes (steel plant SOPs)
  - C-MAPSS-trained ML thresholds (ISO 10816 vibration zones)
  - Engineer feedback learnings (diagnosis ratings + corrections)
"""

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.db.database import AsyncSessionLocal
from app.services.domain_adaptation_service import get_domain_adaptation_service


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await get_domain_adaptation_service().retrain(db)
        await db.commit()
    print("Domain adapter trained:", result)


if __name__ == "__main__":
    asyncio.run(main())
