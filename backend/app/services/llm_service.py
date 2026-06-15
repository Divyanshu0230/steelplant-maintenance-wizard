"""Multi-provider LLM — Groq, Gemini, Claude, OpenAI, Grok, Ollama with auto-fallback."""

from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Callable, Optional

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_provider_cooldown_until: dict[str, float] = {}
_last_ai_mode: str = "unknown"
COOLDOWN_SEC = 90


def get_last_ai_mode() -> str:
    return _last_ai_mode


def get_quota_cooldown_remaining() -> int:
    """Max cooldown across providers (legacy compat)."""
    now = time.time()
    if not _provider_cooldown_until:
        return 0
    return max(0, int(max(_provider_cooldown_until.values()) - now))


def _is_rate_limited(err: str) -> bool:
    e = err.lower()
    return any(
        x in e
        for x in ("quota", "rate", "429", "503", "limit", "exceeded", "too many", "capacity")
    )


def get_llm_status() -> dict[str, Any]:
    settings = get_settings()
    now = time.time()
    providers: dict[str, dict[str, Any]] = {}
    any_ready = False
    primary_ready: Optional[str] = None

    for name in settings.llm_provider_order:
        configured = settings.provider_configured(name)
        cooldown = max(0, int(_provider_cooldown_until.get(name, 0) - now))
        if name == "ollama":
            ready = cooldown == 0
        else:
            ready = configured and cooldown == 0

        if ready and primary_ready is None and name != "ollama":
            primary_ready = name
        if ready:
            any_ready = True

        providers[name] = {
            "configured": configured,
            "ready": ready,
            "cooldown_seconds": cooldown,
            "model": settings.provider_model(name),
        }

    return {
        "gemini_configured": settings.provider_configured("gemini"),
        "gemini_key_valid_format": settings.gemini_key_valid,
        "gemini_ready": providers.get("gemini", {}).get("ready", False),
        "quota_cooldown_seconds": get_quota_cooldown_remaining(),
        "last_ai_mode": _last_ai_mode,
        "provider": settings.llm_provider,
        "fallback_order": settings.llm_provider_order,
        "providers": providers,
        "any_llm_ready": any_ready or settings.provider_configured("ollama"),
        "primary_ready": primary_ready,
        "ollama_url": settings.ollama_base_url,
    }


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        history: Optional[list[dict[str, str]]] = None,
    ) -> str:
        global _last_ai_mode
        errors: list[str] = []
        order = self.settings.llm_provider_order

        handlers: dict[str, Callable[..., Any]] = {
            "groq": self._generate_groq,
            "gemini": self._generate_gemini,
            "anthropic": self._generate_anthropic,
            "openai": self._generate_openai,
            "xai": self._generate_xai,
            "ollama": self._generate_ollama,
        }

        for provider in order:
            if not self.settings.provider_configured(provider) and provider != "ollama":
                continue
            if provider == "ollama" and provider not in order:
                continue
            if _provider_cooldown_until.get(provider, 0) > time.time():
                errors.append(f"{provider}: cooldown {_provider_cooldown_until[provider] - time.time():.0f}s")
                continue

            handler = handlers.get(provider)
            if not handler:
                continue

            for attempt in range(3 if provider != "ollama" else 1):
                try:
                    text = await handler(prompt, system_prompt, json_mode, history)
                    _last_ai_mode = provider
                    return text
                except Exception as exc:
                    err = str(exc)
                    errors.append(f"{provider} attempt {attempt + 1}: {err[:200]}")
                    if _is_rate_limited(err):
                        _provider_cooldown_until[provider] = time.time() + COOLDOWN_SEC
                        logger.warning("%s rate limited — cooldown %ss", provider, COOLDOWN_SEC)
                        break
                    if attempt < 2 and ("503" in err or "timeout" in err.lower()):
                        await asyncio.sleep(2 ** attempt)
                        continue
                    break

        _last_ai_mode = "offline"
        raise RuntimeError(f"All LLM providers failed: {'; '.join(errors)}")

    async def _generate_openai_compatible(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        prompt: str,
        system_prompt: Optional[str],
        json_mode: bool,
        history: Optional[list[dict[str, str]]],
        provider_label: str,
    ) -> str:
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            for msg in history[-8:]:
                role = "assistant" if msg.get("role") == "assistant" else "user"
                messages.append({"role": role, "content": msg["content"][:1500]})
        user_content = prompt
        if json_mode:
            user_content += "\n\nRespond with valid JSON only. No markdown fences."
        messages.append({"role": "user", "content": user_content})

        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        url = f"{base_url.rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"{provider_label} HTTP {response.status_code}: {response.text[:300]}")
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def _generate_groq(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, history: Optional[list]
    ) -> str:
        return await self._generate_openai_compatible(
            base_url="https://api.groq.com/openai/v1",
            api_key=self.settings.groq_api_key or "",
            model=self.settings.groq_model,
            prompt=prompt,
            system_prompt=system_prompt,
            json_mode=json_mode,
            history=history,
            provider_label="Groq",
        )

    async def _generate_openai(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, history: Optional[list]
    ) -> str:
        return await self._generate_openai_compatible(
            base_url="https://api.openai.com/v1",
            api_key=self.settings.openai_api_key or "",
            model=self.settings.openai_model,
            prompt=prompt,
            system_prompt=system_prompt,
            json_mode=json_mode,
            history=history,
            provider_label="OpenAI",
        )

    async def _generate_xai(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, history: Optional[list]
    ) -> str:
        return await self._generate_openai_compatible(
            base_url="https://api.x.ai/v1",
            api_key=self.settings.xai_api_key or "",
            model=self.settings.xai_model,
            prompt=prompt,
            system_prompt=system_prompt,
            json_mode=json_mode,
            history=history,
            provider_label="xAI",
        )

    async def _generate_anthropic(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, history: Optional[list]
    ) -> str:
        messages: list[dict[str, str]] = []
        if history:
            for msg in history[-8:]:
                role = "assistant" if msg.get("role") == "assistant" else "user"
                messages.append({"role": role, "content": msg["content"][:1500]})
        user_content = prompt
        if json_mode:
            user_content += "\n\nRespond with valid JSON only. No markdown fences."
        messages.append({"role": "user", "content": user_content})

        payload: dict[str, Any] = {
            "model": self.settings.anthropic_model,
            "max_tokens": 4096,
            "messages": messages,
        }
        if system_prompt:
            payload["system"] = system_prompt

        headers = {
            "x-api-key": self.settings.anthropic_api_key or "",
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages", headers=headers, json=payload
            )
            if response.status_code != 200:
                raise RuntimeError(f"Anthropic HTTP {response.status_code}: {response.text[:300]}")
            data = response.json()
            blocks = data.get("content", [])
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")

    async def _generate_gemini(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, history: Optional[list]
    ) -> str:
        if not self.settings.gemini_key_valid:
            raise RuntimeError("Gemini API key invalid (must start with AIza)")

        model = self.settings.gemini_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

        contents: list[dict[str, Any]] = []
        if history:
            for msg in history[-8:]:
                role = "model" if msg.get("role") == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"][:1500]}]})

        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        if json_mode:
            full_prompt += "\n\nRespond with valid JSON only. No markdown fences."
        contents.append({"role": "user", "parts": [{"text": full_prompt}]})

        payload: dict[str, Any] = {"contents": contents}
        if system_prompt and not history:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        headers = {
            "x-goog-api-key": self.settings.gemini_api_key or "",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"Gemini HTTP {response.status_code}: {response.text[:300]}")
            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("No candidates in Gemini response")
            return candidates[0]["content"]["parts"][0]["text"]

    async def _generate_ollama(
        self, prompt: str, system_prompt: Optional[str], json_mode: bool, history: Optional[list]
    ) -> str:
        _ = json_mode, history
        payload = {
            "model": self.settings.ollama_model,
            "prompt": f"{system_prompt or ''}\n\n{prompt}",
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.settings.ollama_base_url}/api/generate", json=payload
            )
            response.raise_for_status()
            return response.json().get("response", "")

    @staticmethod
    def extract_json(text: str) -> dict[str, Any]:
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                return json.loads(match.group())
            return {}


def get_llm_service() -> LLMService:
    return LLMService()
