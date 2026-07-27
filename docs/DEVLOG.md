# Devlog — 2026-07-26

A full day's work: fixed a voice-capture bug, hardened security for deployment,
fixed responsive layout issues, rewrote the README, quarantined dead files,
prepared deployment kits, and built a one-command Cloudflare-tunnel demo. This
log records what changed and — as importantly — the difficulties hit along the
way and how each was resolved.

---

## 1. Voice capture fix

**Symptom:** the voice search recorder produced a 3 KB clip and the server
replied "No speech was detected in the recording."

**Diagnosis:** that message comes from our own backend and only fires when
Whisper decoded the audio but got an empty transcript — i.e. the mic captured
**silence**. The UI gave no way to tell "silent mic" from "server didn't
understand"; the "listening" bars were a hardcoded animation, not real input.

**Changes** ([frontend/src/components/SearchBar.jsx](../frontend/src/components/SearchBar.jsx),
[backend/app/ml/inference.py](../backend/app/ml/inference.py),
[backend/app/api/v1/endpoints/search.py](../backend/app/api/v1/endpoints/search.py)):

- Live mic-level meter via an `AnalyserNode` — the bars now reflect real RMS, so
  a dead mic is visible immediately. Shows the selected device name.
- `getUserMedia` now requests `noiseSuppression: false` (some Windows drivers
  gate quiet speech to digital silence).
- Local pre-flight: takes under 700 ms or peak under 1 % get a specific message
  instead of a wasted round-trip.
- Backend `audio_stats()` probes duration + peak so the API distinguishes
  "too short", "silent", and "genuinely unintelligible".

**Difficulty — the false "muted" error.** A first cut treated
`MediaStreamTrack.muted == true` as a hard error, but that flag can read true for
a moment right after acquisition. Reworked it into a **self-clearing warning**
that subscribes to the track's `mute`/`unmute` events and retracts the moment
real samples arrive. The user's actual problem turned out to be a genuine
**Windows system-level mic mute** — so the feature worked; the OS was sending no
audio. Confirmed fixed once unmuted.

---

## 2. Security hardening (pre-deploy)

A read-only audit first, then fixes — without changing app behaviour.

**Findings fixed:**

- **Dependency CVEs** — `npm audit fix` moved react-router 7.14→7.18 (RCE, open
  redirect, DoS, CSRF), vite→8.1.5, postcss→8.5.22. 0 vulnerabilities after.
- **SSRF** in thumbnail re-ranking — new [backend/app/core/net.py](../backend/app/core/net.py)
  requires every outbound URL to resolve to a public unicast address, and
  redirects are followed manually so each hop is re-validated. Blocks the cloud
  metadata IP, loopback, private ranges, `file://`.
- **CSRF** — new `CsrfOriginMiddleware` rejects state-changing requests with a
  foreign `Origin`, covering the multipart endpoints CORS preflight doesn't.
- **Rate-limit / login brute force** — proxy-aware client IP (`TRUSTED_PROXY_HOPS`)
  and a per-(IP+email) failed-login throttle ([backend/app/core/throttle.py](../backend/app/core/throttle.py)).
- **Upload magic bytes** — added EBML (webm/mkv) and ISO-BMFF (mp4/mov/m4a) checks.
- **Production boot guard** — refuses to start on an unset `SECRET_KEY`,
  insecure cookies, or `CORS_ORIGINS=*`.
- **`dev-run.log`** untracked; `*.log` gitignored.

**Difficulty — a leaked live API key.** The first secret scan (prefix-based)
missed it, but `backend/.env.example` held a **real Serper key** (a bare 40-char
hex, no telltale prefix), committed and pushed to a public repo. Replaced with a
placeholder — but the key is in git history and **must be rotated**; scrubbing
history is secondary to rotation.

**Verification:** a 20-check script exercised CSRF (same-origin passes,
cross-origin blocked), the login throttle, and every container magic-byte case —
20/20 passed. SSRF guard confirmed against the metadata IP, loopback, private
ranges. Backend booted clean under the production config.

---

## 3. Layout & responsiveness

Measured live at 375 / 768 / 1280 px across all public routes.

- **Correction:** the "gallery bleeds off-screen on mobile" finding was a
  **measurement artifact** — the browser pane was hidden, so `ResizeObserver`
  never fired and the gallery kept its desktop scale. On a real load it scales
  correctly. Nothing to fix there.
- **Real fix — 4 px horizontal overflow:** traced to the decorative
  `.heading-glow::before` aura bleeding 24 px past its box on mobile (it counts
  toward `scrollWidth`). Zeroed its horizontal bleed on phones.
- **Tap targets:** a `.tap-target` helper enlarges small footer/nav/auth links
  to ~38–44 px using vertical padding + negative margin (grows the hit area,
  leaves layout identical). Search input stretched to the full pill height.

**Difficulty — overlapping hit areas.** The enlarged "Terms · Privacy" links
overlapped by 6 px (a single middot between them). Reduced the helper's
horizontal padding to 4 px so adjacent inline links never overlap while keeping
the vertical gain. Verified zero overflow and zero sub-24 px targets remain
except inline-in-prose links (which the WCAG target-size exception exempts).

---

## 4. README rewrite + file quarantine

- Rewrote [README.md](../README.md): brand lockup (light/dark), product
  screenshots, architecture, quick start, API table, security, deployment.
