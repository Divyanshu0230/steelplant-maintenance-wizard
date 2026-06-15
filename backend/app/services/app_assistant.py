"""Lightweight plant assistant — navigation, app help, and general Q&A (no maintenance agents)."""

from __future__ import annotations

import re
from typing import Any, Optional

from app.services.app_navigation import APP_NAVIGATION, find_nav_match, navigation_prompt_block
from app.services.llm_service import get_last_ai_mode, get_llm_service

ASSISTANT_SYSTEM = """You are the Tata Steel Maintenance Wizard **AI Agentic Assistant** — a helpful, concise guide \
for the maintenance command-center web application.

You help plant engineers with:
1. **Navigation** — finding pages and features in the app
2. **App usage** — explaining what each section does
3. **General questions** — capabilities, workflows, how to get started

You are NOT diagnosing equipment in this mode unless the user explicitly asks about a specific fault.

Rules:
- If the user greets you (hi, hello, hey, good morning, etc. — any spelling or casing), reply with a warm \
  greeting first. Mirror their tone. Do NOT describe their current page or list app sections unless they asked.
- Answer in clear, short markdown (2-6 sentences for simple questions)
- For navigation questions, name the exact nav label and route, e.g. **Live Monitoring** at `/live`
- Include a clickable markdown link when pointing to a section: [Live Monitoring](/live)
- If the user is already on a page (marked "user is here"), acknowledge that only when relevant to their question
- Do NOT invent sensor readings, RUL, or maintenance actions
- Do NOT wrap answers in "## Summary / Key Findings / Recommended Actions" unless listing multiple steps
- End navigation answers with one practical next step

{nav_map}
"""

GREETING_SYSTEM = """You are the **AI Agentic Assistant** for Tata Steel Maintenance Wizard.

The user sent a casual short message — a greeting, thanks, or brief chitchat.

Rules:
- Understand their intent naturally (hi, Hi, hI, hello!, hey there, thanks, ok, etc.)
- Reply warmly and conversationally — greet them back if they greeted you
- Keep it to 1-3 short sentences; be human, not robotic
- Do NOT describe their current page, navigation map, or equipment data
- You may briefly note you help with plant navigation, equipment diagnosis, and maintenance — one line max
- No "## Summary" headings; no bullet lists unless they asked a question
"""


def _offline_navigation_answer(message: str, current_page: Optional[str]) -> str:
    match = find_nav_match(message)
    if match:
        route = match["route"]
        label = match["label"]
        desc = match["description"]
        here = " You're already on this page." if current_page == route else ""
        return (
            f"**{label}** is in the top navigation bar.{here}\n\n"
            f"{desc}\n\n"
            f"Go directly: [{label}]({route})"
        )
    lines = ["Here are the main sections in the Maintenance Wizard:\n"]
    for item in APP_NAVIGATION[:6]:
        lines.append(f"- [{item['label']}]({item['route']}) — {item['description']}")
    lines.append("\nUse the top navigation bar, or ask me about a specific section like Live Monitoring.")
    return "\n".join(lines)


def _greeting_answer(message: str) -> str:
    msg = re.sub(r"[^\w\s]", "", message.strip().lower()).strip()
    if msg in {"thanks", "thank you"}:
        return "You're welcome! Ask me anything about the plant, equipment, or where to find features in the app."
    if msg in {"ok", "okay"}:
        return "Got it. What would you like to explore next?"
    return (
        "Hi! Hello — I'm your **AI Agentic Assistant** for the Tata Steel Maintenance Wizard.\n\n"
        "I can help you **navigate the app**, **diagnose equipment**, or answer maintenance questions. "
        "Try a quick prompt below, or ask me anything."
    )


async def run_app_assistant(
    message: str,
    *,
    intent: str,
    current_page: Optional[str] = None,
    equipment_code: Optional[str] = None,
    history: Optional[list[dict[str, str]]] = None,
) -> dict[str, Any]:
    if intent == "greeting":
        try:
            answer = await get_llm_service().generate(
                message,
                GREETING_SYSTEM,
                history=history or [],
            )
            ai_mode = get_last_ai_mode()
        except Exception:
            answer = _greeting_answer(message)
            ai_mode = "agentic"
        source = "assistant_agentic"
        return {
            "answer": answer.strip(),
            "ai_mode": ai_mode,
            "intent": intent,
            "agent_steps": [
                "Intent Router: Casual message detected",
                "Agentic AI: Natural conversational reply",
            ],
            "navigation_links": [],
            "risk_level": "low",
            "confidence_score": 0.95,
            "response_source": source,
        }

    nav_block = navigation_prompt_block(current_page)
    context_bits = []
    if current_page:
        context_bits.append(f"User's current page: {current_page}")
    if equipment_code and intent != "navigation":
        context_bits.append(f"Equipment context (optional, do not force into answer): {equipment_code}")

    system = ASSISTANT_SYSTEM.format(nav_map=nav_block)
    if context_bits:
        system += "\n\n" + "\n".join(context_bits)

    user_prompt = message
    if intent == "navigation":
        match = find_nav_match(message)
        if match:
            user_prompt = (
                f"{message}\n\n"
                f"[Hint: user likely wants {match['label']} at {match['route']}]"
            )

    try:
        answer = await get_llm_service().generate(
            user_prompt,
            system,
            history=history or [],
        )
        ai_mode = get_last_ai_mode()
    except Exception:
        if intent == "navigation":
            answer = _offline_navigation_answer(message, current_page)
        elif intent == "greeting":
            answer = (
                "Hello! I'm the Tata Steel Maintenance Wizard assistant. "
                "I can help you navigate the app, explain features, or diagnose equipment issues. "
                "Try: *Where is Live Monitoring?* or switch to **Diagnosis mode** for equipment analysis."
            )
        else:
            answer = (
                "I'm the Maintenance Wizard assistant for Tata Steel's command center. "
                "I can guide you to any section (Overview, Live Monitoring, Equipment, AI Diagnosis, etc.) "
                "or run full agentic diagnosis when you switch to Diagnosis mode."
            )
        ai_mode = "agentic"

    nav_links = []
    for item in APP_NAVIGATION:
        label = str(item["label"]).lower()
        if label in answer.lower() or str(item["route"]) in answer:
            nav_links.append({"label": item["label"], "route": item["route"]})

    source = "assistant_agentic" if intent in ("greeting", "navigation") else (
        "ml_rag_engine" if ai_mode == "enhanced_offline" else "agentic_ai"
    )
    return {
        "answer": answer.strip(),
        "ai_mode": ai_mode,
        "intent": intent,
        "agent_steps": _assistant_steps(intent),
        "navigation_links": nav_links[:4],
        "risk_level": "low",
        "confidence_score": 0.92,
        "response_source": source,
    }


def _assistant_steps(intent: str) -> list[str]:
    if intent == "navigation":
        return [
            "Intent Router: Navigation help detected",
            "App Assistant: Loaded application section map",
            "Response: Direct navigation guidance (no maintenance agents)",
        ]
    if intent == "greeting":
        return [
            "Intent Router: Casual message detected",
            "Agentic AI: Natural conversational reply",
        ]
    return [
        "Intent Router: General app assistance",
        "App Assistant: Answering from application knowledge",
    ]
