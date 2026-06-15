from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


def migrate_alerts_resolve_columns(conn: Connection) -> None:
    """Add resolve columns to alerts if missing (SQLite-safe)."""
    inspector = inspect(conn)
    if "alerts" not in inspector.get_table_names():
        return

    existing = {col["name"] for col in inspector.get_columns("alerts")}
    additions = [
        ("is_resolved", "BOOLEAN DEFAULT 0 NOT NULL"),
        ("resolved_by", "INTEGER"),
        ("resolved_at", "DATETIME"),
        ("resolution_type", "VARCHAR(80)"),
        ("resolution_notes", "TEXT"),
    ]
    for name, col_type in additions:
        if name not in existing:
            conn.execute(text(f"ALTER TABLE alerts ADD COLUMN {name} {col_type}"))
