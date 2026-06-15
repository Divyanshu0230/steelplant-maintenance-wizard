from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.ml.anomaly_detector import AnomalyDetector
from app.ml.rul_predictor import RULPredictor, SENSOR_FEATURES

logger = get_logger(__name__)
settings = get_settings()


class ModelRegistry:
    def __init__(self) -> None:
        self.models_dir = settings.models_dir
        self.rul_predictor = RULPredictor(model_path=self.models_dir / "rul_xgb_model.joblib")
        self.anomaly_detector = AnomalyDetector()
        self._load_models()

    def _load_models(self) -> None:
        gbr_path = self.models_dir / "rul_gbr_model.joblib"
        xgb_path = self.models_dir / "rul_xgb_model.joblib"
        anomaly_path = self.models_dir / "anomaly_model.joblib"

        for path, label in [(xgb_path, "trained"), (gbr_path, "gbr")]:
            if path.exists():
                self.rul_predictor.model = joblib.load(path)
                self.rul_predictor.is_trained = True
                self.rul_predictor.model_path = path
                logger.info("Loaded RUL model from %s", path.name)
                break
        else:
            logger.warning("No trained RUL model found. Run: python scripts/train_models.py")

        if anomaly_path.exists():
            self.anomaly_detector.model = joblib.load(anomaly_path)
            self.anomaly_detector.is_fitted = True
            logger.info("Loaded Isolation Forest anomaly model")

    def fit_anomaly_baseline(self, sensor_matrix: np.ndarray) -> None:
        if len(sensor_matrix) >= 10 and not self.anomaly_detector.is_fitted:
            self.anomaly_detector.fit(sensor_matrix, SENSOR_FEATURES)


@lru_cache
def get_model_registry() -> ModelRegistry:
    return ModelRegistry()
