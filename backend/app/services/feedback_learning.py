"""Feedback learning — applies engineer corrections to future recommendations."""

import json
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.entities import Feedback

settings = get_settings()


class FeedbackLearningService:
    def __init__(self) -> None:
        self.store_path = settings.data_dir / "feedback_learnings.json"
        self._cache: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if self.store_path.exists():
            try:
                self._cache = json.loads(self.store_path.read_text())
            except Exception:
                self._cache = {}

    def _save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        self.store_path.write_text(json.dumps(self._cache, indent=2))

    async def ingest_feedback(self, db: AsyncSession, feedback: Feedback) -> dict[str, Any]:
        """Learn from a new feedback entry."""
        key = f"equipment_{feedback.equipment_id}" if feedback.equipment_id else "global"
        entry = self._cache.setdefault(key, {"corrections": [], "confirmed_causes": [], "rejected_causes": []})

        if feedback.feedback_type == "correction" and feedback.correction:
            entry["corrections"].append({
                "text": feedback.correction,
                "rating": feedback.rating,
                "outcome": feedback.outcome,
            })
            entry["corrections"] = entry["corrections"][-20:]
        elif feedback.feedback_type == "diagnosis_rating" and feedback.rating and feedback.rating >= 4:
            if feedback.original_recommendation:
                entry["confirmed_causes"].append(feedback.original_recommendation[:200])
                entry["confirmed_causes"] = entry["confirmed_causes"][-10:]
        elif feedback.feedback_type == "rejection" and feedback.correction:
            entry["rejected_causes"].append(feedback.correction[:200])
            entry["rejected_causes"] = entry["rejected_causes"][-10:]

        self._save()
        return {"learned": True, "key": key, "total_corrections": len(entry["corrections"])}

    async def get_context(self, db: AsyncSession, equipment_id: Optional[int] = None) -> str:
        """Build prompt context from stored learnings + recent DB feedback."""
        parts = []

        key = f"equipment_{equipment_id}" if equipment_id else "global"
        learned = self._cache.get(key, {})
        global_learned = self._cache.get("global", {})

        for source in [learned, global_learned]:
            for c in source.get("corrections", [])[-5:]:
                parts.append(f"Engineer correction: {c['text']}")
            for c in source.get("confirmed_causes", [])[-3:]:
                parts.append(f"Confirmed diagnosis: {c}")
            for c in source.get("rejected_causes", [])[-3:]:
                parts.append(f"Rejected diagnosis (avoid): {c}")

        query = select(Feedback).order_by(desc(Feedback.created_at)).limit(5)
        if equipment_id:
            query = query.where(Feedback.equipment_id == equipment_id)
        result = await db.execute(query)
        for row in result.scalars().all():
            if row.correction:
                parts.append(f"Recent feedback ({row.feedback_type}): {row.correction}")

        return "\n".join(parts) if parts else "None"

    def adjust_confidence(self, cause: str, base_confidence: float, equipment_id: Optional[int] = None) -> float:
        """Boost/reduce confidence based on learned patterns."""
        key = f"equipment_{equipment_id}" if equipment_id else "global"
        learned = {**self._cache.get("global", {}), **self._cache.get(key, {})}
        cause_lower = cause.lower()
        conf = base_confidence

        for confirmed in learned.get("confirmed_causes", []):
            if any(word in cause_lower for word in confirmed.lower().split()[:3]):
                conf = min(0.95, conf + 0.1)

        for rejected in learned.get("rejected_causes", []):
            if any(word in cause_lower for word in rejected.lower().split()[:3]):
                conf = max(0.1, conf - 0.2)

        return round(conf, 3)


_learning: Optional[FeedbackLearningService] = None


def get_feedback_learning() -> FeedbackLearningService:
    global _learning
    if _learning is None:
        _learning = FeedbackLearningService()
    return _learning
