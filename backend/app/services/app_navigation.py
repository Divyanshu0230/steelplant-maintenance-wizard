"""Application navigation map — injected into the plant assistant for UI help."""

from __future__ import annotations

from typing import Optional

APP_NAVIGATION: list[dict[str, str | list[str]]] = [
    {
        "route": "/",
        "label": "Overview",
        "aliases": ["command center", "dashboard", "home", "plant floor"],
        "description": "Command center with fleet KPIs, plant floor map, active alerts, and health trends.",
    },
    {
        "route": "/equipment",
        "label": "Equipment Fleet",
        "aliases": ["equipment", "fleet", "assets", "machines"],
        "description": "Browse all plant assets with health gauges, risk levels, and RUL.",
    },
    {
        "route": "/live",
        "label": "Live Monitoring",
        "aliases": [
            "live monitor",
            "live monitoring",
            "live sensors",
            "real-time",
            "sensor stream",
            "monitoring center",
        ],
        "description": "Real-time sensor readings, live charts, and streaming equipment telemetry.",
    },
    {
        "route": "/diagnosis",
        "label": "AI Diagnosis",
        "aliases": ["diagnosis", "diagnose", "failure analysis", "rca"],
        "description": "Structured AI diagnosis workflow for equipment faults.",
    },
    {
        "route": "/priority",
        "label": "Priority Queue",
        "aliases": ["priority", "maintenance queue", "work orders"],
        "description": "Ranked maintenance priorities based on risk and plant impact.",
    },
    {
        "route": "/chat",
        "label": "AI Assistant",
        "aliases": ["assistant", "chat", "ask ai", "maintenance wizard"],
        "description": "Conversational AI for plant navigation, operations help, and equipment diagnosis.",
    },
    {
        "route": "/knowledge",
        "label": "Knowledge Base",
        "aliases": ["knowledge", "manuals", "sops", "documents"],
        "description": "Maintenance manuals, SOPs, and searchable technical documents.",
    },
    {
        "route": "/logbook",
        "label": "Maintenance Logbook",
        "aliases": ["logbook", "maintenance log", "work history"],
        "description": "Record and review maintenance actions and AI-assisted diagnoses.",
    },
    {
        "route": "/spare-parts",
        "label": "Spare Parts",
        "aliases": ["spares", "spare parts", "inventory"],
        "description": "Spare parts inventory, stock levels, and part details.",
    },
    {
        "route": "/procurement",
        "label": "Procurement",
        "aliases": ["procurement", "purchase", "ordering"],
        "description": "Create and track spare-part procurement requests.",
    },
    {
        "route": "/agents",
        "label": "AI Pipeline",
        "aliases": ["agents", "ai pipeline", "agentic", "ml pipeline"],
        "description": "View the multi-agent AI maintenance pipeline and agent status.",
    },
    {
        "route": "/reports",
        "label": "Reports",
        "aliases": ["reports", "pdf", "maintenance reports"],
        "description": "Generate and download maintenance summary reports.",
    },
    {
        "route": "/future-enhancements",
        "label": "Future Enhancements",
        "aliases": ["future", "roadmap", "enhancements", "planned features"],
        "description": "Planned production extensions for the Maintenance Wizard platform.",
    },
]


def navigation_prompt_block(current_page: Optional[str] = None) -> str:
    lines = ["## Tata Steel Maintenance Wizard — Application Sections\n"]
    for item in APP_NAVIGATION:
        aliases = ", ".join(item["aliases"][:4])  # type: ignore[index]
        marker = " (user is here)" if current_page and item["route"] == current_page else ""
        lines.append(
            f"- **{item['label']}** → `{item['route']}`{marker}\n"
            f"  {item['description']}\n"
            f"  Also known as: {aliases}"
        )
    return "\n".join(lines)


def find_nav_match(query: str) -> Optional[dict[str, str | list[str]]]:
    q = query.lower()
    for item in APP_NAVIGATION:
        label = str(item["label"]).lower()
        if label in q:
            return item
        for alias in item["aliases"]:  # type: ignore[union-attr]
            if alias in q:
                return item
    if "live" in q and ("monitor" in q or "section" in q or "where" in q):
        for item in APP_NAVIGATION:
            if item["route"] == "/live":
                return item
    return None
