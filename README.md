# BookEase — Appointment & Service Booking System

A full-stack appointment booking platform built for the Eterosoft Technologies Final Capstone Project. Customers can browse services and providers, check real availability, book appointments, receive email confirmations, manage their bookings, and cancel eligible appointments. Administrators manage categories, services, providers, working hours, appointments, customers, and service/provider images from a protected dashboard.

The application is a real client–server system: the React frontend talks to an Express REST API, data is stored in PostgreSQL through Prisma, booking emails are sent with Resend, and images are stored with UploadThing.

> **Deployment status:** the repository contains production configuration and deployment instructions. Replace the placeholder URLs below after deploying to Vercel, Render, and Neon/Supabase. Do not treat the application as deployed until the live URLs have been tested with `backend/scripts/smoke-test.js` and the checklist in [`TESTING.md`](./TESTING.md).

## Table of contents

- [Project overview](#project-overview)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database and seed data](#database-and-seed-data)
- [API documentation](#api-documentation)
- [Email notifications](#email-notifications)
- [Image uploads](#image-uploads-uploadthing)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)

## Project overview

BookEase solves the scheduling problem for service businesses: customers need to see only genuinely available times, and administrators need a single place to manage services, staff, availability, and appointment status. The backend enforces the scheduling rules, so availability cannot be bypassed by calling the API directly.

Key rules implemented by the backend:

- Time slots are generated from the selected service duration and the provider's working hours.
- Breaks, days off, date exceptions, past dates, and past times are excluded.
- Pending and confirmed appointments reserve a slot; cancelled, rejected, and completed appointments do not.
- Overlapping appointments are prevented inside a PostgreSQL transaction with an advisory lock, so two simultaneous requests cannot double-book the same provider and time.
- Customers can cancel only pending or confirmed appointments and only when the appointment is more than 24 hours away.
- Admin status changes follow an explicit transition map, and terminal statuses cannot be changed again.

## Features

### Customer features

- Register and log in with email and password (JWT authentication).
- Browse services by category and search/filter the catalog.
- View service details, assigned providers, prices, durations, and benefits.
- View provider profiles and schedules.
- Select a service, provider, date, and a real available time slot.
- Book as a logged-in customer or as a guest (guest bookings are stored with contact details).
- Receive a booking confirmation email and an admin new-booking alert.
- View booking history and booking details.
- Cancel eligible bookings according to the 24-hour rule.
- Responsive layout for desktop, tablet, and mobile.

### Administrator features

- Dedicated admin login at `/admin/login` and protected admin routes.
- Dashboard statistics for appointments, customers, specialists, provider accounts, and approval queues.
- Create, edit, and delete categories.
- Create, edit, activate/deactivate, and delete services.
- Create, edit, and delete providers (specialists).
- Assign providers to services.
- Configure weekly working hours and a daily break.
- Add date exceptions (holidays/unavailable dates).
- View and manage all appointments.
- Approve, reject, confirm, complete, and cancel appointments.
- Approve or reject provider registrations and provider-created services.
- View customer records and a customer's appointment history.
- Upload/replace/remove service images and provider photos with UploadThing.

### Backend features

- Express REST API with consistent JSON responses.
- PostgreSQL persistence through Prisma 7.
- JWT authentication and role-based authorization (`CUSTOMER` / `ADMIN`).
- Dynamic availability calculation and overlap prevention.
- Central error handler with safe database/configuration messages.
- Health-check endpoint that reports API and database status.
- Resend email notifications (best-effort, never roll back a saved booking).
- UploadThing backend-only image uploads with MIME/size/magic-byte validation.
- Automated backend tests with Node's built-in test runner.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4, Lucide icons |
| Backend | Node.js, Express 4, Prisma 7, JWT (`jsonwebtoken`), bcryptjs, Zod |
| Database | PostgreSQL 14+ (Neon or Supabase in production) |
| Email | Resend |
| Image storage | UploadThing |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Testing | Node.js test runner, `oxlint`, Vite production build, API smoke test |

## Project structure

```text
appointment-booking-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── migrations/            # Prisma migration history
│   ├── scripts/
│   │   ├── send-test-email.js     # Resend diagnostic
│   │   ├── smoke-test.js          # End-to-end API smoke test
│   │   └── uploadthing-check.js   # UploadThing diagnostic
│   ├── src/
│   │   ├── controllers/           # Auth, catalog, appointments, customers, dashboard, working hours
│   │   ├── lib/prisma.js          # Prisma client + PostgreSQL adapter
│   │   ├── middleware/auth.js     # requireAuth, requireAdmin, optionalAuth
│   │   ├── routes/                # Express route definitions
│   │   ├── services/              # Resend email and UploadThing services
│   │   ├── utils/                 # Scheduling, status rules, response serializers
│   │   ├── app.js                 # Express app, CORS, routes, error handler
│   │   ├── seed.js                # Idempotent seed script
│   │   └── server.js              # HTTP server entry point
│   ├── tests/                     # Automated backend tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/client.js          # API client (JWT, errors, upload progress)
│   │   ├── components/            # Reusable UI components
│   │   ├── layouts/               # Public and dashboard layouts
│   │   ├── pages/                 # Customer and admin pages
│   │   ├── App.jsx                # React Router route map
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   ├── vercel.json                # SPA rewrites and asset caching
│   └── vite.config.js             # Dev proxy to the backend
├── render.yaml                    # Render Blueprint for the backend
├── DEPLOYMENT.md                  # Beginner-friendly deployment guide
├── TESTING.md                     # Final testing checklist
└── README.md
```

## Installation

### Prerequisites

- Node.js 20.19 or newer (Node 22 LTS recommended; the repository includes `.nvmrc`)
- npm 10 or newer
- PostgreSQL 14 or newer (local, Neon, or Supabase)
- A Resend account for email notifications
- An UploadThing account for image uploads

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/<your-repository>.git
cd appointment-booking-system
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env` from the example:

```bash
# macOS/Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Fill in `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and — before seeding — the one-time admin bootstrap values `ADMIN_EMAIL` and `ADMIN_PASSWORD` (plus optional `ADMIN_NAME`). Then prepare the database:

```bash
npm run db:generate
npm run db:migrate     # development: creates/applies migrations
npm run db:seed
npm run dev
```

`db:seed` creates the admin only if that email does not already exist. It never resets an existing password and never prints the password. Production seeding fails clearly when `ADMIN_EMAIL`/`ADMIN_PASSWORD` are missing.

The API runs at `http://localhost:5000`. Confirm it is healthy:

```bash
curl http://localhost:5000/api/health
```

Expected response: HTTP `200` with `"database": "ok"`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. During development, Vite proxies `/api` to `http://localhost:5000`, so `VITE_API_BASE` can remain unset. Set `FRONTEND_URL=http://localhost:5173` in `backend/.env`.

### 4. Production build check

```bash
cd frontend
npm run build
npm run lint

cd ../backend
npm test
```

## Environment variables

Never commit real credentials. All backend secrets belong in `backend/.env` locally and in the Render dashboard in production. The frontend only receives variables prefixed with `VITE_`, and those values are public by design — never put secrets in them.

### Backend (`backend/.env`)

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `PORT` | No | API port | `5000` |
| `HOST` | No | Bind address | `0.0.0.0` |
| `NODE_ENV` | No | Runtime mode | `development` / `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` |
| `JWT_SECRET` | Yes | Signs authentication tokens; use a long random value | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | No | Token lifetime | `7d` |
| `ADMIN_EMAIL` | For seed | Email for the one-time, create-only administrator bootstrap | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | For seed | Unique password (min. 8 chars) used only when creating that admin | long random value |
| `ADMIN_NAME` | No | Display name for the bootstrapped admin | `Admin User` |
| `TRUST_PROXY` | No | Reverse-proxy hops trusted for client IPs; defaults to `1` in production and `false` locally | `1` |
| `FRONTEND_URL` | Yes | Primary allowed CORS origin and default app URL | `https://your-app.vercel.app` |
| `CORS_ORIGINS` | No | Extra comma-separated allowed origins | `https://www.yourdomain.com,https://your-app.vercel.app` |
| `ALLOW_VERCEL_PREVIEWS` | No | Allow this project's Vercel preview URLs (`<project>-<deployment-or-branch>-<team>.vercel.app`); defaults to `true` | `true` |
| `VERCEL_PREVIEW_PROJECT` | No | Vercel project name used for the preview host pattern | `bookease-appointment-booking-system` |
| `VERCEL_PREVIEW_TEAM` | No | Vercel team/scope slug used for the preview host pattern | `melisha` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | Login/registration rate-limit window (default 15 min) | `900000` |
| `AUTH_RATE_LIMIT_LOGIN_MAX` | No | Failed logins allowed per IP per window (default 10) | `10` |
| `AUTH_RATE_LIMIT_REGISTER_MAX` | No | Registrations allowed per IP per window (default 5) | `5` |
| `RESEND_API_KEY` | For email | Resend API key | `re_...` |
| `RESEND_FROM_EMAIL` | Production | Verified-domain sender. Required in production; the test sender is dev-only | `BookEase <no-reply@yourdomain.com>` |
| `ADMIN_NOTIFICATION_EMAIL` | For admin alerts | Admin inbox(es), comma-separated | `admin@yourdomain.com` |
| `EMAIL_REPLY_TO` | No | Reply-to address | `support@yourdomain.com` |
| `SUPPORT_EMAIL` | No | Support address in email footers | `support@yourdomain.com` |
| `APP_NAME` | No | Brand name in emails | `BookEase` |
| `APP_URL` | Production | Base URL for email buttons; falls back to `FRONTEND_URL`. No localhost fallback in production | `https://your-app.vercel.app` |
| `EMAIL_OUTBOX_MAX_ATTEMPTS` | No | Delivery attempts before an email is marked failed (default 5) | `5` |
| `EMAIL_OUTBOX_BASE_DELAY_MS` | No | First retry delay in ms (default 60000) | `60000` |
| `EMAIL_OUTBOX_MAX_DELAY_MS` | No | Maximum retry delay in ms (default 1 hour) | `3600000` |
| `EMAIL_OUTBOX_STUCK_AFTER_MS` | No | Re-queue `sending` rows older than this (default 5 min) | `300000` |
| `UPLOADTHING_TOKEN` | For images | Complete UploadThing v7 token; backend-only | `...` |
| `UPLOADTHING_SECRET` | No | Legacy v6 variable; ignored by the v7 SDK | — |
| `UPLOADTHING_APP_ID` | No | Legacy v6 variable; ignored by the v7 SDK | — |
| `UPLOADTHING_REGION` | No | Legacy v6 variable; ignored by the v7 SDK | — |

Generate a safe JWT secret:

```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
```

### Frontend (Vercel environment variables)

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `VITE_API_BASE` | Recommended in production | Full backend API base URL, including `/api` | `https://bookease-appointment-booking-system.onrender.com/api` |

Local development can omit `VITE_API_BASE` and use the Vite proxy. If you set it locally, use `http://localhost:5000/api`. On a `*.vercel.app` host, the app falls back to this project's Render API when the variable is unset because Vercel's SPA rewrite would otherwise return `index.html` for `/api/*`. Set the variable explicitly for custom domains or a different backend.

## Database and seed data

The Prisma schema contains:

- `User` — customers and administrators.
- `Category` — service categories.
- `Service` — bookable services with price, duration, benefits, and image URL.
- `Specialist` — providers with profile details and image URL.
- `SpecialistService` — provider-to-service assignments.
- `WorkingHour` — weekly working days, start/end times, and a break.
- `SpecialistDateException` — holidays and date-specific unavailability.
- `Appointment` — customer, service, provider, date, time, status, and notes.

Apply migrations in production with:

```bash
cd backend
npm run db:deploy
```

`npm run db:deploy` runs `prisma migrate deploy`, which applies committed migrations without resetting data.

The idempotent seed script creates six categories, 24 services, 12 specialists, working hours, and service assignments. It does **not** create `Provider` accounts. Public provider profiles are created only by real provider registration and become visible only after administrator approval.

```bash
cd backend
# Set ADMIN_EMAIL and ADMIN_PASSWORD first (see backend/.env.example).
npm run db:seed
```

The administrator is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD`:

- The account is created only if that email does not already exist.
- Existing admins, passwords, roles, users, and appointments are never changed.
- The password is never printed to logs.
- In production, seeding fails clearly if the bootstrap variables are missing.

After seeding, sign in at **`/admin/login`**. To publish a provider: register at `/provider/register`, then approve the provider and its services from **`/admin/approvals`**. Approved, active providers then appear at `/providers`.

## API documentation

Base URL locally: `http://localhost:5000/api`  
Base URL in production: `https://<your-render-service>.onrender.com/api`

Authentication uses `Authorization: Bearer <token>`. Access levels:

- **Public** — no token required.
- **Auth** — any logged-in user.
- **Admin** — logged-in user with role `ADMIN`.

### Health

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API status and PostgreSQL connectivity. `200` when healthy, `503` when degraded. |

### Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create a customer account. |
| `POST` | `/auth/login` | Public | Log in and receive a JWT. |
| `POST` | `/auth/logout` | Public | Stateless logout acknowledgement. |
| `GET` | `/auth/me` | Auth | Current user profile. |
| `PUT` | `/auth/profile` | Auth | Update name, phone, or address. |

Register request:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "9800000000",
  "password": "StrongPassword123"
}
```

Login request:

```json
{
  "email": "jane@example.com",
  "password": "StrongPassword123"
}
```

Both return `{ success, message, token, user }`.

### Provider accounts and approvals

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register-provider` | Public | Create a `PROVIDER` user and a pending `Provider` profile. |
| `GET` | `/providers` | Public | List approved, active provider accounts. |
| `GET` | `/providers/:id` | Public | Approved, active provider details. |
| `GET` | `/providers/me` | Provider | Current provider profile. |
| `GET` | `/admin/providers?status=pending` | Admin | List provider accounts awaiting review. |
| `PATCH` | `/admin/providers/:id` | Admin | Approve/reject a provider, e.g. `{ "status": "approved", "isActive": true }`. |
| `GET` | `/admin/services?approvalStatus=pending` | Admin | List provider-created services awaiting review. |
| `PATCH` | `/admin/services/:id/approval` | Admin | Approve/reject a service, e.g. `{ "status": "approved" }`. |

The seed's 12 specialists are catalog records, not public provider accounts. A provider profile and each of its services must be approved before they appear in the public directory.

### Categories

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/categories` | Public | List categories (includes the synthetic `all` filter). |
| `POST` | `/categories` | Admin | Create a category. |
| `PATCH` / `PUT` | `/categories/:id` | Admin | Update a category by slug or ID. |
| `DELETE` | `/categories/:id` | Admin | Delete a category. |

### Services

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/services?category=<slug>` | Public | List active services, optionally filtered by category. |
| `GET` | `/services/:id` | Public | Service details plus assigned providers. |
| `POST` | `/services` | Admin | Create a service. |
| `PATCH` / `PUT` | `/services/:id` | Admin | Update a service. |
| `DELETE` | `/services/:id` | Admin | Delete a service. |
| `POST` | `/services/:id/image` | Admin | Upload/replace an image (`multipart/form-data`, field `image`). |
| `DELETE` | `/services/:id/image` | Admin | Remove the stored image URL. |

### Providers (specialists)

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/specialists?serviceId=<slug>` | Public | List active providers, optionally filtered by service. |
| `GET` | `/specialists/schedules` | Public | Provider schedule map. |
| `GET` | `/specialists/:id` | Public | Provider profile, services, and schedule. |
| `POST` | `/specialists` | Admin | Create a provider. |
| `PATCH` / `PUT` | `/specialists/:id` | Admin | Update a provider. |
| `DELETE` | `/specialists/:id` | Admin | Delete a provider. |
| `POST` | `/specialists/:id/image` | Admin | Upload/replace a provider photo. |
| `DELETE` | `/specialists/:id/image` | Admin | Remove the stored photo URL. |

### Working hours and date exceptions

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/specialists/working-hours` | Admin | List all provider schedules. |
| `GET` | `/specialists/:id/working-hours` | Admin | Get one provider's schedule. |
| `POST` / `PUT` / `PATCH` | `/specialists/:id/working-hours` | Admin | Create or update working hours and break. |
| `DELETE` | `/specialists/:id/working-hours` | Admin | Remove a schedule. |
| `POST` | `/specialists/:id/date-exceptions` | Admin | Add a holiday/unavailable date. |
| `PATCH` / `PUT` | `/specialists/:id/date-exceptions/:exceptionId` | Admin | Update a date exception. |
| `DELETE` | `/specialists/:id/date-exceptions/:exceptionId` | Admin | Delete a date exception. |

Example working-hours body:

```json
{
  "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "startTime": "09:00 AM",
  "endTime": "05:00 PM",
  "breakStart": "01:00 PM",
  "breakEnd": "02:00 PM"
}
```

### Appointments

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/appointments/availability?specialistId=<slug>&serviceId=<slug>&date=YYYY-MM-DD` | Public | Duration-based available slots for a provider/date. |
| `POST` | `/appointments` | Public / optional auth | Create a booking. A valid token links it to the customer account. |
| `GET` | `/appointments/mine` | Auth | Current customer's booking history. |
| `PATCH` | `/appointments/:reference/cancel` | Auth | Cancel an eligible booking (24-hour rule). |
| `GET` | `/appointments` | Admin | List all appointments. |
| `PATCH` | `/appointments/:reference/status` | Admin | Change appointment status. |

Availability response (shortened):

```json
{
  "success": true,
  "specialistId": "anisha-sharma",
  "date": "2026-11-20",
  "closed": false,
  "serviceId": "general-health-consultation",
  "durationMins": 30,
  "slots": [
    { "slot": "09:00 AM", "available": true, "taken": false, "inBreak": false, "pastToday": false },
    { "slot": "09:30 AM", "available": false, "taken": true, "inBreak": false, "pastToday": false }
  ]
}
```

Create booking request:

```json
{
  "serviceId": "general-health-consultation",
  "specialistId": "anisha-sharma",
  "date": "2026-11-20",
  "time": "09:00 AM",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "9800000000",
  "notes": "First visit"
}
```

A successful booking returns HTTP `201` with an appointment reference such as `APT-AB12CD`. An overlapping booking returns HTTP `409`.

Admin status request:

```json
{ "status": "confirmed" }
```

Allowed transitions:

```text
pending   -> confirmed | rejected | cancelled
confirmed -> completed | cancelled
completed -> (terminal)
cancelled -> (terminal)
rejected  -> (terminal)
```

### Customers and dashboard (admin only)

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/customers` | Admin | List customer records. |
| `GET` | `/customers/:id` | Admin | Customer details. |
| `GET` | `/customers/:id/appointments` | Admin | A customer's appointments. |
| `GET` | `/dashboard/stats` | Admin | Dashboard statistics. |

### Common error responses

```json
{ "success": false, "message": "Authentication required." }
```

- `400` — validation error, invalid status transition, cancellation rule violation.
- `401` — missing/expired token.
- `403` — authenticated but not an administrator.
- `404` — resource not found.
- `409` — duplicate record or overlapping appointment.
- `500` — unexpected server error.
- `503` — database or external service unavailable/not configured.

## Email notifications

Resend sends:

- Booking confirmation to the customer.
- New-booking alert to `ADMIN_NOTIFICATION_EMAIL`.
- Appointment confirmed, rejected, cancelled, and completed updates.

Rules:

- Emails are queued only after the database write succeeds.
- Delivery uses a database-backed outbox (`EmailOutbox`): the first attempt is immediate, and temporary Resend failures are retried with exponential backoff (default 5 attempts, capped at 1 hour apart).
- A unique idempotency key per appointment event prevents duplicate emails and duplicate appointment records.
- Email failures are logged and never roll back a booking or status change.
- A status email is not sent when the status did not change.
- Missing configuration or invalid recipients are handled safely.
- API keys are read only from backend environment variables and are never returned by the API.

Configure Resend:

1. Create an account at [resend.com](https://resend.com).
2. Create an API key and set `RESEND_API_KEY`.
3. Verify a sending domain, then use an address on that domain in `RESEND_FROM_EMAIL`.
   - The shared test sender `onboarding@resend.dev` only delivers to the Resend account owner's email address. It is used automatically in development when `RESEND_FROM_EMAIL` is unset, but never in production.
4. Set `ADMIN_NOTIFICATION_EMAIL` to the admin inbox (comma-separated for multiple recipients).
5. Set `APP_URL` (or `FRONTEND_URL`) to the deployed frontend so email links do not point at localhost.
6. Restart the backend after changing environment variables.

Diagnostic command:

```bash
cd backend
npm run email:test -- recipient@example.com
npm run email:test -- recipient@example.com --all
```

The script prints Resend message IDs and never prints the API key.

## Image uploads (UploadThing)

Admin service images and provider photos are uploaded by the backend to UploadThing. Only the returned HTTPS URL is stored in PostgreSQL (`Service.imageUrl` and `Specialist.imageUrl`). There is no Base64 or local-disk fallback.

Configure exactly one credential in `backend/.env` (and in Render for production):

```dotenv
UPLOADTHING_TOKEN=the_complete_v7_token
```

- Use **UploadThing Dashboard → API Keys → V7**. A v6 `UPLOADTHING_SECRET` /
  `UPLOADTHING_APP_ID` pair is not accepted by the installed SDK.
- Paste the complete one-line token without quotes or a prefix. The backend also
  safely tolerates wrapping quotes, line breaks, and URL-safe Base64 characters,
  but the token itself must be genuine and complete.
- Credentials are backend-only and never sent to the browser.
- Accepted formats: JPG, JPEG, PNG, WEBP.
- Maximum size: 4 MB.
- The backend checks MIME type, size, and image magic bytes.
- Missing/invalid configuration returns a safe `503` with a secret-free
  diagnostic; provider failures return a safe `502`.

Diagnostics:

```bash
cd backend
npm run uploadthing:check
npm run uploadthing:check -- --file ./path/to/image.jpg
```

Manual verification:

1. Sign in as admin and open **Admin → Services**.
2. Select an image, confirm the preview, and save/upload.
3. Confirm the image appears in the public catalog and service details.
4. Refresh and confirm the image persists.
5. Repeat for **Admin → Providers**.
6. Try a PDF or a file larger than 4 MB and confirm validation.
7. Temporarily clear the credentials and confirm a safe configuration error (restore afterwards).

## Testing

### Automated backend tests

```bash
cd backend
npm test
```

The suite uses Node's built-in test runner and mocks external services. It covers email templates and failure handling, UploadThing validation and persistence, scheduling rules, appointment status transitions, authentication, working hours, customers, and dashboard authorization.

### Frontend checks

```bash
cd frontend
npm run build
npm run lint
```

### API smoke test (local or deployed)

With the backend running:

```bash
cd backend
npm run smoke
```

Against a deployed backend:

```powershell
$env:SMOKE_API_BASE="https://your-api.onrender.com/api"
$env:SMOKE_ADMIN_EMAIL="admin@example.com"
$env:SMOKE_ADMIN_PASSWORD="your-admin-password"
$env:SMOKE_EMAIL_DOMAIN="yourdomain.com"
npm run smoke
```

On macOS/Linux:

```bash
SMOKE_API_BASE="https://your-api.onrender.com/api" \
SMOKE_ADMIN_EMAIL="admin@example.com" \
SMOKE_ADMIN_PASSWORD="your-admin-password" \
SMOKE_EMAIL_DOMAIN="yourdomain.com" \
npm run smoke
```

`SMOKE_EMAIL_DOMAIN` is optional. The default is `example.com`, which is intentionally non-deliverable and keeps local runs from sending real email. Set it to a domain you control to verify Resend delivery in production. Booking creation still succeeds either way because email is best-effort.

The smoke test checks health/database connectivity, catalog, availability, registration, login, protected routes, booking creation, double-booking prevention (`409`), booking history, cancellation, slot release, and — when admin credentials are provided — admin login, customer/dashboard access, status transitions, and terminal-status protection. It never prints tokens or passwords.

For the full manual customer, admin, deployment, and production checklist, see [`TESTING.md`](./TESTING.md).

## Deployment

Production architecture:

```text
Browser
  └── Vercel (React + Vite static build)
        └── Render (Express API)
              ├── Neon or Supabase PostgreSQL
              ├── Resend (email)
              └── UploadThing (images)
```

Included configuration:

- `frontend/vercel.json` — Vite build settings, SPA rewrite to `index.html`, asset caching.
- `render.yaml` — Render Blueprint for the backend, health check, build/start commands, and environment variable placeholders.
- `backend/.env.example` and `frontend/.env.example` — documented variables.

Beginner-friendly step-by-step instructions are in [`DEPLOYMENT.md`](./DEPLOYMENT.md). The short version:

1. Create a Neon or Supabase PostgreSQL database and copy its connection string.
2. Push the repository to a public GitHub repository.
3. Create a Render web service from `render.yaml` or manually from the `backend/` folder.
4. Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, Resend, and UploadThing variables in Render. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before seeding only; they create the first admin and are never printed.
5. Run `npm run db:deploy` and `npm run db:seed` against the production database.
6. Import the repository into Vercel with root directory `frontend`.
7. Set `VITE_API_BASE=https://bookease-appointment-booking-system.onrender.com/api` in Vercel and redeploy.
8. Update `FRONTEND_URL` in Render with the Vercel production URL and redeploy the backend. This project's Vercel preview and git-main URLs are allowed automatically by the strict project/team hostname rule.
9. Verify `https://<your-render-service>.onrender.com/api/health`.
10. Run `npm run smoke` against the live API and complete [`TESTING.md`](./TESTING.md).

### Production URLs

Fill these in after deployment:

| Deliverable | URL |
| --- | --- |
| Public GitHub repository | `https://github.com/<your-username>/<your-repository>` |
| Live frontend | `https://<your-project>.vercel.app` |
| Live backend API | `https://<your-service>.onrender.com/api` |
| Health check | `https://<your-service>.onrender.com/api/health` |

## Known limitations

- **No live deployment is included in this repository.** Cloud deployment requires your GitHub, Vercel, Render, Neon/Supabase, Resend, and UploadThing accounts.
- **Render free tier cold starts.** The backend may take 30–60 seconds to respond after inactivity.
- **Resend test mode.** `onboarding@resend.dev` only delivers to the Resend account owner until a domain is verified.
- **UploadThing credentials are required.** Image upload endpoints return a safe `503` until valid credentials are configured.
- **UploadThing CDN caching after deletion.** Replacing or removing an image calls `UTApi.deleteFiles`, and the UploadThing API confirms deletion. The public `*.ufs.sh` URL may still return the cached file, so immediate CDN invalidation is not guaranteed.
- **Single daily break.** Each provider has one weekly schedule and one break interval per day; multiple shifts are not modeled.
- **Server-local timezone.** Date/time comparisons use the backend server's local timezone. Ensure the Render service timezone matches your business timezone if it differs from UTC.
- **JWT sessions are stateless.** There is no refresh-token rotation or server-side session revocation; logout clears the token on the client.
- **Email delivery is retried, not guaranteed.** A Resend outage does not roll back bookings; failed messages are retried from the outbox and marked `failed` with an error after the retry limit. Delivery cannot be guaranteed by the API response.
- **No payment integration.** Prices are displayed but payments are handled outside the application.
- **Rate limiting, no CAPTCHA.** Login and registration are rate limited per IP. There is no CAPTCHA or account lockout, and broader abuse protection for public booking endpoints is still a deployment concern.
- **Admin password rotation is manual.** The seed is create-only and never resets a password. Rotate a compromised admin password through a trusted database/admin process.
- **Browser E2E is manual.** Backend tests and the API smoke test are automated; the responsive UI and route checklist in `TESTING.md` must be completed manually.
