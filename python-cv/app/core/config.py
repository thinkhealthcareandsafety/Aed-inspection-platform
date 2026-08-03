"""
Application configuration using pydantic-settings.
All values can be overridden via environment variables.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AED Inspection CV Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    WORKERS: int = 4

    # Security
    SECRET_KEY: str = Field(default="change-me-in-production-please", env="SECRET_KEY")
    ALGORITHM: str = "HS256"

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "aed_inspection"

    # Redis (frame queue & caching)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Gemini Vision
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")

    # Inspection parameters
    FRAME_QUALITY_BLUR_THRESHOLD: float = 100.0
    FRAME_QUALITY_BRIGHTNESS_MIN: float = 40.0
    FRAME_QUALITY_BRIGHTNESS_MAX: float = 220.0
    FRAME_QUALITY_CONTRAST_MIN: float = 30.0
    CAPTURE_CONFIDENCE_THRESHOLD: float = 0.80
    LED_BLINK_DETECTION_FRAMES: int = 30
    LED_BLINK_FPS: float = 10.0

    # Storage
    UPLOAD_DIR: str = "/tmp/aed_uploads"
    CAPTURED_FRAMES_DIR: str = "/tmp/aed_frames"
    MAX_UPLOAD_SIZE_MB: int = 50

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Backend Node.js service URL (for callbacks)
    BACKEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CAPTURED_FRAMES_DIR, exist_ok=True)