- Moved ~9.5 MB of unreferenced files (unused logo variants, scaffold
  leftovers, superseded mockups, orphaned public images) into a gitignored
  `_archive/` — `git mv` to preserve history, **nothing deleted**.

Verified after the move: ESLint clean, production build succeeds, all routes
render with zero broken images.

---

## 5. Deployment — the journey to "free"

The goal was a free live deploy. This took several pivots as each "free" option
fell through:

1. **Vercel + Render.** Prepared [frontend/vercel.json](../frontend/vercel.json)
   (SPA rewrites) and fixed the backend requirements (below). **Blocker:** the
   backend needs ~2 GB RAM for torch + Whisper + CLIP + BLIP; Render's free
   512 MB OOMs on the first model load.
2. **Hugging Face Spaces (Docker).** Prepared [backend/Dockerfile](../backend/Dockerfile)
   + [render.yaml](../render.yaml) + an HF Space config. **Blocker:** a
   screenshot revealed HF now puts **Docker Spaces behind a paid PRO plan** —
   only Static Spaces are free. The old free CPU tier is gone.
3. **Oracle Cloud Always-Free VM** (24 GB ARM, genuinely $0, runs everything).
   Prepared [deploy/oracle/](../deploy/oracle/) — Docker Compose + Tailscale
   Funnel for stable HTTPS with no domain and no Oracle firewall fiddling.
   **Blocker:** Oracle requires a credit card for identity verification, which
   the user doesn't have yet.
4. **Run locally + Cloudflare quick tunnel** (see §6) — the actual solution:
   no card, no account, no host.

**Difficulty — `requirements.txt` was unusable for Linux.** The committed file
was **UTF-16 encoded** (pip can't parse it on Linux), pinned **`pywin32`**
(Windows-only — a hard install failure), was **missing `pymongo`** entirely, and
was a 168-line `pip freeze` full of unused SDKs (azure, boto3, anthropic…).
Worse, its pins were **stale** versus the working venv. Rebuilt it as a clean,
UTF-8, direct-dependency file pinned to the actual venv versions, with a
CPU-only PyTorch index so it doesn't pull ~2 GB of CUDA wheels. Original kept at
`_archive/root/`.

---

## 6. Cloudflare quick-tunnel demo

The zero-cost way to share the running app: serve everything from one local
origin and expose it on a temporary `trycloudflare.com` HTTPS URL.

**Backend changes** (all gated behind a new `SERVE_FRONTEND` flag, so API-only
deploys are unaffected):

- [config.py](../backend/app/core/config.py) — `SERVE_FRONTEND` flag + `frontend_dist` path.
- [main.py](../backend/app/main.py) — serves the built SPA, bundle under `/assets`,
  deep-link fallback to `index.html`, while `/api` and `/docs` stay intact.
- [middleware.py](../backend/app/core/middleware.py) — a proper CSP for the
  served app (allows Font Awesome/cdnjs, Google Fonts, `blob:` previews, `https:`
  thumbnails, Cloudinary) while the API keeps its locked-down policy; plus a more
  robust same-origin CSRF check (Origin host vs Host header, so it works behind
  an HTTPS tunnel fronting a plain-HTTP app).
- [scripts/share.ps1](../scripts/share.ps1) + [scripts/SHARE.md](../scripts/SHARE.md) —
  one command: start backend serving the build, open the tunnel, print the URL.

**Why single-origin:** serving API + SPA from one URL means the browser sees one
site — no CORS, no cross-site-cookie config, login just works. Verified
end-to-end locally: SPA at `/`, deep links fall back, `/api` isolated with its
own CSP, same-origin POST passes CSRF while cross-origin is blocked.

**Difficulties hit while getting the tunnel working:**

- **Sandbox couldn't test the edge.** The dev environment blocks cloudflared's
  outbound port 7844 (both QUIC and TCP), so the live handshake couldn't be
  validated from here — only on the user's machine.
- **`*` glob expansion.** `--forwarded-allow-ips "*"` got expanded by the shell
  into filenames. Switched to `127.0.0.1` (cloudflared connects from localhost).
- **Slow first start.** The backend takes ~30–60 s to warm up (imports); the
  health-check poll was bumped to 120 s so it doesn't time out.
- **Build step failed.** `npm run build` inside the script tripped a
  `$LASTEXITCODE` quirk. Since the build already exists, the script now **skips
  building** and just uses `frontend/dist`.
- **QUIC blocked (user's network).** `cloudflared` kept retrying QUIC (UDP 7844)
  with `quic: timeout` and never fell back. Set `--protocol http2` (TCP) as the
  default — that connected.
- **Error 1033.** The script printed the URL the instant it appeared — before
  the tunnel finished connecting — so opening it hit 1033. Fixed by **waiting
  for the `Registered tunnel connection` log line** before showing the URL, and
  reporting a clear message if it never connects.
- **Clean console.** Backend and tunnel logs now go to files under
  `%TEMP%\neuron-share\`; the console shows only status and the URL banner.

Confirmed working on the user's machine after these fixes.

---

## Follow-ups / still open

- **Rotate the Serper API key** — still live in git history.
- **Deployment blockers if hosting for real:** the SPA host needs the
  `/index.html` rewrite (done for Vercel), and a real backend host needs ≥2 GB
  RAM. Oracle Always-Free is the $0 path once a card is available.
- **Bundle size:** the frontend ships one ~565 KB JS chunk and a 3.2 MB
  autoplaying background video — worth code-splitting / compressing later.
