"""ISO 10816 vibration severity zones (mm/s RMS) for rotating equipment."""

from dataclasses import dataclass


@dataclass
class Iso10816Result:
    zone: str
    severity: str
    label: str
    threshold_max_mm_s: float


def assess_vibration_iso10816(vibration_mm_s: float) -> Iso10816Result:
    """Classify vibration velocity per ISO 10816 Zone A–D."""
    if vibration_mm_s < 2.8:
        return Iso10816Result("A", "normal", "Good (Zone A)", 2.8)
    if vibration_mm_s < 7.1:
        return Iso10816Result("B", "warning", "Acceptable (Zone B)", 7.1)
    if vibration_mm_s < 18.0:
        return Iso10816Result("C", "high", "Unsatisfactory (Zone C)", 18.0)
    return Iso10816Result("D", "critical", "Unacceptable (Zone D)", 18.0)
