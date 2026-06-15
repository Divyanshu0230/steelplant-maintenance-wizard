#!/usr/bin/env python3
"""Import TATA hackathon sample datasets into the maintenance wizard DB."""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings

settings = get_settings()
TATA_DIR = settings.data_dir / "tata-hackathon"

# TATA equipment names → our equipment codes
EQUIPMENT_MAP = {
    "Blast Furnace #1 Main Drive": "BF-BLOWER-01",
    "BF1-MOTOR-01": "BF-BLOWER-01",
    "CCM Segment Roll - Strand 2": "RM-MOTOR-03",
    "Hot Strip Mill Work Roll Drive": "RM-MOTOR-03",
    "HSM Work Roll Drive": "RM-MOTOR-03",
    "EAF Transformer Cooling Pump": "BF-PUMP-05",
    "Sinter Plant Exhaust Fan": "BF-BLOWER-01",
    "Ladle Crane Main Hoist": "OH-CRANE-02",
    "CCM Hydraulic Mold Oscillation": "BF-PUMP-05",
    "Coke Oven Pusher Machine Drive": "CV-SYSTEM-12",
}

SEVERITY_FROM_DELAY = {
    "Mechanical": "high",
    "Hydraulic": "high",
    "Electrical": "medium",
    "Lubrication": "medium",
}

FAULT_SEVERITY = {
    "E003": "critical",
    "E031": "high",
    "E010": "high",
    "E001": "medium",
    "E020": "medium",
}


