"""AI / LLM configuration status — never exposes API keys."""

from fastapi import APIRouter

from app.core.config import get_settings
from app.services.llm_service import get_llm_status

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
async def ai_status():
    settings = get_settings()
    status = get_llm_status()
    primary = status.get("primary_ready")
    if primary:
        hint = (
            f"Primary LLM: {primary} ({settings.provider_model(primary)}). "
            "Fallback order: " + ", ".join(settings.llm_provider_order) + ". "
            "Fast agentic = 1 LLM call per message."
        )
    else:
        hint = (
            "No cloud LLM ready. Add GROQ_API_KEY (recommended free tier at console.groq.com), "
            "or GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY. "
            "Until then, maintenance chat uses ML + RAG engine."
        )
    return {
        **status,
        "model": settings.provider_model(primary or "gemini"),
        "enable_full_agentic": settings.enable_full_agentic,
        "deployment_hint": hint,
    }
