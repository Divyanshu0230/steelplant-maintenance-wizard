from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

from app.core.logging import get_logger

logger = get_logger(__name__)

SENSOR_FEATURES = [
    "temperature",
    "vibration",
    "pressure",
    "motor_current",
    "operational_setting_1",
    "operational_setting_2",
    "operational_setting_3",
]


@dataclass
class RULPrediction:
    rul_cycles: int
    failure_probability: float
    degradation_score: float
    risk_level: str
    model_version: str = "untrained-heuristic"


class RULPredictor:
    def __init__(self, model_path: Optional[Path] = None) -> None:
        self.model_path = model_path
        self.model: Optional[GradientBoostingRegressor] = None
        self.is_trained = False

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
        )
        self.model.fit(X, y)
        self.is_trained = True
        if self.model_path:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(self.model, self.model_path)
            logger.info("RUL model saved to %s", self.model_path)

    def load(self) -> bool:
        if self.model_path and self.model_path.exists():
            self.model = joblib.load(self.model_path)
            self.is_trained = True
            return True
        return False

    def predict(self, features: dict[str, float], max_cycles: int = 200) -> RULPrediction:
        if self.is_trained and self.model is not None:
            vector = np.array([[features.get(f, 0.0) for f in SENSOR_FEATURES]])
            rul = max(0, int(self.model.predict(vector)[0]))
        else:
            vibration = features.get("vibration", 0.0)
            temperature = features.get("temperature", 0.0)
            motor_current = features.get("motor_current", 0.0)
            degradation = min(1.0, (vibration / 10.0 + temperature / 200.0 + motor_current / 50.0) / 3)
            rul = max(0, int((1 - degradation) * max_cycles))

        degradation_score = round(max(0.0, min(1.0, 1 - (rul / max_cycles))), 3)
        failure_probability = round(min(0.99, degradation_score * 0.95 + 0.05), 3)
        risk_level = self._compute_risk(rul, failure_probability)

        return RULPrediction(
            rul_cycles=rul,
            failure_probability=failure_probability,
            degradation_score=degradation_score,
            risk_level=risk_level,
        )

    @staticmethod
    def _compute_risk(rul: int, failure_probability: float) -> str:
        if rul <= 10 or failure_probability >= 0.85:
            return "critical"
        if rul <= 30 or failure_probability >= 0.65:
            return "high"
        if rul <= 60 or failure_probability >= 0.4:
            return "medium"
        return "low"
