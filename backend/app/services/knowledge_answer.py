"""Format and synthesize knowledge-base answers for the Knowledge page."""

from __future__ import annotations

import re
from typing import Any, Optional

from app.rag.vector_store import RetrievedChunk


def _title_from_source(source: str) -> str:
    base = (
        source.replace(".pdf", "")
        .replace(".md", "")
        .replace(".txt", "")
        .replace("tata_", "")
        .replace("_", " ")
        .strip()
    )
    return base.title() if base else "Document"


def dedupe_citations(chunks: list[RetrievedChunk]) -> list[dict[str, Any]]:
    """One citation per source — keep highest-scoring chunk."""
    by_source: dict[str, dict[str, Any]] = {}
    for chunk in chunks:
        source = str(chunk.metadata.get("source", "unknown"))
        key = source.strip().lower()
        entry = {
            "source": source,
            "document_type": str(chunk.metadata.get("document_type", "document")),
            "excerpt": chunk.text.strip()[:500],
            "relevance_score": round(float(chunk.score), 3),
        }
        existing = by_source.get(key)
        if not existing or entry["relevance_score"] > existing["relevance_score"]:
            by_source[key] = entry
    return sorted(by_source.values(), key=lambda c: c["relevance_score"], reverse=True)


def _clean_excerpt(text: str, max_len: int = 420) -> str:
    cleaned = re.sub(r"^#{1,6}\s+", "", text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if len(cleaned) > max_len:
        return f"{cleaned[: max_len - 1]}…"
    return cleaned


def _role_hint(role: str) -> str:
    if role == "operator":
        return "Give short, safety-first steps for a floor operator."
    if role == "engineer":
        return "Give technical RCA steps, sensor checks, and spare parts."
    if role == "manager":
        return "Summarize downtime risk, cost impact, and scheduling priority."
    return "Give a clear, practical maintenance answer."


def format_excerpts_for_llm(chunks: list[RetrievedChunk]) -> str:
    parts = []
    for i, chunk in enumerate(chunks[:5], 1):
        source = chunk.metadata.get("source", "unknown")
        doc_type = chunk.metadata.get("document_type", "document")
        text = chunk.text.strip()[:700]
        parts.append(f"[{i}] {doc_type}: {source}\n{text}")
    return "\n\n".join(parts) if parts else "No manual excerpts retrieved."


def format_offline_answer(
    *,
    question: str,
    citations: list[dict[str, Any]],
    domain_context: str,
    role: str,
) -> str:
    """Structured markdown when LLM is unavailable — never dump raw RAG context."""
    lines = [
        "## Answer",
        f"**Your question:** {question.strip()}",
        "",
    ]

    if citations:
        lines.append("## What the manuals say")
        for i, cite in enumerate(citations[:4], 1):
            title = _title_from_source(cite["source"])
            pct = f"{float(cite['relevance_score']) * 100:.0f}%"
            lines.append(f"### {i}. {title} ({pct} match)")
            lines.append(_clean_excerpt(cite["excerpt"]))
            lines.append("")
    else:
        lines.extend(
            [
                "No direct manual match was found for this query.",
                "Try a more specific term (equipment type + symptom), or browse indexed documents below.",
                "",
            ]
        )

    if domain_context:
        lines.append("## Steel domain expert")
        for raw in domain_context.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("- "):
                lines.append(line)
            elif line.endswith(":"):
                lines.append(f"**{line.rstrip(':')}**")
            else:
                lines.append(f"- {line}")
        lines.append("")

    if role:
        lines.extend(
            [
                f"## Focus for {role}",
                _role_hint(role),
                "",
            ]
        )

    lines.extend(
        [
            "## Next steps",
            "- Open a cited document for the full SOP section",
            "- Use **AI Agentic Assistant** for equipment-specific diagnosis",
            "- Re-ingest documents after adding new manuals to `data/documents/`",
        ]
    )
    return "\n".join(lines)


def build_llm_system(role: str) -> str:
    return (
        "You are the Tata Steel Maintenance Wizard **Knowledge Engine** assistant. "
        "Answer using ONLY the provided manual excerpts and domain expert notes. "
        "Write clean markdown with these sections:\n"
        "## Answer (2-4 sentences, direct answer to the question)\n"
        "## Key points from manuals (3-5 bullets citing which document)\n"
        "## Recommended actions (numbered steps, timeframe where known)\n"
        "## Related documents (list source filenames)\n\n"
        f"Audience: {role or 'engineer'}. {_role_hint(role or 'engineer')}\n"
        "Do NOT paste raw chunk text. Do NOT use [1] citation markers. Be concise and readable."
    )


def build_llm_prompt(
    *,
    question: str,
    excerpts: str,
    domain_context: str,
    role: str,
) -> str:
    return f"""Question: {question}
Role: {role or 'engineer'}

Manual excerpts:
{excerpts}

Steel domain expert notes:
{domain_context or 'None'}

Synthesize a helpful answer for the engineer searching the knowledge base."""
