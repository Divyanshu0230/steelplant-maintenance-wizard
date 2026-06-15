#!/usr/bin/env python3
"""Import NASA C-MAPSS sensor cycles into plant equipment records."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings

settings = get_settings()

COLUMNS = (
    ["unit", "cycle"]
    + [f"op_setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)

# Map C-MAPSS sensor columns → plant sensor names (NASA turbofan → steel plant analogy)
SENSOR_MAP = {
    "temperature": "sensor_2",       # Total temperature at fan inlet
    "vibration": "sensor_4",         # LPC outlet temperature (proxy for mechanical stress)
    "pressure": "sensor_7",          # HPC outlet pressure
    "motor_current": "sensor_11",    # Physical fan speed (proxy for motor load)
    "operational_setting_1": "op_setting_1",
    "operational_setting_2": "op_setting_2",
    "operational_setting_3": "op_setting_3",
}

# Pick 5 C-MAPSS engine units with different degradation profiles
UNIT_MAP = {
    1: "BF-BLOWER-01",
    11: "RM-MOTOR-03",
    25: "CV-SYSTEM-12",
    50: "OH-CRANE-02",
    75: "BF-PUMP-05",
}

# Stop each unit's timeline at a different lifecycle point (fraction of max cycle).
# Latest row = what ML and dashboards read — gives a realistic healthy/warning/critical mix.
UNIT_END_CYCLE_FRACTION: dict[str, float] = {
    "BF-PUMP-05": 0.28,
    "OH-CRANE-02": 0.38,
    "CV-SYSTEM-12": 0.52,
    "BF-BLOWER-01": 0.78,
    "RM-MOTOR-03": 0.92,
}


def load_cmapss(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, sep=r"\s+", header=None, names=COLUMNS)


def unit_rul_at_end(df: pd.DataFrame, unit: int) -> int:
    unit_df = df[df["unit"] == unit]
    max_cycle = unit_df["cycle"].max()
    return int(max_cycle - unit_df["cycle"].iloc[-1])


def select_units(df: pd.DataFrame) -> dict[int, str]:
    """Return unit→equipment mapping; prefer units with varied RUL."""
    available = set(df["unit"].unique())
    mapping = {u: code for u, code in UNIT_MAP.items() if u in available}
    if len(mapping) >= 5:
        return mapping
    # Fallback: pick 5 units with lowest final RUL
    units = sorted(df["unit"].unique())
    codes = list(UNIT_MAP.values())
    return {units[i]: codes[i] for i in range(min(5, len(units)))}


def cmapss_to_sensor_rows(df: pd.DataFrame, unit: int, equipment_code: str) -> list[dict]:
    unit_df = df[df["unit"] == unit].sort_values("cycle")
    original_max_cycle = int(unit_df["cycle"].max())
    end_fraction = UNIT_END_CYCLE_FRACTION.get(equipment_code, 0.55)
    end_cycle = max(5, int(original_max_cycle * end_fraction))
    unit_df = unit_df[unit_df["cycle"] <= end_cycle]
    now = datetime.now(timezone.utc)
    rows = []
    for _, row in unit_df.iterrows():
        cycle = int(row["cycle"])
        rul = max(0, int(original_max_cycle - cycle))
        rows.append({
            "cycle": cycle,
            "timestamp": now - timedelta(hours=int(original_max_cycle - cycle)),
            "temperature": round(float(row[SENSOR_MAP["temperature"]]), 2),
            "vibration": round(float(row[SENSOR_MAP["vibration"]]), 2),
            "pressure": round(float(row[SENSOR_MAP["pressure"]]), 2),
            "motor_current": round(float(row[SENSOR_MAP["motor_current"]]), 2),
            "operational_setting_1": round(float(row[SENSOR_MAP["operational_setting_1"]]), 3),
            "operational_setting_2": round(float(row[SENSOR_MAP["operational_setting_2"]]), 3),
            "operational_setting_3": round(float(row[SENSOR_MAP["operational_setting_3"]]), 3),
            "health_indicator": round(rul / max(original_max_cycle, 1), 3),
            "metadata_": {
                "source": "NASA_CMAPSS_FD001",
                "cmapss_unit": unit,
                "rul_cycles": rul,
                "equipment_code": equipment_code,
            },
        })
    return rows


def get_cmapss_path() -> Path | None:
    path = settings.data_dir / "cmapss" / "train_FD001.txt"
    return path if path.exists() else None