def _parse_ts(value: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def import_tata_delay_logs(equipment_map: dict) -> list[dict]:
    path = TATA_DIR / "logs" / "sample_equipment_delay_log.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path)
    rows = []
    for _, r in df.iterrows():
        name = str(r.get("Equipment", "")).strip()
        code = EQUIPMENT_MAP.get(name)
        if not code or code not in equipment_map:
            continue
        delay_min = float(r.get("Delay Duration (min)", 0) or 0)
        category = str(r.get("Delay Category", "medium"))
        fault = str(r.get("Fault Code", "")).strip()
        if fault == "nan" or not fault:
            fault = ""
        rows.append({
            "equipment_id": equipment_map[code].id,
            "logged_at": _parse_ts(str(r.get("Date", ""))),
            "delay_hours": round(delay_min / 60, 2),
            "production_loss_tonnes": 0,
            "reason": (
                f"{r.get('Description', '')} | Root cause: {r.get('Root Cause', '')} | "
                f"Action: {r.get('Corrective Action', '')}"
            )[:500],
            "severity": SEVERITY_FROM_DELAY.get(category, "medium"),
            "metadata_": {
                "source": "tata_hackathon_delay_log",
                "fault_code": fault,
                "technician": str(r.get("Technician", "")),
                "plant_area": str(r.get("Plant Area", "")),
            },
        })
    return rows


def import_tata_fault_messages(equipment_map: dict) -> list[dict]:
    path = TATA_DIR / "logs" / "sample_equipment_delay_log.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path)
    rows = []
    for _, r in df.iterrows():
        fault = str(r.get("Fault Code", "")).strip()
        if not fault or fault == "nan":
            continue
        name = str(r.get("Equipment", "")).strip()
        code = EQUIPMENT_MAP.get(name)
        if not code or code not in equipment_map:
            continue
        rows.append({
            "equipment_id": equipment_map[code].id,
            "fault_code": fault,
            "message": f"SCADA: {r.get('Description', '')}",
            "severity": FAULT_SEVERITY.get(fault, "medium"),
            "source": "SCADA",
            "logged_at": _parse_ts(str(r.get("Date", ""))),
            "is_active": float(r.get("Delay Duration (min)", 0) or 0) >= 30,
            "metadata_": {"source": "tata_hackathon_delay_log"},
        })
    return rows


def _sensor_type_map(sensor_type: str) -> tuple[str, float] | None:
    st = sensor_type.lower()
    if "vibration" in st:
        return "vibration", 1.0
    if st == "temperature_c" or st.endswith("temperature_c"):
        return "temperature", 1.0
    if "oil_temperature" in st:
        return "temperature", 1.0
    if "current" in st:
        return "motor_current", 1.0
    if "pressure" in st or "oil_pressure" in st:
        return "pressure", 1.0
    return None


def import_tata_sensor_readings(equipment_map: dict) -> list[dict]:
    """Pivot long-format sensor log into SensorData rows per timestamp."""
    path = TATA_DIR / "logs" / "sample_sensor_readings.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path)
    buckets: dict[tuple, dict] = {}
    for _, r in df.iterrows():
        name = str(r.get("Equipment", "")).strip()
        code = EQUIPMENT_MAP.get(name)
        if not code or code not in equipment_map:
            continue
        ts = _parse_ts(str(r.get("Timestamp", "")))
        key = (code, ts.isoformat())
        if key not in buckets:
            buckets[key] = {
                "equipment_id": equipment_map[code].id,
                "timestamp": ts,
                "metadata_": {"source": "tata_hackathon_sensor_log"},
            }
        mapped = _sensor_type_map(str(r.get("Sensor Type", "")))
        if mapped:
            field, _ = mapped
            buckets[key][field] = float(r.get("Value", 0))
        if str(r.get("Is Anomaly", "")).lower() == "true":
            buckets[key]["health_indicator"] = max(
                0, 1 - float(r.get("Anomaly Score", 0.5) or 0.5)
            )

    return list(buckets.values())


def import_tata_rul_series(equipment_map: dict) -> list[dict]:
    path = TATA_DIR / "samples" / "rul_sensor_data_sample.csv"
    if not path.exists():
        return []
    # Skip comment lines
    lines = [ln for ln in path.read_text().splitlines() if ln and not ln.startswith("//")]
    from io import StringIO
    df = pd.read_csv(StringIO("\n".join(lines)))
    code = "BF-BLOWER-01"
    if code not in equipment_map:
        return []
    eq_id = equipment_map[code].id
    rows = []
    for i, r in df.iterrows():
        rul_days = float(r.get("rul_actual_days", 0) or 0)
        rows.append({
            "equipment_id": eq_id,
            "timestamp": _parse_ts(str(r.get("timestamp", ""))),
            "cycle": i + 1,
            "vibration": float(r.get("vibration_rms_mm_s", 0)),
            "temperature": float(r.get("temperature_c", 0)),
            "motor_current": float(r.get("current_a", 0)),
            "health_indicator": round(max(0, rul_days / 90), 3),
            "metadata_": {
                "source": "tata_rul_bearing_sample",
                "rul_actual_days": rul_days,
                "anomaly_score": float(r.get("anomaly_score", 0)),
            },
        })
    return rows


def copy_manuals_to_documents() -> int:
    """Copy TATA manuals into data/documents as markdown for RAG."""
    manuals_dir = TATA_DIR / "manuals"
    docs_dir = settings.documents_dir
    docs_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for txt in manuals_dir.glob("*.txt"):
        dest = docs_dir / f"tata_{txt.stem}.md"
        if dest.exists():
            continue
        content = txt.read_text(encoding="utf-8", errors="replace")
        dest.write_text(f"# {txt.stem.replace('_', ' ').title()}\n\n{content}", encoding="utf-8")
        count += 1
    return count


def import_all_tata_data(equipment_map: dict) -> dict:
    """Return rows to insert; does not touch DB."""
    delay_rows = import_tata_delay_logs(equipment_map)
    fault_rows = import_tata_fault_messages(equipment_map)
    sensor_rows = import_tata_sensor_readings(equipment_map)
    rul_rows = import_tata_rul_series(equipment_map)
    manuals = copy_manuals_to_documents()
    return {
        "delay_logs": delay_rows,
        "fault_messages": fault_rows,
        "sensor_readings": sensor_rows,
        "rul_series": rul_rows,
        "manuals_copied": manuals,
    }
