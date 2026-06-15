#!/usr/bin/env python3
"""Seed database with NASA C-MAPSS real sensor data (or synthetic fallback) + knowledge docs."""

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.database import AsyncSessionLocal, Base, engine
from app.models.entities import (
    Alert,
    Equipment,
    EquipmentDelayLog,
    EquipmentHealthScore,
    FailureHistory,
    FaultMessage,
    MaintenanceRecord,
    Prediction,
    Role,
    SensorData,
    SparePart,
    User,
)
from app.rag.knowledge_engine import get_knowledge_engine
from app.services.monitoring_service import get_monitoring_service
from app.services.operational_service import import_operational_csvs

sys.path.insert(0, str(ROOT / "scripts"))
from import_tata_samples import import_all_tata_data

settings = get_settings()
random.seed(42)

EQUIPMENT = [
    ("BF-BLOWER-01", "Blast Furnace Blower Unit 01", "blast_furnace_blower", "Blast Furnace Area", "critical"),
    ("RM-MOTOR-03", "Rolling Mill Motor 03", "rolling_mill_motor", "Hot Rolling Mill", "critical"),
    ("CV-SYSTEM-12", "Conveyor System 12", "conveyor_system", "Raw Material Handling", "high"),
    ("OH-CRANE-02", "Overhead Crane 02", "overhead_crane", "Melting Shop", "high"),
    ("BF-PUMP-05", "Cooling Water Pump 05", "cooling_pump", "Utilities", "medium"),
]


def generate_sensor_series(cycles: int, degradation: float) -> list[dict]:
    readings = []
    for cycle in range(1, cycles + 1):
        factor = 1 + (cycle / cycles) * degradation
        readings.append({
            "cycle": cycle,
            "temperature": round(45 + random.uniform(-2, 2) + factor * 15, 2),
            "vibration": round(2.5 + random.uniform(-0.2, 0.2) + factor * 4.5, 2),
            "pressure": round(100 + random.uniform(-3, 3) + factor * 10, 2),
            "motor_current": round(20 + random.uniform(-1, 1) + factor * 8, 2),
            "operational_setting_1": round(random.uniform(0.4, 0.9), 3),
            "operational_setting_2": round(random.uniform(0.2, 0.8), 3),
            "operational_setting_3": round(random.uniform(0.1, 0.7), 3),
            "health_indicator": round(1 - (cycle / cycles) * degradation, 3),
            "metadata_": {"source": "synthetic_seed"},
        })
    return readings


async def import_cmapss_sensors(db, equipment_map: dict) -> bool:
    cmapss_path = settings.data_dir / "cmapss" / "train_FD001.txt"
    if not cmapss_path.exists():
        return False

    sys.path.insert(0, str(ROOT / "scripts"))
    from import_cmapss import cmapss_to_sensor_rows, load_cmapss, select_units

    print(f"Importing NASA C-MAPSS data from {cmapss_path}")
    df = load_cmapss(cmapss_path)
    unit_map = select_units(df)

    for unit, code in unit_map.items():
        eq = equipment_map.get(code)
        if not eq:
            continue
        await db.execute(delete(SensorData).where(SensorData.equipment_id == eq.id))
        rows = cmapss_to_sensor_rows(df, unit, code)
        for row in rows:
            db.add(SensorData(equipment_id=eq.id, **row))
        print(f"  {code} ← C-MAPSS unit {unit} ({len(rows)} cycles)")

    await db.flush()
    return True


