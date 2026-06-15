"""Format maintenance answers as step-wise markdown for the UI."""

from __future__ import annotations

import re
from typing import Any, Optional


def extract_follow_ups(text: str) -> list[str]:
    suggestions: list[str] = []
    in_section = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("## follow-up"):
            in_section = True
            continue
        if in_section and stripped.startswith("##"):
            break
        if in_section and stripped.startswith("->"):
            suggestions.append(stripped.lstrip("-> ").strip())
        elif in_section and stripped and not stripped.startswith("#"):
            suggestions.append(stripped)
    return suggestions[:5]


def _is_spare_query(query: str) -> bool:
    q = query.lower()
    return bool(re.search(r"\bspare\b|\bparts?\b|\border\b|\bprocure\b|\bstock\b|\binventory\b", q))


def _is_sop_query(query: str) -> bool:
    q = query.lower()
    return bool(re.search(r"\bsop\b|\bmanual\b|\bprocedure\b|\bsection\b|\brelevant\b|\bdocument\b", q))


def _is_safe_query(query: str) -> bool:
    q = query.lower()
    return bool(re.search(r"\bsafe\b|\bkeep\s+running\b|\bshutdown\b|\bstop\b|\bcontinue\b", q))


def _citation_title(source: str) -> str:
    return (
        source.replace(".pdf", "")
        .replace(".md", "")
        .replace("tata_", "")
        .replace("_", " ")
        .strip()
        .title()
    )


def _follow_ups_for_query(query: str) -> list[str]:
    if _is_spare_query(query):
        return [
            "Is it safe to keep running?",
            "Show me the relevant SOP section",
            "What should I do next?",
        ]
    if _is_sop_query(query):
        return [
            "What spare parts should I order?",
            "Is it safe to keep running?",
            "Summary of issues",
        ]
    if _is_safe_query(query):
        return [
            "What spare parts should I order?",
            "Show me the relevant SOP section",
            "What should I do next?",
        ]
    return [
        "What spare parts should I order?",
        "Is it safe to keep running?",
        "Show me the relevant SOP section",
    ]


def build_fast_pipeline_steps(state: dict[str, Any]) -> list[str]:
    """Agent trace for the optimized single-LLM maintenance pipeline."""
    steps = [
        "Intent Router: Maintenance / follow-up detected",
        "Document Agent: RAG retrieval from manuals & SOPs",
        "Domain SLM: Steel fault pattern analysis",
        "Predictive Agent: Isolation Forest + RUL models",
        "Operational Intel: SCADA faults & delay logs",
        "Risk Engine: Criticality-weighted assessment",
        "Planner Agent: Prioritized maintenance actions",
        "Spare Parts Agent: Inventory & procurement scan",
    ]
    steps.append("Synthesizer: Agentic AI reasoning")
    if state.get("anomaly_detected"):
        steps.append(f"Alert Agent: Anomaly flagged — severity {state.get('risk_level', 'medium')}")
    return steps


def build_agent_steps(state: dict[str, Any]) -> list[str]:
    trace = state.get("agent_trace") or []
    if trace:
        steps = ["Supervisor Agent: Autonomous routing active"]
        for entry in trace:
            agent = entry.get("agent", "agent")
            action = entry.get("action", "run")
            detail = entry.get("detail", "")
            label = agent.replace("_", " ").title()
            steps.append(f"{label}: {action}" + (f" — {detail}" if detail else ""))
        steps.append(
            f"Agentic AI: {len(state.get('completed_agents', []))} agents completed"
        )
        return steps

    steps = ["Document Agent: Retrieved knowledge base excerpts"]
    if state.get("domain_model_active"):
        patterns = state.get("matched_patterns") or []
        steps.append(
            f"Domain SLM: Steel expert layer active ({len(patterns)} fault pattern(s) matched)"
        )
    causes = state.get("probable_causes", [])
    if causes:
        steps.append(f"RCA Agent: Identified {len(causes)} probable cause(s)")
    if state.get("failure_probability") is not None:
        steps.append(
            f"Predictive Agent: RUL {state.get('rul_cycles', '?')} cycles, "
            f"failure risk {float(state.get('failure_probability', 0)):.0%}"
        )
    actions = state.get("maintenance_actions", [])
    if actions:
        steps.append(f"Planner Agent: {len(actions)} maintenance action(s) ranked")
    spares = state.get("spare_recommendations", [])
    if spares:
        steps.append(f"Spare Parts Agent: {len(spares)} part recommendation(s)")
    if state.get("alerts"):
        steps.append(f"Alert Agent: {len(state['alerts'])} alert(s) generated")
    steps.append("Response: Agentic AI synthesis")
    return steps


def _metrics_block(
    *,
    risk_level: str,
    failure_probability: Optional[float],
    rul_cycles: Optional[int],
) -> list[str]:
    lines = ["## Key metrics", ""]
    if failure_probability is not None:
        lines.append(f"- **Failure probability:** {failure_probability:.0%}")
    if rul_cycles is not None:
        lines.append(f"- **Remaining useful life:** ~{rul_cycles} cycles")
    lines.append(f"- **Risk level:** {risk_level.upper()}")
    return lines


