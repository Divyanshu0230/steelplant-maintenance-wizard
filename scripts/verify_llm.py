#!/usr/bin/env python3
"""Verify LLM providers (no secrets printed). Run from project root."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings
from app.services.llm_service import get_llm_service, get_llm_status


async def main() -> int:
    settings = get_settings()
    status = get_llm_status()

    print("=== LLM provider check ===")
    print(f"Fallback order: {', '.join(settings.llm_provider_order)}")
    print(f"Primary ready:  {status.get('primary_ready') or 'none'}")
    print()

    for name, info in status.get("providers", {}).items():
        flag = "READY" if info["ready"] else ("configured" if info["configured"] else "not set")
        print(f"  {name:12} {flag:12} model={info['model']}")

    if not status.get("any_llm_ready"):
        print("\nFAIL: No LLM provider ready.")
        print("Recommended: GROQ_API_KEY from https://console.groq.com/keys (free, fast)")
        return 1

    primary = status.get("primary_ready") or settings.llm_provider_order[0]
    try:
        text = await get_llm_service().generate(
            "Reply with exactly: LLM_OK",
            "You are a test assistant. Reply briefly.",
        )
        print(f"\nOK: {primary} responded ({len(text)} chars)")
        print("Sample:", text[:80].replace("\n", " "))
        return 0
    except Exception as exc:
        print(f"\nFAIL: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
