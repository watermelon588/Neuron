# Deploy the Neuron backend on an Oracle Always-Free VM

Full features, genuinely $0, using Oracle's Always-Free ARM VM (24 GB RAM) plus
**Tailscale Funnel** for a stable public HTTPS URL — no domain to buy, no Oracle
firewall rules to fight, valid TLS cert (which cross-site cookies require).

Frontend still goes on Vercel (free); this is only the backend/API.

```
Browser ──HTTPS──▶ Tailscale Funnel ──▶ 127.0.0.1:8000 (Docker container on the VM)
                   https://<machine>.<tailnet>.ts.net
```

---

## 1. Create the VM (Oracle Cloud)

1. Sign up at cloud.oracle.com (needs a card for identity verification; the
   Always-Free resources are never charged).
2. **Instances → Create instance:**
   - Image: **Ubuntu 24.04**
   - Shape: **Ampere (Arm) → VM.Standard.A1.Flex**, set **4 OCPU / 24 GB RAM**
     (all within Always-Free).
   - Add your SSH public key (or let Oracle generate a keypair and download it).
3. Create, then note the instance's **public IP**.
4. SSH in:
   ```bash
   ssh ubuntu@<public-ip>
   ```

> You do **not** need to touch Oracle's Security Lists / ingress rules — the
> Funnel is an outbound tunnel, so no inbound ports are opened.

## 2. Install Docker + git on the VM

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker
```

## 3. Get the code and configure secrets

```bash
git clone https://github.com/<you>/<repo>.git neuron && cd neuron/deploy/oracle
cp .env.example .env
nano .env        # fill in every value; SECRET_KEY:  openssl rand -hex 32
```

Set `CORS_ORIGINS` to your Vercel URL. If you haven't deployed the frontend yet,
put a placeholder now and re-edit after step 6 (then `docker compose restart`).

In **MongoDB Atlas → Network Access**, add `0.0.0.0/0` (the VM has no static
egress IP on the free tier).

## 4. Build and run

```bash
docker compose up -d --build
```

First build is slow (~10–20 min: PyTorch + friends compile/download natively on
ARM). Check it came up:

```bash
docker compose logs -f          # Ctrl-C to stop following
curl -s http://127.0.0.1:8000/health   # -> {"status":"ok"}
```

Models download lazily on first real request and are cached on the persistent
volume, so that cost is paid once.

## 5. Publish it with Tailscale Funnel

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                # opens a login URL — authenticate in a browser
sudo tailscale funnel 8000       # serves localhost:8000 to the public over HTTPS
```

`tailscale funnel status` prints your public URL — it looks like
`https://<machine>.<tailnet>.ts.net`. It is **stable** across restarts. To run
the funnel persistently in the background:

```bash
sudo tailscale funnel --bg 8000
```

Verify from your laptop:

```bash
curl -s https://<machine>.<tailnet>.ts.net/health   # -> {"status":"ok"}
```

## 6. Point the frontend at it

- **Vercel** → your project → Settings → Environment Variables:
  `VITE_API_BASE_URL = https://<machine>.<tailnet>.ts.net` → redeploy.
- Back on the VM, make sure `.env`'s `CORS_ORIGINS` is your Vercel origin, then
  `docker compose restart`.

Done — the Vercel frontend now talks to your free, full-featured backend.

---

## Day-2 operations

| Task | Command (in `deploy/oracle`) |
|---|---|
| View logs | `docker compose logs -f` |
| Restart after editing `.env` | `docker compose restart` |
| Update to latest code | `git pull && docker compose up -d --build` |
| Stop | `docker compose down` (add `-v` to also wipe the storage volume) |
| Funnel status / URL | `sudo tailscale funnel status` |

**Notes**

- ARM wheels exist for torch, faiss-cpu and the rest; the image builds natively
  on the VM. If one package ever lacks an arm64 wheel and fails to build, that's
  the thing to search for — the rest of the stack is unaffected.
- Rate limiting keys on the client IP via `X-Forwarded-For`; if Funnel doesn't
  forward it, requests bucket together harmlessly. Not a security issue.
- The `render.yaml` and `backend/README.md` (HF Space config) elsewhere in the
  repo are alternative hosts — ignore them for this path.
