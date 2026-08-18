"""
AED Inspection CV Microservice — FastAPI entry point.

Serves one Gemini-driven analysis endpoint per checklist item (see
app/services/checklist_items.py) — a discrete photo/video upload in,
one structured verdict out. No live video streaming or session state
machine; each call is independent.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import structlog

from app.core.config import settings
from app.core.logger import configure_logging, get_logger
from app.api.routes import checklist, health

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    logger.info("cv_service.startup", version=settings.APP_VERSION)

    if not settings.GEMINI_API_KEY:
        logger.warning("cv_service.gemini_api_key_missing")

    yield

    logger.info("cv_service.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # REST routes
    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(checklist.router, prefix="/api/v1/checklist", tags=["checklist"])

    return app


app = create_app()
