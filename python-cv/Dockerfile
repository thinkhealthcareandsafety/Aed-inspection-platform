FROM python:3.12-slim

LABEL maintainer="AED Inspection Platform"
LABEL description="AI/CV microservice — Gemini vision, inspection state machine"

# System deps for OpenCV (frame quality checks) + curl (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    libgstreamer1.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create directories
RUN mkdir -p /tmp/aed_frames /tmp/aed_uploads

# Non-root user
RUN useradd -m -u 1001 cvuser && chown -R cvuser:cvuser /app /tmp/aed_frames /tmp/aed_uploads
USER cvuser

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -f http://127.0.0.1:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--loop", "uvloop"]
