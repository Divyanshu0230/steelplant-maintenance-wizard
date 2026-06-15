"""In-memory live event stream for monitoring UI."""

from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

_events: deque[dict[str, Any]] = deque(maxlen=200)
_last_scan_at: Optional[str] = None
_last_scan_stats: dict[str, Any] = {}


def record_event(
    event_type: str,
    message: str,
    *,
    equipment_code: Optional[str] = None,
    severity: str = "info",
    data: Optional[dict] = None,
) -> dict[str, Any]:
    entry = {
        "id": len(_events) + 1,
        "type": event_type,
        "message": message,
        "equipment_code": equipment_code,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data or {},
    }
    _events.appendleft(entry)
    return entry


def set_last_scan(stats: dict[str, Any]) -> None:
    global _last_scan_at, _last_scan_stats
    _last_scan_at = datetime.now(timezone.utc).isoformat()
    _last_scan_stats = stats


def get_last_scan() -> dict[str, Any]:
    return {"timestamp": _last_scan_at, "stats": _last_scan_stats}


def get_events(limit: int = 50) -> list[dict[str, Any]]:
    return list(_events)[:limit]
