#!/usr/bin/env python3
"""Verify Gemini API key without printing secrets. Run from project root."""
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

    print("=== Gemini API check ===")
    print(f"Configured:     {status['gemini_configured']}")
    print(f"Valid format:   {status['gemini_key_valid_format']}  (must start with AIza)")
    print(f"Model:          {settings.gemini_model}")
    print(f"Full agentic:   {settings.enable_full_agentic}")
    print(f"Quota cooldown: {status['quota_cooldown_seconds']}s")

    if not status["gemini_configured"]:
        print("\nFAIL: Set GEMINI_API_KEY in .env or host environment.")
        print("Get a key: https://aistudio.google.com/apikey")
        return 1

    if not status["gemini_key_valid_format"]:
        print("\nFAIL: Key format invalid. Google AI Studio keys start with 'AIza'.")
        print("Replace GEMINI_API_KEY in .env with a key from https://aistudio.google.com/apikey")
        return 1

    try:
        text = await get_llm_service().generate(
            "Reply with exactly: GEMINI_OK",
            "You are a test assistant. Reply briefly.",
        )
        print(f"\nOK: Gemini responded ({len(text)} chars)")
        print("Sample:", text[:80].replace("\n", " "))
        return 0
    except Exception as exc:
        print(f"\nFAIL: API call failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