async def seed() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.documents_dir.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for role_name, desc in [
            ("engineer", "Maintenance engineer"),
            ("supervisor", "Maintenance supervisor"),
            ("admin", "System administrator"),
        ]:
            existing = await db.execute(select(Role).where(Role.name == role_name))
            if not existing.scalar_one_or_none():
                db.add(Role(name=role_name, description=desc))
        await db.flush()

        roles = {}
        for rn in ("engineer", "supervisor", "admin"):
            roles[rn] = (await db.execute(select(Role).where(Role.name == rn))).scalar_one()

        users_seed = [
            ("engineer1@steelplant.com", "Maintenance User", "engineer", ["engineer@steelplant.com"]),
            ("supervisor1@steelplant.com", "Operations Lead", "supervisor", ["supervisor@steelplant.com"]),
            ("admin1@steelplant.com", "Plant Administrator", "admin", ["admin@steelplant.com"]),
        ]
        for email, name, role, legacy_emails in users_seed:
            user = None
            for em in [email, *legacy_emails]:
                result = await db.execute(select(User).where(User.email == em))
                user = result.scalar_one_or_none()
                if user:
                    break
            if user:
                user.email = email
                user.full_name = name
                user.role_id = roles[role].id
            else:
                db.add(User(
                    email=email,
                    hashed_password=get_password_hash("password123"),
                    full_name=name,
                    role_id=roles[role].id,
                ))

        equipment_map: dict[str, Equipment] = {}
        for code, name, etype, location, criticality in EQUIPMENT:
            existing = await db.execute(select(Equipment).where(Equipment.equipment_code == code))
            eq = existing.scalar_one_or_none()
            if not eq:
                eq = Equipment(
                    equipment_code=code, name=name, equipment_type=etype,
                    location=location, criticality=criticality, status="operational",
                    manufacturer="Tata Steel Equipment Division",
                    metadata_={"data_source": "pending"},
                )
                db.add(eq)
                await db.flush()
            equipment_map[code] = eq

        used_cmapss = await import_cmapss_sensors(db, equipment_map)

        if not used_cmapss:
            print("C-MAPSS not found — using synthetic sensor data.")
            print("Run: python scripts/download_cmapss.py  to get real NASA dataset")
            degradations = {"BF-BLOWER-01": 0.3, "RM-MOTOR-03": 0.85, "CV-SYSTEM-12": 0.4, "OH-CRANE-02": 0.2, "BF-PUMP-05": 0.15}
            now = datetime.now(timezone.utc)
            for code, eq in equipment_map.items():
                if (await db.execute(select(SensorData).where(SensorData.equipment_id == eq.id).limit(1))).scalar_one_or_none():
                    continue
                series = generate_sensor_series(120, degradations.get(code, 0.3))
                for i, reading in enumerate(series):
                    db.add(SensorData(
                        equipment_id=eq.id,
                        timestamp=now - timedelta(hours=len(series) - i),
                        **reading,
                    ))

        # Clear stale health/alerts so monitoring regenerates from real data
        await db.execute(delete(EquipmentHealthScore))
        await db.execute(delete(Prediction))
        await db.execute(delete(Alert))

        now = datetime.now(timezone.utc)
        if (await db.execute(select(FailureHistory).limit(1))).scalar_one_or_none() is None:
            rm = equipment_map["RM-MOTOR-03"]
            db.add(FailureHistory(
                equipment_id=rm.id, failure_date=now - timedelta(days=90),
                failure_mode="Bearing failure",
                root_cause="Inadequate lubrication and elevated vibration",
                downtime_hours=18.5,
                repair_action="Replaced bearing assembly and realigned motor shaft",
                severity="high",
            ))
            bf = equipment_map["BF-BLOWER-01"]
            db.add(FailureHistory(
                equipment_id=bf.id, failure_date=now - timedelta(days=45),
                failure_mode="Impeller surge",
                root_cause="Fouling and missed inspection interval",
                downtime_hours=3.2,
                repair_action="Impeller wash and filter replacement",
                severity="high",
            ))
            db.add(MaintenanceRecord(
                equipment_id=rm.id, maintenance_type="corrective",
                performed_at=now - timedelta(days=89), performed_by="Maintenance Team B",
                description="Bearing replacement and vibration analysis post-repair",
                parts_used="BRG-RMM-450 Bearing Assembly Kit",
                duration_hours=12, cost=45000, outcome="resolved",
            ))

        # Operational inputs: delay logs + SCADA fault messages
        await db.execute(delete(EquipmentDelayLog))
        await db.execute(delete(FaultMessage))
        delay_rows, fault_rows = import_operational_csvs(equipment_map)
        tata = import_all_tata_data(equipment_map)
        delay_rows.extend(tata["delay_logs"])
        fault_rows.extend(tata["fault_messages"])
        for row in delay_rows:
            db.add(EquipmentDelayLog(**row))
        for row in fault_rows:
            db.add(FaultMessage(**row))
        print(f"  Operational: {len(delay_rows)} delay logs, {len(fault_rows)} fault messages")

        # TATA supplementary sensor series (bearing RUL demo + anomaly progression log)
        for row in tata["sensor_readings"] + tata["rul_series"]:
            db.add(SensorData(**row))
        if tata["sensor_readings"] or tata["rul_series"]:
            print(
                f"  TATA samples: {len(tata['sensor_readings'])} sensor log rows, "
                f"{len(tata['rul_series'])} RUL series rows, {tata['manuals_copied']} manuals"
            )

        spare_parts = [
            ("BRG-RMM-450", "Bearing Assembly Kit - Rolling Mill", "rolling_mill_motor", 2, 3, 12500, 3),
            ("BRG-BF-220", "Blower Bearing Set", "blast_furnace_blower", 1, 2, 18000, 5),
            ("CV-BELT-800", "Conveyor Belt Section 800mm", "conveyor_system", 4, 2, 8500, 7),
            ("CR-HOOK-15T", "Crane Hook Assembly 15T", "overhead_crane", 0, 1, 32000, 14),
            ("PMP-SEAL-KIT", "Pump Mechanical Seal Kit", "cooling_pump", 3, 2, 4200, 2),
        ]
        for part_code, name, etype, qty, min_stock, cost, lead in spare_parts:
            if not (await db.execute(select(SparePart).where(SparePart.part_code == part_code))).scalar_one_or_none():
                db.add(SparePart(
                    part_code=part_code, name=name, equipment_type=etype,
                    quantity_available=qty, minimum_stock=min_stock,
                    unit_cost=cost, supplier="SteelParts India Pvt Ltd", lead_time_days=lead,
                ))

        for code, eq in equipment_map.items():
            eq.metadata_ = {**(eq.metadata_ or {}), "data_source": "NASA_CMAPSS_FD001" if used_cmapss else "synthetic_seed"}

        await db.commit()

    async with AsyncSessionLocal() as db:
        result = await get_knowledge_engine().ingest_directory(db)
        await db.commit()
        print(f"Knowledge ingested: {result}")

    async with AsyncSessionLocal() as db:
        print("Running ML monitoring scan (predictions + alerts)...")
        stats = await get_monitoring_service().run_full_scan(db)
        print(f"Monitoring complete: {stats}")

    from app.services.domain_adaptation_service import get_domain_adaptation_service

    async with AsyncSessionLocal() as db:
        domain_result = await get_domain_adaptation_service().retrain(db)
        await db.commit()
        print(f"Domain adapter trained: {domain_result}")


if __name__ == "__main__":
    asyncio.run(seed())
    print("Seed complete.")