def format_structured_answer(
    *,
    query: str,
    equipment_code: Optional[str],
    answer: str,
    causes: list[dict],
    actions: list[dict],
    risk_level: str,
    failure_probability: Optional[float],
    rul_cycles: Optional[int],
    ai_mode: str = "agentic",
    spare_recommendations: Optional[list[dict]] = None,
    citations: Optional[list[dict]] = None,
) -> str:
    """Build a query-specific maintenance answer — not the same template every time."""
    code = equipment_code or "equipment"
    spares = spare_recommendations or []
    cites = citations or []
    follow_ups = _follow_ups_for_query(query)

    if _is_spare_query(query):
        lines = [
            f"## Spare parts for {code}",
            "",
            f"Based on your question: *{query.strip()}*",
            "",
        ]
        if spares:
            for i, s in enumerate(spares[:8], 1):
                name = s.get("part") or s.get("part_name") or s.get("part_code") or "Part"
                part_code = s.get("part_code", "")
                qty = s.get("quantity_recommended", s.get("quantity", "—"))
                lead = s.get("lead_time_days", "—")
                avail = s.get("quantity_available")
                stock = f" · {avail} in stock" if avail is not None else ""
                lines.append(
                    f"{i}. **{name}** (`{part_code}`) — recommend qty **{qty}**, "
                    f"lead time {lead}d{stock}"
                )
                if s.get("rationale"):
                    lines.append(f"   - {s['rationale']}")
        else:
            lines.append(
                "No specific spare parts were flagged in inventory for this fault profile. "
                "Check bearing seals and drive belts for blower assets per the maintenance manual."
            )
        if causes:
            lines.extend(["", "## Linked to these causes", ""])
            for c in causes[:2]:
                conf = float(c.get("confidence", 0.5) if not isinstance(c.get("confidence"), str) else 0.5)
                lines.append(f"- {c.get('cause', 'Unknown')} ({conf:.0%})")
        lines.extend(["", *_metrics_block(risk_level=risk_level, failure_probability=failure_probability, rul_cycles=rul_cycles)])
        lines.extend(["", "## Follow-up Questions", *[f"-> {f}" for f in follow_ups]])
        return "\n".join(lines)

    if _is_sop_query(query):
        lines = [
            f"## Relevant SOP & manual sections for {code}",
            "",
            f"Based on your question: *{query.strip()}*",
            "",
        ]
        if cites:
            for c in cites[:4]:
                title = _citation_title(str(c.get("source", "Manual")))
                excerpt = (c.get("excerpt") or "").strip()
                score = c.get("relevance_score", 0)
                pct = f"{float(score) * 100:.0f}%" if float(score) <= 1 else str(score)
                lines.append(f"### {title} ({pct} match)")
                lines.append(excerpt[:450] if excerpt else "_Open the manual in Knowledge for the full section._")
                lines.append("")
        else:
            lines.append(
                "No manual excerpt was retrieved for this query. Open the **Knowledge** page "
                f"and search for `{code}` blower maintenance SOP."
            )
        if actions:
            lines.extend(["## Related maintenance steps", ""])
            for i, a in enumerate(actions[:3], 1):
                lines.append(f"{i}. {a.get('action', '')} ({a.get('timeframe', 'ASAP')})")
        lines.extend(["", *_metrics_block(risk_level=risk_level, failure_probability=failure_probability, rul_cycles=rul_cycles)])
        lines.extend(["", "## Follow-up Questions", *[f"-> {f}" for f in follow_ups]])
        return "\n".join(lines)

    if _is_safe_query(query):
        urgent = risk_level in ("critical", "high") or (
            failure_probability is not None and failure_probability >= 0.6
        )
        verdict = (
            "**Not recommended** to keep running without inspection. Plan a controlled shutdown or reduced load."
            if urgent
            else "**Acceptable to continue** with enhanced monitoring and a near-term inspection window."
        )
        lines = [
            f"## Safety assessment for {code}",
            "",
            verdict,
            "",
            *_metrics_block(risk_level=risk_level, failure_probability=failure_probability, rul_cycles=rul_cycles),
        ]
        if causes:
            lines.extend(["", "## Primary concern", ""])
            c0 = causes[0]
            conf = float(c0.get("confidence", 0.5) if not isinstance(c0.get("confidence"), str) else 0.5)
            lines.append(f"- {c0.get('cause', 'Unknown')} ({conf:.0%} confidence)")
        if actions:
            lines.extend(["", "## Recommended before next run", ""])
            for i, a in enumerate(actions[:3], 1):
                lines.append(f"{i}. {a.get('action', '')} ({a.get('timeframe', 'ASAP')})")
        lines.extend(["", "## Follow-up Questions", *[f"-> {f}" for f in follow_ups]])
        return "\n".join(lines)

    # Default — summary / general maintenance question
    lead = answer.split("\n\n")[0][:500].strip() if answer else f"Maintenance assessment for {code}."
    if lead.lower().startswith("agentic analysis for"):
        lead = f"Assessment for **{code}** based on live sensors, ML models, and plant manuals."

    lines = [
        "## Summary",
        lead,
        "",
        *_metrics_block(risk_level=risk_level, failure_probability=failure_probability, rul_cycles=rul_cycles),
        "",
        "## Key findings",
    ]
    for c in causes[:4]:
        conf = c.get("confidence", 0.5)
        if isinstance(conf, str):
            conf = 0.5
        lines.append(f"- {c.get('cause', 'Unknown')} ({float(conf):.0%} confidence)")

    lines.extend(["", "## Recommended actions"])
    if actions:
        for i, a in enumerate(actions[:4], 1):
            lines.append(f"{i}. {a.get('action', 'Inspect equipment')} ({a.get('timeframe', 'ASAP')})")
    else:
        lines.append("1. Inspect equipment and verify sensor readings against SOP")

    lines.extend(["", "## Follow-up Questions", *[f"-> {f}" for f in follow_ups]])
    return "\n".join(lines)
