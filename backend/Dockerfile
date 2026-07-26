# Neuron backend image.
#
# Docker (not Render's native Python runtime) because the app needs two things
# the native runtime can't give it: the FFmpeg *binary* (Whisper shells out to
# it to decode audio/video) and git (pip installs CLIP from a git URL).
FROM python:3.13-slim-bookworm

# ffmpeg  → audio/video transcription
# git     → the `clip @ git+https://...` requirement
# The rest are common build prerequisites for scientific wheels; kept minimal.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Cache HuggingFace model weights on the mounted disk so they survive
    # restarts instead of re-downloading (~2 GB) on every cold start.
    HF_HOME=/app/storage/hf-cache

# Install deps first so the layer caches across code-only changes.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Render (and most PaaS) inject the port to bind via $PORT; default for local
# `docker run`. Shell form so the variable expands.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
