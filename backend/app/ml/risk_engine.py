from dataclasses import dataclass
from typing import Optional


@dataclass
class RiskAssessment:
    overall_score: float
    risk_level: str
    factors: dict[str, float]
    bottleneck_priority: int
    explanation: str


class RiskEngine:
    CRITICALITY_WEIGHTS = {"low": 0.2, "medium": 0.5, "high": 0.8, "critical": 1.0}

    def assess(
        self,
        *,
        equipment_criticality: str,
        failure_probability: float,
        anomaly_severity: str,
        spare_availability: int,
        lead_time_days: int,
        downtime_hours_recent: float = 0.0,
    ) -> RiskAssessment:
        crit = self.CRITICALITY_WEIGHTS.get(equipment_criticality, 0.5)
        anomaly_map = {"low": 0.1, "medium": 0.4, "high": 0.7, "critical": 1.0}
        anomaly = anomaly_map.get(anomaly_severity, 0.3)
        spare_risk = 1.0 if spare_availability <= 0 else max(0.0, 1 - spare_availability / 5)
        lead_time_risk = min(1.0, lead_time_days / 14)
        downtime_risk = min(1.0, downtime_hours_recent / 48)

        factors = {
            "equipment_criticality": round(crit, 3),
            "failure_probability": round(failure_probability, 3),
            "anomaly_severity": round(anomaly, 3),
            "spare_availability_risk": round(spare_risk, 3),
            "procurement_lead_time_risk": round(lead_time_risk, 3),
            "recent_downtime_risk": round(downtime_risk, 3),
        }

        overall = (
            crit * 0.25
            + failure_probability * 0.25
            + anomaly * 0.2
            + spare_risk * 0.15
            + lead_time_risk * 0.1
            + downtime_risk * 0.05
        )
        overall = round(min(1.0, overall), 3)
        risk_level = self._level(overall)
        priority = int(overall * 100)

        explanation = (
            f"Risk score {overall} driven by {risk_level} equipment criticality, "
            f"failure probability {failure_probability:.0%}, and "
            f"{'low' if spare_availability > 0 else 'no'} spare availability."
        )

        return RiskAssessment(
            overall_score=overall,
            risk_level=risk_level,
            factors=factors,
            bottleneck_priority=priority,
            explanation=explanation,
        )

    @staticmethod
    def _level(score: float) -> str:
        if score >= 0.8:
            return "critical"
        if score >= 0.6:
            return "high"
        if score >= 0.35:
            return "medium"
        return "low"
