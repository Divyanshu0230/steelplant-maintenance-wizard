import numpy as np

from app.ml.anomaly_detector import AnomalyDetector
from app.ml.risk_engine import RiskEngine
from app.ml.rul_predictor import RULPredictor


def test_anomaly_detector_statistical():
    detector = AnomalyDetector()
    matrix = np.random.randn(50, 4) * 0.5 + 5
    detector.fit(matrix, ["temperature", "vibration", "pressure", "motor_current"])
    result = detector.detect(
        {"temperature": 50, "vibration": 20, "pressure": 5, "motor_current": 3},
        ["temperature", "vibration", "pressure", "motor_current"],
    )
    assert result.is_anomaly or len(result.contributing_sensors) > 0


def test_rul_predictor():
    predictor = RULPredictor()
    result = predictor.predict(
        {"temperature": 70, "vibration": 8, "pressure": 110, "motor_current": 35}
    )
    assert 0 <= result.rul_cycles <= 200
    assert 0 <= result.failure_probability <= 1
    assert result.risk_level in {"low", "medium", "high", "critical"}


def test_risk_engine():
    engine = RiskEngine()
    result = engine.assess(
        equipment_criticality="critical",
        failure_probability=0.9,
        anomaly_severity="critical",
        spare_availability=0,
        lead_time_days=14,
    )
    assert result.risk_level in {"high", "critical"}
    assert result.overall_score > 0.5
