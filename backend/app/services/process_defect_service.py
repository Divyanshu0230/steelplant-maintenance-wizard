"""Rule-based process defect detection from sensor readings."""

from typing import Any


def detect_process_defects(
    equipment_type: str,
    readings: dict[str, float],
    equipment_code: str = "",
) -> list[dict[str, Any]]:
    """Map sensor + op_setting patterns to steel-process defects."""
    temp = readings.get("temperature") or 0.0
    vib = readings.get("vibration") or 0.0
    pressure = readings.get("pressure") or 0.0
    current = readings.get("motor_current") or 0.0
    op1 = readings.get("operational_setting_1") or 0.0
    op2 = readings.get("operational_setting_2") or 0.0

    defects: list[dict[str, Any]] = []

    if equipment_type == "rolling_mill_motor":
        if vib > 5.0 and current > 25:
            defects.append({
                "defect": "Strip thickness variation / roll gap instability",
                "confidence": 0.78,
                "indicators": ["elevated vibration", "motor current fluctuation"],
                "action": "Inspect bearing and roll gap alignment",
            })
        if temp > 55 and current > 28:
            defects.append({
                "defect": "Thermal overload in hot rolling process",
                "confidence": 0.72,
                "indicators": ["temperature rise", "current rise at load"],
                "action": "Reduce reduction rate and verify cooling",
            })
        if pressure < 0.5 and vib > 4.0:
            defects.append({
                "defect": "Lubrication system pressure drop",
                "confidence": 0.81,
                "indicators": ["low pressure proxy", "vibration increase"],
                "action": "Check lube pump, filter, and line pressure",
            })

    elif equipment_type == "blast_furnace_blower":
        if pressure > 120 and op1 > 0.7:
            defects.append({
                "defect": "Furnace gas flow instability / pressure surge",
                "confidence": 0.75,
                "indicators": ["outlet pressure surge", "op_setting deviation"],
                "action": "Inspect impeller fouling and damper response",
            })
        if op2 > 0.75 and temp > 50:
            defects.append({
                "defect": "Combustion efficiency degradation",
                "confidence": 0.68,
                "indicators": ["op_setting_2 drift", "temperature rise"],
                "action": "Check inlet filters and gas composition",
            })

    elif equipment_type == "conveyor_system":
        if current > 30 and temp > 48:
            defects.append({
                "defect": "Feed rate interruption / belt slip risk",
                "confidence": 0.7,
                "indicators": ["motor thermal rise", "high current"],
                "action": "Inspect belt tension, alignment, and load",
            })
        if vib > 3.5:
            defects.append({
                "defect": "Material handling instability",
                "confidence": 0.65,
                "indicators": ["elevated vibration on drive"],
                "action": "Adjust tracking rollers and idler condition",
            })

    elif equipment_type == "overhead_crane":
        if vib > 2.8 and current > 22:
            defects.append({
                "defect": "Lift cycle delay / hoist brake drag",
                "confidence": 0.74,
                "indicators": ["hoist vibration", "sustained current"],
                "action": "Inspect brake clearance and hook assembly",
            })

    elif equipment_type == "cooling_pump":
        if pressure < 95:
            defects.append({
                "defect": "Utilities pressure deficit / heat exchanger loss",
                "confidence": 0.77,
                "indicators": ["discharge pressure below SOP"],
                "action": "Check seal, strainer, and suction line",
            })
        if current > 28 and pressure < 100:
            defects.append({
                "defect": "Cavitation or impeller wear",
                "confidence": 0.69,
                "indicators": ["high current at low pressure"],
                "action": "Verify NPSH and impeller condition",
            })

    if not defects and (vib > 4 or temp > 52):
        defects.append({
            "defect": "General process stress on equipment",
            "confidence": 0.55,
            "indicators": ["sensor readings above typical baseline"],
            "action": f"Review trend for {equipment_code} and correlate with delay logs",
        })

    return defects
