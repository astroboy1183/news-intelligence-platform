import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.routes.brief import router as brief_router
from app.api.routes.entities import router as entities_router
from app.api.routes.health import router as health_router
from app.api.routes.ingestion import router as ingestion_router
from app.api.routes.insights import router as insights_router
from app.api.routes.lookup import router as lookup_router
from app.api.routes.network import router as network_router
from app.api.routes.predictions import router as predictions_router
from app.api.routes.search import router as search_router
from app.api.routes.source_intel import router as source_intel_router
from app.api.routes.sources import router as sources_router
from app.api.routes.stories import router as stories_router
from app.api.routes.threads import router as threads_router
from app.api.routes.topics import router as topics_router
from app.api.routes.trends import router as trends_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.services.scheduler import start_scheduled_tasks


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    bg_tasks = start_scheduled_tasks()
    try:
        yield
    finally:
        for task in bg_tasks:
            task.cancel()
        for task in bg_tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception) as exc:
                logger.debug(f"scheduler task {task.get_name()} cancelled: {exc!r}")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Parse comma-separated CORS origins. "*" disables credentials per CORS spec.
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
_allow_credentials = _cors_origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(stories_router)
app.include_router(entities_router)
app.include_router(topics_router)
app.include_router(sources_router)
app.include_router(threads_router)
app.include_router(insights_router)
app.include_router(predictions_router)
app.include_router(network_router)
app.include_router(source_intel_router)
app.include_router(trends_router)
app.include_router(brief_router)
app.include_router(lookup_router)
app.include_router(search_router)
app.include_router(ingestion_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"app": settings.app_name, "status": "running"}
