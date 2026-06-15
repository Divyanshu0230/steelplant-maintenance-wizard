import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    ai_status,
    alerts,
    auth,
    chat,
    conversations,
    diagnosis,
    domain,
    equipment,
    feedback,
    knowledge,
    logbook,
    operational,
    plant,
    procurement,
    reports,
    sensors,
    monitoring,
    spare_parts,
    websocket,
)
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.db.database import AsyncSessionLocal, Base, engine
from app.db.migrations import migrate_alerts_resolve_columns
from app.services.monitoring_service import get_monitoring_service

settings = get_settings()
setup_logging()
logger = get_logger(__name__)

MONITORING_INTERVAL_SEC = 60


async def _monitoring_loop() -> None:
    await asyncio.sleep(5)
    while True:
        try:
            async with AsyncSessionLocal() as db:
                stats = await get_monitoring_service().run_full_scan(db)
                logger.info("Background monitoring: %s", stats)
        except Exception as exc:
            logger.warning("Background monitoring error: %s", exc)
        await asyncio.sleep(MONITORING_INTERVAL_SEC)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(migrate_alerts_resolve_columns)
    task = asyncio.create_task(_monitoring_loop())
    from app.services.monitoring_events import record_event
    record_event("system", "Live monitoring service started — ML scan every 60s", severity="info")
    yield
    task.cancel()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = settings.api_prefix
app.include_router(auth.router, prefix=api_prefix)
app.include_router(equipment.router, prefix=api_prefix)
app.include_router(chat.router, prefix=api_prefix)
app.include_router(ai_status.router, prefix=api_prefix)
app.include_router(diagnosis.router, prefix=api_prefix)
app.include_router(domain.router, prefix=api_prefix)
app.include_router(alerts.router, prefix=api_prefix)
app.include_router(reports.router, prefix=api_prefix)
app.include_router(feedback.router, prefix=api_prefix)
app.include_router(knowledge.router, prefix=api_prefix)
app.include_router(sensors.router, prefix=api_prefix)
app.include_router(logbook.router, prefix=api_prefix)
app.include_router(spare_parts.router, prefix=api_prefix)
app.include_router(procurement.router, prefix=api_prefix)
app.include_router(conversations.router, prefix=api_prefix)
app.include_router(plant.router, prefix=api_prefix)
app.include_router(operational.router, prefix=api_prefix)
app.include_router(monitoring.router, prefix=api_prefix)
app.include_router(websocket.router, prefix=api_prefix)


@app.get("/health")
async def health_check():
    from app.services.llm_service import get_llm_status

    ai = get_llm_status()
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "ai": {
            "gemini_ready": ai["gemini_ready"],
            "model": settings.gemini_model,
        },
    }
