"""Steel-domain SLM layer — pattern-matched expert reasoning before general LLM.

FR1 bonus: domain-specific model adaptation for steel plant maintenance.
Combines operational fault codes, C-MAPSS-trained thresholds, and feedback weights.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from app.core.config import get_settings

settings = get_settings()


@dataclass
class DomainCause:
    cause: str
    confidence: float
    evidence: str
    fault_code: str = ""
    source: str = "steel_domain_slm"


@dataclass
class DomainAction:
    priority: str
    action: str
    timeframe: str
    rationale: str


@dataclass
class DomainAnalysis:
    active: bool
    model_type: str
    domain_causes: list[DomainCause] = field(default_factory=list)
    domain_actions: list[DomainAction] = field(default_factory=list)
    matched_patterns: list[str] = field(default_factory=list)
    prompt_context: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain_model_active": self.active,
            "domain_model_type": self.model_type,
            "domain_causes": [
                {
                    "cause": c.cause,
                    "confidence": c.confidence,
                    "evidence": c.evidence,
                    "fault_code": c.fault_code,
                    "source": c.source,
                }
                for c in self.domain_causes
            ],
            "domain_actions": [
                {
                    "priority": a.priority,
                    "action": a.action,
                    "timeframe": a.timeframe,
                    "rationale": a.rationale,
                }
                for a in self.domain_actions
            ],
            "matched_patterns": self.matched_patterns,
        }


class SteelDomainSLM:
    """Lightweight domain expert — steel fault patterns + sensor rules + feedback boosts."""

    def __init__(self) -> None:
        self.profile_path = settings.data_dir / "domain" / "steel_domain_profile.json"
        self._profile: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if self.profile_path.exists():
            try:
                self._profile = json.loads(self.profile_path.read_text())
            except Exception:
                self._profile = {}
        if not self._profile:
            self._profile = {"fault_patterns": [], "sensor_thresholds": {}, "model_type": "steel_maintenance_domain_adapter"}

    def reload(self) -> None:
        self._load()

    def profile_summary(self) -> dict[str, Any]:
        patterns = self._profile.get("fault_patterns", [])
        return {
            "model_type": self._profile.get("model_type", "steel_maintenance_domain_adapter"),
            "version": self._profile.get("version", 0),
            "trained_at": self._profile.get("trained_at"),
            "training_sources": self._profile.get("training_sources", []),
            "fault_patterns_count": len(patterns),
            "domain_vocabulary": self._profile.get("domain_vocabulary", []),
            "stats": self._profile.get("stats", {}),
            "profile_path": str(self.profile_path),
        }

    def _sensor_match(self, rules: dict[str, Any], readings: dict[str, float]) -> bool:
        if not rules:
            return True
        for sensor, bounds in rules.items():
            val = readings.get(sensor)
            if val is None:
                continue
            if "min" in bounds and val >= float(bounds["min"]):
                return True
            if "max" in bounds and val <= float(bounds["max"]):
                return True
        return False

    def _keyword_match(self, keywords: list[str], text: str) -> int:
        text_l = text.lower()
        return sum(1 for kw in keywords if kw.lower() in text_l)

    def analyze(
        self,
        query: str,
        equipment_type: Optional[str] = None,
        sensor_readings: Optional[dict[str, float]] = None,
        feedback_boosts: Optional[dict[str, float]] = None,
    ) -> DomainAnalysis:
        readings = sensor_readings or {}
        boosts = feedback_boosts or self._profile.get("feedback_boosts", {})
        patterns = self._profile.get("fault_patterns", [])
        eq_type = equipment_type or "general"
        text = query or ""

        matched: list[tuple[dict[str, Any], float]] = []
        for pat in patterns:
            types = pat.get("equipment_types", ["general"])
            if eq_type not in types and "general" not in types:
                continue
            kw_score = self._keyword_match(pat.get("keywords", []), text)
            sensor_ok = self._sensor_match(pat.get("sensor_rules", {}), readings)
            if kw_score == 0 and not sensor_ok:
                continue
            score = pat.get("confidence_base", 0.7)
            score += min(0.12, kw_score * 0.04)
            if sensor_ok and pat.get("sensor_rules"):
                score = min(0.95, score + 0.08)
            boost_key = pat.get("fault_code") or pat.get("cause", "")[:40]
            score = min(0.98, score + float(boosts.get(boost_key, 0)))
            matched.append((pat, score))

        matched.sort(key=lambda x: x[1], reverse=True)
        top = matched[:4]

        causes: list[DomainCause] = []
        actions: list[DomainAction] = []
        codes: list[str] = []
        for pat, conf in top:
            code = pat.get("fault_code", "")
            if code:
                codes.append(code)
            causes.append(
                DomainCause(
                    cause=pat.get("cause", "Steel plant fault pattern"),
                    confidence=round(conf, 3),
                    evidence=pat.get("evidence", "Domain fault pattern match"),
                    fault_code=code,
                )
            )
            if pat.get("action"):
                actions.append(
                    DomainAction(
                        priority=pat.get("priority", "medium"),
                        action=pat["action"],
                        timeframe=pat.get("timeframe", "Next maintenance window"),
                        rationale=f"Operational fault code {code}" if code else "Steel domain SLM rule",
                    )
                )

        thresholds = self._profile.get("sensor_thresholds", {})
        vib = readings.get("vibration", 0)
        if vib >= thresholds.get("vibration_iso_zone_d", 11.2) and not any("vibration" in c.cause.lower() for c in causes):
            causes.insert(
                0,
                DomainCause(
                    cause="Critical vibration — immediate bearing/alignment inspection",
                    confidence=0.9,
                    evidence=f"Vibration {vib:.1f} mm/s exceeds ISO Zone D ({thresholds.get('vibration_iso_zone_d', 11.2)})",
                    fault_code="F-VIB-03",
                ),
            )
        elif vib >= thresholds.get("vibration_iso_zone_c", 7.1) and not any("vibration" in c.cause.lower() for c in causes):
            causes.append(
                DomainCause(
                    cause="Elevated vibration — schedule bearing inspection",
                    confidence=0.8,
                    evidence=f"Vibration {vib:.1f} mm/s in ISO Zone C",
                    fault_code="F-VIB-03",
                )
            )

        ctx_lines = [
            "Steel domain expert (fine-tuned adapter) preliminary analysis:",
        ]
        for c in causes[:3]:
            ctx_lines.append(f"- {c.cause} (confidence {c.confidence:.0%}, {c.evidence})")
        for a in actions[:3]:
            ctx_lines.append(f"- Recommended: [{a.priority}] {a.action} ({a.timeframe})")

        return DomainAnalysis(
            active=bool(causes),
            model_type=self._profile.get("model_type", "steel_maintenance_domain_adapter"),
            domain_causes=causes,
            domain_actions=actions,
            matched_patterns=codes,
            prompt_context="\n".join(ctx_lines) if causes else "",
        )

    def merge_causes(
        self,
        llm_causes: list[dict[str, Any]],
        domain: DomainAnalysis,
    ) -> list[dict[str, Any]]:
        """Boost LLM causes that align with domain SLM; prepend unmatched domain causes."""
        if not domain.domain_causes:
            return llm_causes

        merged = []
        seen: set[str] = set()

        for dc in domain.domain_causes:
            key = dc.cause.lower()[:50]
            seen.add(key)
            merged.append(
                {
                    "cause": dc.cause,
                    "confidence": dc.confidence,
                    "evidence": dc.evidence,
                    "source": "steel_domain_slm",
                    "fault_code": dc.fault_code,
                }
            )

        for lc in llm_causes:
            cause_text = (lc.get("cause") or "").lower()
            boosted = False
            for dc in domain.domain_causes:
                dc_words = set(re.findall(r"\w+", dc.cause.lower())[:4])
                if dc_words & set(re.findall(r"\w+", cause_text)[:6]):
                    lc = {
                        **lc,
                        "confidence": min(0.98, float(lc.get("confidence", 0.5)) + 0.08),
                        "source": lc.get("source", "llm") + "+domain_boost",
                    }
                    boosted = True
                    break
            key = cause_text[:50]
            if key not in seen:
                seen.add(key)
                merged.append(lc)
            elif boosted:
                for i, m in enumerate(merged):
                    if (m.get("cause") or "").lower()[:50] == key:
                        merged[i] = lc
                        break

        merged.sort(key=lambda x: float(x.get("confidence", 0)), reverse=True)
        return merged[:8]


_slm: Optional[SteelDomainSLM] = None


def get_steel_domain_slm() -> SteelDomainSLM:
    global _slm
    if _slm is None:
        _slm = SteelDomainSLM()
    return _slm
