# Share the live app over a temporary Cloudflare tunnel

Run Neuron on your own PC and hand someone a public HTTPS link to try it — no
account, no domain, no credit card, no deploy. The link is alive only while the
script runs; close it and the link dies. Your server never leaves your machine.

## One-time prerequisites

- **cloudflared** — `winget install --id Cloudflare.cloudflared`
- Backend venv built (`backend/.venv`) and `backend/.env` filled in (Mongo URI,
  Serper/Groq keys) — the same file you already use for local dev.
- A frontend build present at `frontend/dist`. Create it once with
  `cd frontend; npm run build`, and rebuild only when you change the UI. The
  share script uses the existing build; it does not rebuild.

## Every time you want to share

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\share.ps1
```

It starts the backend serving the existing build (frontend + API) on one origin,
opens the tunnel, and prints the link in a banner:

```
  +==========================================================+
  |    LIVE:  https://<random-words>.trycloudflare.com    |
  +==========================================================+
```

Copy / open / share that URL. **Ctrl+C** stops everything and kills the link.
The console stays clean — backend and tunnel logs go to files under
`%TEMP%\neuron-share\` (path is printed under the banner) if you need to debug.

## How it works

The backend serves the API *and* the built frontend from one origin
(`SERVE_FRONTEND=true`), so the tunnel exposes one URL and there's no CORS or
cross-site-cookie setup — it's all same-origin. `cloudflared` gives it a public
HTTPS address with a valid cert, which is what makes login cookies work.

```
Visitor ──HTTPS──▶ trycloudflare.com ──▶ 127.0.0.1:8000 (your PC: API + SPA)
```

## Notes & gotchas

- **First start takes ~30–60 s** (Python imports warming up) before the tunnel
  opens. The script waits for it; the dots are normal.
- **The URL is random and changes every run.** Quick tunnels are ephemeral by
  design — fine for a "look at this now" share, not a permanent address.
- **Transport is `http2` (TCP), not QUIC.** This network blocks QUIC's UDP port
  7844 (the `quic: timeout` errors), so the script uses TCP. If you move to a
  network that allows UDP, set `$protocol = 'quic'` near the top of the script
  for a slightly faster tunnel.
- **It's your PC.** Traffic hits your machine and your MongoDB while the tunnel
  is open. Only share the link with people you're comfortable giving a live look.
- This changes nothing about the Vercel / Oracle / Render options — it's just a
  zero-setup way to demo before (or instead of) a real deploy.
