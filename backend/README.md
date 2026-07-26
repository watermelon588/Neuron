---
title: Neuron API
emoji: 🧠
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
---

# Neuron — backend

FastAPI backend for the Neuron multimodal search platform, deployed as a
Hugging Face **Docker Space**. HF reads the YAML frontmatter above to build
the `Dockerfile` in this directory and route traffic to port 8000.

This is the API only. The frontend lives on Vercel and points at this Space's
URL via `VITE_API_BASE_URL`.

## Configuration

Set these under **Settings → Variables and secrets** (mark the credentials as
*secrets*, the rest as *variables*):

| Name | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |
| `TRUSTED_PROXY_HOPS` | `1` |
| `SECRET_KEY` | a 64-char hex string (`python -c "import secrets;print(secrets.token_hex(32))"`) |
| `MONGODB_URI` | your MongoDB Atlas SRV string |
| `SERPER_API_KEY` | from serper.dev |
| `GROQ_API_KEY` | from console.groq.com/keys |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://your-app.vercel.app` |

Free CPU Spaces have ephemeral storage, so uploaded documents and downloaded
model weights reset when the Space restarts (weights then re-download on first
use). Add HF persistent storage if you need uploads to survive restarts.
