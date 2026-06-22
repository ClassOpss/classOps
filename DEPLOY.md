# ClassOps — Railway Deploy Checklist

Step-by-step to deploy ClassOps to Railway (Docker image + managed Postgres + cron).
Generated after the multi-tenancy work; the schema + migrations are deploy-ready.

---

## 0. Pre-flight (already verified)

- `next.config.ts` → `output: "standalone"` ✓
- `Dockerfile` multi-stage build; runner ships the standalone server + Prisma CLI + migrations ✓
- `entrypoint.sh` runs `npx prisma migrate deploy` then `node server.js` (auto-migrates every deploy) ✓
- `auth.config.ts` has `trustHost: true` (required behind Railway's proxy) ✓
- Migrations committed, including `20260621193000_add_operations` (creates the default operation) ✓

**Known constraint:** the production image does **not** include `tsx`, so `prisma db seed`
cannot run inside the container. Seed from your machine against the Railway DB URL (step 5).

---

## 1. Secrets (do NOT commit — keep in a password manager)

The actual `AUTH_SECRET` and `CRON_SECRET` values were shared separately (in chat),
not stored in this repo. Paste them straight into Railway's env vars.

Generate fresh ones any time with:
- `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (AUTH_SECRET)
- `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` (CRON_SECRET)

---

## 2. Create the Railway project

1. Push this repo to GitHub (if not already).
2. Railway → **New Project** → **Deploy from GitHub repo** → pick this repo.
   Railway detects the `Dockerfile` and builds from it.
3. **Add a service → Database → PostgreSQL** in the same project.

---

## 3. Environment variables (on the app service)

| Var | Value |
|---|---|
| `DATABASE_URL` | Reference the Postgres plugin var — set to `${{Postgres.DATABASE_URL}}` |
| `AUTH_SECRET` | the generated value above |
| `AUTH_URL` | the app's public URL, e.g. `https://classops.up.railway.app` (set after Railway assigns the domain) |
| `CRON_SECRET` | the generated value above |
| `ANTHROPIC_API_KEY` | only needed for the student-PDF import feature; can be added later |

Notes:
- Railway injects its own `PORT`; the Next standalone server reads it. The Dockerfile's
  `ENV PORT=3000` is just a fallback — no action needed.
- After the first deploy, Railway shows the generated domain → set `AUTH_URL` to it, then redeploy
  (a wrong `AUTH_URL` breaks login redirects).

---

## 4. First deploy

- Trigger the deploy (push to the deploy branch, or Railway → Deploy).
- On boot, `entrypoint.sh` runs `prisma migrate deploy` → applies all migrations to the empty DB,
  creating the schema **and** the default operation "Math by Mo" (`…0001`).
- Watch the deploy logs for `All migrations have been successfully applied`.

---

## 5. Seed the database (one-time, from your machine)

The container can't seed itself (no `tsx`). From the project root locally:

1. Railway → Postgres → **Connect** → copy the **public** connection URL.
2. Run (PowerShell):
   ```powershell
   $env:DATABASE_URL="<railway-public-postgres-url>"
   $env:SEED_ADMIN_PASSWORD="<a-strong-admin-password>"   # optional; defaults to ChangeMe123!
   npm run db:seed
   ```
   This upserts the default operation (no-op, already created by the migration), the admin
   account (Jana), the 10 schools, and the 18 starter topics — all scoped to the default operation.
3. **Change the admin password** after first login if you used the default.

---

## 6. Cron jobs (late-incident detection)

The endpoint is `POST /api/cron/check-late-incidents` (Bearer `CRON_SECRET`).
Railway cron runs a **command in a container**, not an HTTP call — so either:

**Option A — Railway cron service (a small service hitting the URL with curl):**
- Daily 9pm Cairo (`0 18 * * *` UTC, since Cairo = UTC+3 in summer / +2 in winter — see note):
  ```sh
  curl -fsS -X POST https://<app-url>/api/cron/check-late-incidents \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- Saturday 9pm Cairo (`0 18 * * 6` UTC):
  ```sh
  curl -fsS -X POST https://<app-url>/api/cron/check-late-incidents \
    -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
    -d '{"weekly":true}'
  ```

**Option B — external scheduler** (cron-job.org, GitHub Actions, Upstash QStash): same two requests.

**Timezone note:** Railway cron is **UTC**. Cairo is UTC+2 (winter) / UTC+3 (summer, DST).
9pm Cairo = `18:00` UTC in summer, `19:00` UTC in winter. Pick the offset for the active season,
or schedule at both and rely on the endpoint's idempotency (it never double-charges the same
assistant/session/type/deadline). The deadline *math* inside the app is always correct Cairo time;
only the *trigger* time needs this adjustment.

---

## 7. Smoke test (after deploy + seed)

- [ ] Visit `AUTH_URL` → redirected to `/login`.
- [ ] Log in as Jana → `/dashboard` loads, sidebar shows "Viewing: Math by Mo".
- [ ] `/operations` lists Math by Mo; onboarding form renders.
- [ ] `curl -X POST <app-url>/api/cron/check-late-incidents` with no auth → `401`.
- [ ] Same with `-H "Authorization: Bearer <CRON_SECRET>"` → `{ "ok": true, ... }`.
- [ ] Invite an assistant (Users page) → copy setup link → set password → assistant can log in.

---

## 8. Ongoing

- Every push to the deploy branch rebuilds the image; `migrate deploy` applies any new migrations
  automatically on boot. Never edit a committed migration — always add a new one.
- New teachers: onboard from `/operations` (super-admin), copy the teacher invite link to them.
