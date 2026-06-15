from dataclasses import dataclass
from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class AnomalyResult:
    is_anomaly: bool
    anomaly_score: float
    severity: str
    contributing_sensors: list[str]
    method: str = "isolation_forest"


class AnomalyDetector:
    def __init__(self, contamination: float = 0.05) -> None:
        self.contamination = contamination
        self.model = IsolationForest(contamination=contamination, random_state=42)
        self.is_fitted = False
        self.baseline_stats: dict[str, dict[str, float]] = {}

    def fit(self, sensor_matrix: np.ndarray, sensor_names: list[str]) -> None:
        if len(sensor_matrix) < 10:
            logger.warning("Insufficient data for anomaly model fitting")
            return
        self.model.fit(sensor_matrix)
        self.is_fitted = True
        for idx, name in enumerate(sensor_names):
            col = sensor_matrix[:, idx]
            self.baseline_stats[name] = {
                "mean": float(np.mean(col)),
                "std": float(np.std(col)),
                "p95": float(np.percentile(col, 95)),
                "p05": float(np.percentile(col, 5)),
            }

    def detect(
        self,
        reading: dict[str, Optional[float]],
        sensor_names: Optional[list[str]] = None,
    ) -> AnomalyResult:
        names = sensor_names or [k for k, v in reading.items() if v is not None]
        values = [reading.get(n) for n in names]
        if not values or all(v is None for v in values):
            return AnomalyResult(False, 0.0, "low", [], "none")

        clean_values = [v if v is not None else 0.0 for v in values]
        contributing: list[str] = []

        for name, value in zip(names, clean_values):
            stats = self.baseline_stats.get(name)
            if stats and (value > stats["p95"] or value < stats["p05"]):
                contributing.append(name)

        if self.is_fitted:
            score = float(self.model.decision_function([clean_values])[0])
            prediction = int(self.model.predict([clean_values])[0])
            is_anomaly = prediction == -1
            anomaly_score = abs(min(score, 0)) * 10
        else:
            is_anomaly = len(contributing) >= 2
            anomaly_score = len(contributing) * 0.25
            score = -anomaly_score

        severity = self._score_to_severity(anomaly_score, is_anomaly)
        return AnomalyResult(
            is_anomaly=is_anomaly or len(contributing) >= 2,
            anomaly_score=round(anomaly_score, 3),
            severity=severity,
            contributing_sensors=contributing,
            method="isolation_forest" if self.is_fitted else "statistical",
        )

    @staticmethod
    def _score_to_severity(anomaly_score: float, is_anomaly: bool) -> str:
        if not is_anomaly:
            return "low"
        if anomaly_score >= 0.8:
            return "critical"
        if anomaly_score >= 0.5:
            return "high"
        if anomaly_score >= 0.25:
            return "medium"
        return "low"
