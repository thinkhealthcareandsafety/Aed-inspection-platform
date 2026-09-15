"""
AED Inspection CV Microservice — FastAPI entry point.

Serves one Gemini-driven analysis endpoint per checklist item (see
app/services/checklist_items.py) — a discrete photo/video upload in,
one structured verdict out. No live video streaming or session state
machine; each call is independent.
"""
import socket
from contextlib import asynccontextmanager
from fastapi import FastAPI

# Some container hosts (e.g. Render) advertise AAAA records for Google's API
# but have no IPv6 route at all — a plain socket connect() fails instantly
# with "Network unreachable", but the async HTTP client used by the Gemini
# SDK doesn't fall back to IPv4 as fast, and calls hang until our own 40s
# timeout kills them. Forcing IPv4-only resolution for the whole process
# sidesteps that entirely; every outbound call in this service (Gemini
# included) only ever needs IPv4.
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)


socket.getaddrinfo = _ipv4_only_getaddrinfo
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
