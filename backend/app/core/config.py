from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[3]


def _looks_like_google_ai_key(key: Optional[str]) -> bool:
    """Google AI Studio keys: classic AIza… or newer AQ.… format."""
    if not key or len(key.strip()) < 20:
        return False
    k = key.strip()
    return k.startswith("AIza") or k.startswith("AQ.")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SteelPlant Maintenance Wizard"
    app_version: str = "1.0.0"
    debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str = f"sqlite+aiosqlite:///{BASE_DIR}/data/steelplant.db"
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    gemini_api_key: Optional[str] = Field(default=None, validation_alias="GEMINI_API_KEY")
    google_api_key: Optional[str] = Field(default=None, validation_alias="GOOGLE_API_KEY")
    gemini_model: str = "gemini-2.0-flash"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    llm_provider: str = "auto"  # auto | groq | gemini | anthropic | openai | xai | ollama
    llm_fallback_order: str = "groq,gemini,anthropic,openai,xai,ollama"
    enable_full_agentic: bool = True

    # Groq — free tier, fast (https://console.groq.com)
    groq_api_key: Optional[str] = Field(default=None, validation_alias="GROQ_API_KEY")
    groq_model: str = "llama-3.3-70b-versatile"

    # Anthropic Claude (https://console.anthropic.com)
    anthropic_api_key: Optional[str] = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    anthropic_model: str = "claude-3-5-haiku-latest"

    # OpenAI (https://platform.openai.com)
    openai_api_key: Optional[str] = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_model: str = "gpt-4o-mini"

    # xAI Grok (https://console.x.ai)
    xai_api_key: Optional[str] = Field(default=None, validation_alias="XAI_API_KEY")
    xai_model: str = "grok-2-latest"

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    qdrant_path: str = str(BASE_DIR / "data" / "qdrant")
    qdrant_collection: str = "maintenance_knowledge"

    redis_url: Optional[str] = None
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    data_dir: Path = BASE_DIR / "data"
    models_dir: Path = BASE_DIR / "data" / "models"
    documents_dir: Path = BASE_DIR / "data" / "documents"

    @model_validator(mode="after")
    def merge_api_keys(self) -> "Settings":
        if not self.gemini_api_key and self.google_api_key:
            self.gemini_api_key = self.google_api_key
        return self

    @property
    def gemini_key_valid(self) -> bool:
        return _looks_like_google_ai_key(self.gemini_api_key)

    @property
    def llm_provider_order(self) -> list[str]:
        allowed = {"groq", "gemini", "anthropic", "openai", "xai", "ollama"}
        if self.llm_provider != "auto":
            return [self.llm_provider] if self.llm_provider in allowed else ["groq", "gemini", "ollama"]
        return [p.strip() for p in self.llm_fallback_order.split(",") if p.strip() in allowed]

    def provider_configured(self, provider: str) -> bool:
        if provider == "groq":
            return bool(self.groq_api_key and self.groq_api_key.startswith("gsk_"))
        if provider == "gemini":
            return self.gemini_key_valid
        if provider == "anthropic":
            return bool(self.anthropic_api_key and self.anthropic_api_key.startswith("sk-ant"))
        if provider == "openai":
            return bool(self.openai_api_key and self.openai_api_key.startswith("sk-"))
        if provider == "xai":
            return bool(self.xai_api_key and len(self.xai_api_key) > 20)
        if provider == "ollama":
            return True
        return False

    def provider_model(self, provider: str) -> str:
        return {
            "groq": self.groq_model,
            "gemini": self.gemini_model,
            "anthropic": self.anthropic_model,
            "openai": self.openai_model,
            "xai": self.xai_model,
            "ollama": self.ollama_model,
        }.get(provider, "")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
