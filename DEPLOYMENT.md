# BookEase Deployment Guide

This guide takes you from a local project to a live application using:

- **GitHub** — public source repository
- **Neon** (recommended) or **Supabase** — production PostgreSQL
- **Render** — Express backend API
- **Vercel** — React + Vite frontend
- **Resend** — booking emails
- **UploadThing** — service/provider images

You do not need to rebuild the app. The repository already contains `render.yaml`, `frontend/vercel.json`, Prisma migrations, environment examples, and a production smoke test.

> **Important:** replace every `<placeholder>` with your own value. Never paste real secrets into GitHub, screenshots, chat messages, or the README.

---

## 0. Before you start

You need accounts for:

- [GitHub](https://github.com)
- [Neon](https://neon.tech) or [Supabase](https://supabase.com)
- [Render](https://render.com)
- [Vercel](https://vercel.com)
- [Resend](https://resend.com)
- [UploadThing](https://uploadthing.com)

Install locally:

- Node.js 20.19 or newer (22 LTS recommended)
- Git
- npm

Check versions:

```bash
node --version
npm --version
git --version
```

---

## 1. Verify the application locally

Always confirm the app works locally before deploying.

### Backend

```bash
cd backend
npm install
```

Create `backend/.env` from `backend/.env.example` and fill in:

```dotenv
PORT=5000
HOST=0.0.0.0
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/appointment_booking?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
```

Then:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open another terminal and check:

```bash
curl http://localhost:5000/api/health
```

You should see HTTP `200` and `"database": "ok"`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, log in as the seeded admin (`admin@bookease.com` / `Admin@123`), and confirm services and providers load.

### Automated checks

```bash
cd backend
npm test
npm run smoke

cd ../frontend
npm run build
npm run lint
```

Fix any failure before continuing.

---

## 2. Create the production PostgreSQL database (Neon)

Neon is recommended because it is fast to set up and works well with Prisma.

1. Sign in to [Neon](https://console.neon.tech).
2. Click **New Project**.
3. Choose a name (for example `bookease`) and the region closest to your Render region.
4. Open **Connection Details**.
5. Select **Prisma** or **Node.js** and copy the connection string.
6. Keep the password somewhere safe.

The connection string looks like:

```text
postgresql://USER:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Direct vs pooled connection

- Use the **direct** host (without `-pooler`) for Prisma migrations.
- The pooled host is fine for normal API traffic, but migrations are more reliable on the direct connection.
- For a small capstone project, using the direct connection for `DATABASE_URL` is the simplest reliable choice.

### Apply migrations and seed data

From your local machine, temporarily point `backend/.env` at the production database:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Then run:

```bash
cd backend
npm run db:generate
npm run db:deploy
npm run db:seed
```

`db:deploy` runs `prisma migrate deploy` and applies every committed migration. It does not reset existing data.

Verify in Neon's **Tables** view that these tables exist:

- `User`
- `Category`
- `Service`
- `Specialist`
- `SpecialistService`
- `WorkingHour`
- `SpecialistDateException`
- `Appointment`

Restore your local `DATABASE_URL` afterwards.

> **Seed warning:** `npm run db:seed` upserts the demo admin and resets its password to `Admin@123`. Change the admin password after deployment. Do not run the seed repeatedly on a live database unless you intend to reset the admin password.

### Supabase alternative

1. Create a Supabase project.
2. Open **Project Settings → Database → Connection string**.
3. Prefer the **Session pooler** or direct connection that Prisma supports.
4. Use the same `db:deploy` and `db:seed` commands.
5. If you use the transaction pooler, add `?pgbouncer=true` and use a direct connection for migrations when possible.

---

## 3. Push the project to GitHub

The project is currently prepared for Git but you must create the remote repository with your own account.

### 3.1 Create an empty public repository

1. Open [github.com/new](https://github.com/new).
2. Repository name: `appointment-booking-system` (or your preferred name).
3. Visibility: **Public**.
4. Do **not** initialize with a README, `.gitignore`, or license (the project already has them).
5. Click **Create repository**.
6. Copy the HTTPS URL, for example:

```text
https://github.com/<your-username>/appointment-booking-system.git
```

### 3.2 Initialize and push

From the project root:

```bash
git init
git branch -M main
git add .
git status
```

**Before committing, confirm that `backend/.env` is not listed.** It must be ignored by `.gitignore`.

Create incremental commits with conventional messages:

```bash
git commit -m "chore: initialize repository with project structure"
git add backend
git commit -m "feat(api): add Express, Prisma and PostgreSQL backend"
git add frontend
git commit -m "feat(web): add React customer and admin interface"
git add README.md DEPLOYMENT.md TESTING.md render.yaml frontend/vercel.json .gitignore
git commit -m "docs: add deployment guide and final testing checklist"
git remote add origin https://github.com/<your-username>/appointment-booking-system.git
git push -u origin main
```

If you prefer smaller commits, split the `backend` and `frontend` commits further by feature (auth, booking, admin, email, uploads). The important rule is: **no secrets and no `.env` files in any commit.**

### 3.3 If a secret was ever committed

1. Rotate the secret immediately (database password, JWT secret, Resend key, UploadThing token).
2. Remove it from the repository history (for example with `git filter-repo`).
3. Force-push only after you understand the impact.
4. Never rely on deleting the file in a later commit — history still contains it.

---

## 4. Deploy the backend to Render

### Option A — Blueprint (recommended)

The repository includes `render.yaml`.

1. Sign in to [Render](https://dashboard.render.com).
2. Click **New + → Blueprint**.
3. Connect your GitHub account and select the repository.
4. Render reads `render.yaml` and creates the `bookease-api` web service.
5. Fill in the values marked `sync: false`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon/Supabase connection string |
| `FRONTEND_URL` | Your Vercel URL (you can use a temporary value now and update it after step 5) |
| `CORS_ORIGINS` | Optional extra origins, comma-separated (production alias and this project's preview URLs are already handled) |
| `APP_URL` | Deployed frontend URL used in email links (recommended; falls back to `FRONTEND_URL`) |
| `RESEND_API_KEY` | Your Resend key |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `BookEase <no-reply@yourdomain.com>` (required in production) |
| `ADMIN_NOTIFICATION_EMAIL` | Admin inbox(es) |
| `UPLOADTHING_TOKEN` | Complete V7 token from UploadThing Dashboard → API Keys → V7 (backend only) |

6. Apply the Blueprint.

The Blueprint uses:

```text
Root directory:   backend
Build command:    npm install --include=dev && npm run db:generate && npm run db:deploy
Start command:    npm start
Health check:     /api/health
```

`npm run db:deploy` applies Prisma migrations during the build. `npm run db:generate` recreates the Prisma client, which is intentionally not committed.

### Option B — Manual web service

1. Click **New + → Web Service**.
2. Connect the repository.
3. Set:
   - **Name:** `bookease-api`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install --include=dev && npm run db:generate && npm run db:deploy`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Plan:** Free (for a capstone demo)
4. Add the environment variables listed above.
5. Click **Create Web Service**.

### 4.1 Seed the production database

After the first successful deploy, open the Render service → **Shell** and run:

```bash
npm run db:seed
```

This creates the categories, services, providers, working hours, and admin account. It is idempotent and does not delete existing appointments.

If the Shell is unavailable on your plan, run the seed locally with `DATABASE_URL` pointed at production.

### 4.2 Verify the backend

Open:

```text
https://<your-service>.onrender.com/api/health
```

Expected:

```json
{
  "status": "ok",
  "message": "Backend and database are reachable",
  "database": "ok",
  "timestamp": "..."
}
```

If you see `503`, the API is running but the database is not reachable. Check `DATABASE_URL`, the Neon project status, and whether migrations ran.

### 4.3 Render notes

- Free services sleep after inactivity; the first request may take 30–60 seconds.
- Keep the service in the same region as the database when possible.
- Use **Environment → Add Environment Variable** for changes, then redeploy.
- Never put secrets in `render.yaml`; use `sync: false` or the dashboard.
- View **Logs** to confirm startup, email warnings, and database errors.

---

## 5. Deploy the frontend to Vercel

1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New → Project**.
3. Import your GitHub repository.
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add an environment variable:
   - **Name:** `VITE_API_BASE`
   - **Value:** `https://<your-service>.onrender.com/api`
   - Apply to **Production**, **Preview**, and **Development** if desired.
6. Click **Deploy**.

`frontend/vercel.json` already configures:

- SPA rewrites so React Router pages work after refresh.
- Long-lived caching for hashed assets.

### 5.1 Update backend CORS

CORS is an allowlist with one generated exception: Vercel preview deployments of
**this project and team**. Set the primary origin after Vercel gives you the
production URL:

1. Go to Render → your service → **Environment**.
2. Set:

```text
FRONTEND_URL=https://bookease-appointment-booking-system.vercel.app
```

3. Optional: add a custom domain or extra origin:

```text
CORS_ORIGINS=https://www.yourdomain.com
```

4. Optional: override the preview project/team slugs if the Vercel project moves.
   The defaults are `bookease-appointment-booking-system` and `melisha`:

```text
VERCEL_PREVIEW_PROJECT=bookease-appointment-booking-system
VERCEL_PREVIEW_TEAM=melisha
ALLOW_VERCEL_PREVIEWS=true
```

With the defaults, these are accepted automatically without listing each URL:

```text
https://bookease-appointment-booking-system.vercel.app                     (production alias)
https://bookease-appointment-booking-system-git-main-melisha.vercel.app     (git main alias)
https://bookease-appointment-booking-system-<deployment-id>-melisha.vercel.app (unique previews)
```

The preview rule is a strict project + team hostname pattern, not a
`*.vercel.app` wildcard, so unrelated Vercel projects remain blocked.

5. Save and redeploy the backend. Environment changes do not apply to the
   running instance until the service restarts.

### 5.2 Verify the frontend

Open the Vercel URL and test:

- Home page loads.
- Services and providers load from the live API.
- Refresh a deep link such as `/services` or `/admin/appointments` — it must not return a 404.
- Register a customer and log in.
- Create a booking and confirm it appears in booking history.
- Log in as admin and open the dashboard.

Open the browser DevTools **Console** and **Network** tabs. There should be no CORS errors and no failed API requests.

---

## 6. Configure Resend (production email)

The application already uses Resend and preserves the six templates (booking confirmation, admin new-booking alert, confirmed, rejected, cancelled, completed). Production requires a verified sending domain.

1. Sign in to [Resend](https://resend.com).
2. Create a **send-only** API key and copy it (do not paste it into GitHub or screenshots).
3. Open **Domains → Add Domain** and enter a domain you control (for example `yourdomain.com`, not a made-up domain).
4. Add the DNS records Resend shows (typically SPF `TXT`, DKIM `TXT`, and an MX record for the return-path subdomain) at your DNS provider. Wait until Resend shows the domain as **Verified**.
5. Set in Render:

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=BookEase <no-reply@yourdomain.com>
ADMIN_NOTIFICATION_EMAIL=admin@yourdomain.com
APP_URL=https://bookease.vercel.app
FRONTEND_URL=https://bookease.vercel.app
SUPPORT_EMAIL=support@yourdomain.com
```

6. Redeploy the backend.
7. Create a test booking and confirm:
   - The customer receives a confirmation email.
   - The admin inbox receives a new-booking alert.
   - Approve, reject, cancel, and complete the appointment to exercise the other templates.
8. Check Render logs for `[email]` or `[email-outbox]` warnings. Successful sends are recorded in the `EmailOutbox` table with `status = sent` and a Resend message ID.

Important production rules:

- `RESEND_FROM_EMAIL` must be set explicitly. In production the app never falls back to `onboarding@resend.dev`.
- `APP_URL`/`FRONTEND_URL` must be the real deployed frontend. In production the app never falls back to `localhost` in email links.
- Temporary failures (network errors, HTTP 429, and 5xx responses) stay `pending` and are retried in the background with exponential backoff (default 5 attempts, 1 minute doubling to a 1 hour cap). Non-retryable errors (unverified sender, invalid API key, invalid recipient) are marked `failed` immediately.
- Each appointment event has a unique idempotency key, so retries and duplicate requests do not create duplicate emails or appointments.

Test mode note: `onboarding@resend.dev` only delivers to the Resend account owner's address. A Resend API "accepted" response is not proof of inbox delivery; verify the inbox manually after domain verification.

---

## 7. Configure UploadThing (production images)

1. Sign in to [UploadThing](https://uploadthing.com/dashboard).
2. Create/select an app.
3. Open **API Keys → V7** and copy the complete token (it is a base64-encoded JSON
   object with `apiKey`, `appId`, and `regions`). Do **not** use a v6 secret.
4. In Render → Backend Web Service → Environment, set:

```text
UPLOADTHING_TOKEN=<the complete V7 token>
```

   Set it only on Render. Never add it to Vercel/frontend variables or commit it.
5. Redeploy the backend (Render does not pick up local `.env` changes automatically).
6. Log in as a provider → **My Services** → **Edit Service** → **Service image** → upload an image.
7. Confirm the image appears in the service list and survives a refresh.
8. Repeat for admin services/providers if those flows are used.

Diagnostics from the Render Shell:

```bash
npm run uploadthing:check
```

This prints the token source, token shape, app id, region, and whether uploads are
enabled, but never prints the token itself. `token shape: valid` and
`uploads enabled: yes` confirm the deployed backend reads a usable V7 token.

---

## 8. Production verification

### 8.1 Automated API smoke test

From your local machine:

```powershell
cd backend
$env:SMOKE_API_BASE="https://<your-service>.onrender.com/api"
$env:SMOKE_ADMIN_EMAIL="admin@bookease.com"
$env:SMOKE_ADMIN_PASSWORD="<the production admin password>"
$env:SMOKE_EMAIL_DOMAIN="<a domain you control>"
npm run smoke
```

On macOS/Linux:

```bash
cd backend
SMOKE_API_BASE="https://<your-service>.onrender.com/api" \
SMOKE_ADMIN_EMAIL="admin@bookease.com" \
SMOKE_ADMIN_PASSWORD="<the production admin password>" \
SMOKE_EMAIL_DOMAIN="<a domain you control>" \
npm run smoke
```

`SMOKE_EMAIL_DOMAIN` is optional. The default `example.com` keeps local runs from sending real email. Set it to a real domain when you want to verify Resend delivery.

Expected: every check passes, including health, catalog, availability, registration, login, booking, double-booking prevention (`409`), cancellation, and admin status transitions.

### 8.2 Manual production checklist

Complete every item in [`TESTING.md`](./TESTING.md). At minimum:

- Register a new customer.
- Log in as the customer and as the administrator.
- Create a booking and verify the slot becomes unavailable.
- Try to book the same slot again — it must be rejected.
- Confirm emails arrive.
- Change appointment status as admin.
- Upload service and provider images.
- Refresh and confirm data/images persist.
- Test all navigation links and protected routes.
- Check browser console and Render logs for errors.
- Test desktop, tablet, and mobile widths.

Do not report the deployment as successful until these pass.

---

## 9. Security checklist

- [ ] `backend/.env` is not in GitHub.
- [ ] No secrets appear in `render.yaml`, `vercel.json`, README, screenshots, or commits.
- [ ] `JWT_SECRET` is long, random, and unique to production.
- [ ] The default `Admin@123` password has been changed.
- [ ] Neon/Supabase credentials are stored only in Render.
- [ ] Resend and UploadThing keys are stored only in Render.
- [ ] `FRONTEND_URL` and `CORS_ORIGINS` contain only your real frontend origins.
- [ ] A Vercel preview URL (`<project>-<id>-<team>.vercel.app`) can load `/api/services`.
- [ ] `TRUST_PROXY=1` is set on Render so rate limiting sees real client IPs.
- [ ] Login/registration rate limiting returns `429` after repeated failures.
- [ ] Security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, HSTS) are present on API responses.
- [ ] `RESEND_FROM_EMAIL` uses a verified domain (not `onboarding@resend.dev`).
- [ ] `APP_URL`/`FRONTEND_URL` point at the deployed frontend, not localhost.
- [ ] Database migrations were applied with `prisma migrate deploy`.
- [ ] `/api/health` returns `200` with `"database": "ok"`.
- [ ] Protected routes return `401`/`403` without the correct token/role.
- [ ] Any secret exposed during setup has been rotated.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Frontend shows "Cannot reach the server" | Wrong `VITE_API_BASE` or backend asleep | Check the URL includes `/api`; open it in a browser; wait for Render cold start. |
| Browser CORS error | `FRONTEND_URL` does not match the Vercel origin, or the preview belongs to a different project/team | Set the exact `https://...vercel.app` origin in Render, or set `VERCEL_PREVIEW_PROJECT`/`VERCEL_PREVIEW_TEAM` to the project's slugs, then redeploy the backend. |
| `/api/health` returns `503` | Database unreachable or migrations missing | Check `DATABASE_URL`, Neon status, and run `npm run db:deploy`. |
| `PrismaClientInitializationError` | Bad connection string or generated client missing | Verify the URL and run `npm run db:generate`; check Render build logs. |
| Render build fails at `prisma migrate deploy` | Database not reachable from the build environment or wrong URL | Use the Neon direct connection; confirm the database allows external connections. |
| `P2021` / table does not exist | Migrations not applied | Run `npm run db:deploy` and restart the service. |
| Email rows stay `pending` | Resend/network temporarily unavailable | The worker retries with backoff; inspect `EmailOutbox.lastError` and Render logs. |
| Email rows are `failed` | Unverified sender, invalid API key/recipient, or retries exhausted | Fix Resend configuration, then enqueue a new event; failed rows are not resent automatically. |
| Replaced image still loads | UploadThing CDN cache; the provider confirmed the delete | URL invalidation is not immediate. Keep the new URL in the database and treat the old file as revoked at the API level. |
| Emails not arriving | Missing/invalid Resend key, unverified sender, test-mode recipient | Check Render logs, verify the domain, use an allowed recipient. |
| Image upload returns `503` | Missing/invalid `UPLOADTHING_TOKEN` (or SDK not installed) | Set the complete V7 token in Render, redeploy, and run `npm run uploadthing:check` in Render Shell. |
| Image upload returns `502` | UploadThing rejected the upload itself | Check file type/size (JPG/PNG/WEBP, max 4 MB) and UploadThing dashboard logs. A bad token is now a `503`, never a `502`. |
| Refreshing a React route returns 404 | SPA rewrite missing | Confirm `frontend/vercel.json` is deployed with the frontend. |
| Vercel build fails | Wrong root directory or Node version | Set root directory `frontend`; use Node 20/22. |
| Admin login works locally but not in production | Production database was not seeded | Run `npm run db:seed` against production, then change the password. |
| Appointment slots look wrong | Provider working hours/timezone differ | Check the provider schedule and the Render service timezone. |

---

## 11. Redeploying after changes

```bash
git add .
git commit -m "fix: describe the change"
git push
```

- **Render** redeploys automatically when the backend changes.
- **Vercel** redeploys automatically when the frontend changes.
- If you change environment variables, trigger a manual redeploy.
- If you add a Prisma migration, commit it and ensure the Render build runs `npm run db:deploy`.

---

## 12. Final deliverables

After completing the steps above, record:

| Deliverable | Your value |
| --- | --- |
| Public GitHub repository | `https://github.com/<your-username>/<your-repository>` |
| Live frontend URL | `https://<your-project>.vercel.app` |
| Live backend API URL | `https://<your-service>.onrender.com/api` |
| Health check URL | `https://<your-service>.onrender.com/api/health` |
| Admin login email | `<your admin email>` |
| Testing checklist | [`TESTING.md`](./TESTING.md) |
| Known limitations | [`README.md#known-limitations`](./README.md#known-limitations) |
