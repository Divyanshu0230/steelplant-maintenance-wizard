#!/usr/bin/env python3
"""Train RUL and anomaly models from C-MAPSS or plant sensor data."""

import asyncio
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings
from app.ml.rul_predictor import SENSOR_FEATURES

settings = get_settings()

COLUMNS = (
    ["unit", "cycle"]
    + [f"op_setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)

FEATURE_MAP = {
    "temperature": "sensor_2",
    "vibration": "sensor_4",
    "pressure": "sensor_7",
    "motor_current": "sensor_11",
    "operational_setting_1": "op_setting_1",
    "operational_setting_2": "op_setting_2",
    "operational_setting_3": "op_setting_3",
}


def train_from_cmapss(train_path: Path) -> tuple[np.ndarray, np.ndarray]:
    df = pd.read_csv(train_path, sep=r"\s+", header=None, names=COLUMNS)
    max_cycle = df.groupby("unit")["cycle"].max().to_dict()
    df["rul"] = df.apply(lambda r: max_cycle[r["unit"]] - r["cycle"], axis=1)
    features, labels = [], []
    for _, row in df.iterrows():
        features.append([row[FEATURE_MAP[f]] for f in SENSOR_FEATURES])
        labels.append(row["rul"])
    return np.array(features, dtype=np.float32), np.array(labels, dtype=np.float32)


async def train_from_database() -> tuple[np.ndarray, np.ndarray]:
    from sqlalchemy import select
    from app.db.database import AsyncSessionLocal
    from app.models.entities import Equipment, SensorData

    features, labels = [], []
    async with AsyncSessionLocal() as db:
        eq_result = await db.execute(select(Equipment))
        equipment_list = eq_result.scalars().all()
        for eq in equipment_list:
            result = await db.execute(
                select(SensorData)
                .where(SensorData.equipment_id == eq.id)
                .order_by(SensorData.cycle)
            )
            rows = result.scalars().all()
            if len(rows) < 20:
                continue
            max_cycle = max(r.cycle or 0 for r in rows)
            for row in rows:
                cycle = row.cycle or 0
                rul = max(0, max_cycle - cycle)
                features.append([
                    row.temperature or 0,
                    row.vibration or 0,
                    row.pressure or 0,
                    row.motor_current or 0,
                    row.operational_setting_1 or 0,
                    row.operational_setting_2 or 0,
                    row.operational_setting_3 or 0,
                ])
                labels.append(rul)
    return np.array(features, dtype=np.float32), np.array(labels, dtype=np.float32)


def train_rul_model(X: np.ndarray, y: np.ndarray, models_dir: Path) -> None:
    models_dir.mkdir(parents=True, exist_ok=True)
    idx = np.random.choice(len(X), min(50000, len(X)), replace=False)
    model = GradientBoostingRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
    model.fit(X[idx], y[idx])
    joblib.dump(model, models_dir / "rul_gbr_model.joblib")
    joblib.dump(model, models_dir / "rul_xgb_model.joblib")
    print(f"RUL model trained on {len(idx)} samples -> {models_dir}")


def train_anomaly_model(X: np.ndarray, models_dir: Path) -> None:
    idx = np.random.choice(len(X), min(30000, len(X)), replace=False)
    model = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    model.fit(X[idx])
    joblib.dump(model, models_dir / "anomaly_model.joblib")
    print(f"Anomaly model trained on {len(idx)} samples -> {models_dir}")


async def main() -> None:
    np.random.seed(42)
    cmapss_path = settings.data_dir / "cmapss" / "train_FD001.txt"
    if cmapss_path.exists():
        print(f"Training from C-MAPSS: {cmapss_path}")
        X, y = train_from_cmapss(cmapss_path)
    else:
        print("C-MAPSS not found. Training from plant sensor database...")
        X, y = await train_from_database()
    if len(X) < 50:
        raise RuntimeError("Insufficient training data. Run seed_data.py first.")
    models_dir = settings.models_dir
    train_rul_model(X, y, models_dir)
    train_anomaly_model(X, models_dir)
    print("Training complete.")


if __name__ == "__main__":
    asyncio.run(main())
