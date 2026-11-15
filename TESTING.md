# BookEase Final Testing Checklist

Use this checklist for the capstone submission and technical viva. Test locally first, then repeat the production sections against the live Vercel and Render URLs.

Record the date, tester, environment, and result for each section.

| Field | Value |
| --- | --- |
| Tester | |
| Date | |
| Local frontend | `http://localhost:5173` |
| Local backend | `http://localhost:5000/api` |
| Live frontend | `https://<your-project>.vercel.app` |
| Live backend | `https://<your-service>.onrender.com/api` |
| Database | Neon / Supabase / local PostgreSQL |

---

## 1. Pre-test setup

- [ ] `backend/.env` exists and contains a valid `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`.
- [ ] `npm run db:generate` completed.
- [ ] `npm run db:migrate` (local) or `npm run db:deploy` (production) completed.
- [ ] `npm run db:seed` completed.
- [ ] Backend is running.
- [ ] Frontend is running or deployed.
- [ ] `GET /api/health` returns `200` with `"database": "ok"`.
- [ ] Admin account is available (`admin@bookease.com` / `Admin@123` locally; changed for production).
- [ ] A second customer email inbox is available for registration and email testing.
- [ ] Browser DevTools Console and Network tabs are open.

---

## 2. Automated verification

Run these before manual testing.

### 2.1 Backend tests

```bash
cd backend
npm test
```

- [ ] All tests pass. Expected: `95/95` (or the current total) passing, `0` failing.
- [ ] No test calls the real Resend API or production database.

### 2.2 Frontend build and lint

```bash
cd frontend
npm run build
npm run lint
```

- [ ] Production build succeeds and writes `dist/`.
- [ ] Lint reports no new errors. Existing warnings are acceptable if documented.
- [ ] No secrets or `.env` values are embedded in the build output.

### 2.3 API smoke test (local)

```bash
cd backend
npm run smoke
```

- [ ] Health check passes.
- [ ] Catalog returns categories, services, and providers.
- [ ] Availability returns a bookable slot.
- [ ] Customer registration and login pass.
- [ ] Anonymous protected requests return `401`.
- [ ] Booking creation passes.
- [ ] Double-booking returns `409`.
- [ ] Booking history contains the new reference.
- [ ] Customer token gets `403` on admin routes.
- [ ] Customer cancellation passes.
- [ ] Cancelled slot becomes available again.
- [ ] Admin checks pass when `SMOKE_ADMIN_EMAIL` and `SMOKE_ADMIN_PASSWORD` are set.

### 2.4 API smoke test (production)

```powershell
$env:SMOKE_API_BASE="https://<your-service>.onrender.com/api"
$env:SMOKE_ADMIN_EMAIL="<production admin email>"
$env:SMOKE_ADMIN_PASSWORD="<production admin password>"
$env:SMOKE_EMAIL_DOMAIN="<a domain you control>"
cd backend
npm run smoke
```

- [ ] All checks pass against the live URLs.
- [ ] No secrets are printed.
- [ ] Render logs show no unhandled errors during the run.
- [ ] `SMOKE_EMAIL_DOMAIN` points to a real inbox domain, and the confirmation/status emails are confirmed there.

---

## 3. Customer workflow

### 3.1 Registration and login

- [ ] Open `/register`.
- [ ] Submit an empty form → validation messages appear.
- [ ] Register with a unique email and a password of at least 6 characters.
- [ ] Success message appears and the user is logged in.
- [ ] Refresh the page → the session persists.
- [ ] Log out → protected customer pages redirect to `/login`.
- [ ] Log in with the same credentials → success.
- [ ] Log in with a wrong password → safe error message, no crash.
- [ ] Register the same email again → `409`/friendly duplicate message.
- [ ] `GET /api/auth/me` with the token returns the customer profile.
- [ ] Password hashes are never returned by the API.

### 3.2 Browse, search, and filter

- [ ] Home page loads featured services/providers from the API.
- [ ] `/services` lists services.
- [ ] Category filter updates the list and the URL/state.
- [ ] Search filters by service name or keyword.
- [ ] Empty search shows an empty state, not a crash.
- [ ] Service details page shows description, price, duration, benefits, and assigned providers.
- [ ] `/specialists` lists providers.
- [ ] Provider details show bio, experience, services, and schedule.
- [ ] Inactive services/providers are not shown in the public catalog.

### 3.3 Date and time selection

- [ ] Open the booking flow from a service.
- [ ] Select a service and an assigned provider.
- [ ] Select a future date.
- [ ] Available slots load from `/api/appointments/availability`.
- [ ] Slots that are booked show as unavailable.
- [ ] Break times are excluded.
- [ ] Days the provider does not work show a closed/unavailable message.
- [ ] Past dates and past times cannot be selected.
- [ ] A date exception/holiday shows the provider as unavailable (if configured).
- [ ] Changing the service duration changes the slot spacing.

### 3.4 Booking

- [ ] Complete the booking form with valid customer details.
- [ ] Submit → success screen with a reference such as `APT-AB12CD`.
- [ ] The appointment appears in `/my-appointments` (or the customer booking history).
- [ ] Refresh → the appointment persists (PostgreSQL, not mock data).
- [ ] The booked slot is no longer available in a second browser/incognito window.
- [ ] Booking the same slot again returns a conflict message (`409`), not a duplicate.
- [ ] Guest booking works when logged out (contact details required).
- [ ] Logged-in booking is linked to the customer account.
- [ ] Invalid email, missing fields, and past dates are rejected safely.
- [ ] A provider not assigned to the service is rejected.

### 3.5 Confirmation email

- [ ] Customer receives a booking confirmation email.
- [ ] Email contains the correct reference, service, provider, date, time, and status.
- [ ] Admin inbox receives the new-booking alert.
- [ ] Render logs do not show email errors for successful sends.
- [ ] Temporarily using an invalid Resend key does not roll back the booking; the API still returns success and logs a safe warning (restore the key afterwards).

### 3.6 Booking history and cancellation

- [ ] Booking history lists all appointments for the logged-in customer only.
- [ ] Another customer cannot see the first customer's bookings.
- [ ] Cancel a pending or confirmed appointment more than 24 hours away → success.
- [ ] Status changes to `cancelled`.
- [ ] Cancellation email arrives.
- [ ] The cancelled slot becomes available again.
- [ ] Cancelling an already cancelled appointment → safe `400`.
- [ ] Cancelling a completed/rejected appointment → safe `400`.
- [ ] An appointment within 24 hours cannot be cancelled (test locally by adjusting a test appointment date if needed).
- [ ] Another customer cannot cancel someone else's appointment (`404`/`403`).

---

## 4. Administrator workflow

### 4.1 Authentication and protected routes

- [ ] Log in with the admin account.
- [ ] Admin dashboard loads.
- [ ] Customer account cannot open admin pages (redirect/forbidden).
- [ ] Logged-out user cannot open admin pages (redirect to login).
- [ ] `GET /api/appointments` with a customer token returns `403`.
- [ ] `GET /api/dashboard/stats` without a token returns `401`.
- [ ] Admin token works for all admin endpoints.

### 4.2 Services and categories

- [ ] Create a category.
- [ ] Rename a category.
- [ ] Delete an unused category.
- [ ] Attempt to delete a category in use → safe error, no orphaned data.
- [ ] Create a service with name, category, price, duration, description, benefits, and image.
- [ ] Edit the service.
- [ ] Deactivate/activate the service and confirm public visibility changes.
- [ ] Delete a service (or confirm the intended safe behavior).
- [ ] Validation rejects missing name, invalid price, and invalid duration.
- [ ] "All" cannot be used as a category name.

### 4.3 Providers

- [ ] Create a provider with name, title, bio, experience, specialty, and photo.
- [ ] Edit the provider.
- [ ] Assign/unassign services.
- [ ] Deactivate/activate the provider and confirm public visibility changes.
- [ ] Delete a provider (or confirm the intended safe behavior).
- [ ] Provider photo appears on cards and the profile page.

### 4.4 Working hours and breaks

- [ ] Open **Admin → Working Hours**.
- [ ] Set working days and start/end times.
- [ ] Set a break start/end.
- [ ] Save and reload → values persist.
- [ ] Availability excludes non-working days.
- [ ] Availability excludes the break.
- [ ] Add a holiday/date exception.
- [ ] Availability for that date shows closed/unavailable with a reason.
- [ ] Edit and delete the date exception.
- [ ] Invalid times (end before start, break outside hours) are rejected.

### 4.5 Appointments and status transitions

- [ ] Admin appointment list shows all appointments with customer, service, provider, date, time, and status.
- [ ] Filter/search by status, date, or customer (if available in the UI).
- [ ] Pending → confirmed works.
- [ ] Confirmed → completed works.
- [ ] Pending → rejected works.
- [ ] Pending → cancelled works.
- [ ] Confirmed → cancelled works.
- [ ] Completed → any status is rejected.
- [ ] Cancelled → any status is rejected.
- [ ] Rejected → any status is rejected.
- [ ] Setting the same status twice returns a safe `400`.
- [ ] Status emails arrive for confirmed, rejected, cancelled, and completed.
- [ ] The appointment status persists after refresh.
- [ ] Terminal appointments no longer block the time slot.

### 4.6 Customers

- [ ] Customer list loads.
- [ ] Customer search/filter works (if available).
- [ ] Customer details show contact information and appointment history.
- [ ] Customer records do not expose password hashes.
- [ ] Admin can view a customer's appointments.
- [ ] Empty customer list/detail shows a safe empty state.

### 4.7 UploadThing images

- [ ] Upload a JPG/PNG/WEBP service image (under 4 MB).
- [ ] Progress indicator appears and reaches 100%.
- [ ] Success message appears.
- [ ] Image URL is saved in PostgreSQL and appears on the public page.
- [ ] Refresh → image persists.
- [ ] Replace the image with a different file.
- [ ] Remove the image.
- [ ] Upload a provider photo and repeat the checks.
- [ ] Upload a PDF → validation error.
- [ ] Upload a file over 4 MB → validation error.
- [ ] Upload with UploadThing credentials removed → safe `503`, existing image unchanged (restore credentials).
- [ ] Unauthenticated upload request returns `401`.
- [ ] Customer token upload request returns `403`.
- [ ] No UploadThing secret appears in browser network responses.

---

## 5. Backend and database verification

### 5.1 REST API

- [ ] `GET /api/health` → `200`, `"database": "ok"`.
- [ ] `GET /api/categories` → `200`.
- [ ] `GET /api/services` → `200`.
- [ ] `GET /api/services?category=<slug>` → filtered list.
- [ ] `GET /api/services/:id` → service with providers.
- [ ] `GET /api/specialists` → `200`.
- [ ] `GET /api/specialists?serviceId=<slug>` → filtered list.
- [ ] `GET /api/specialists/:id` → provider with schedule.
- [ ] `GET /api/appointments/availability` → slots with `available` flags.
- [ ] Missing availability parameters → `400`.
- [ ] Invalid date format → `400`.
- [ ] `POST /api/appointments` → `201`.
- [ ] Overlapping appointment → `409`.
- [ ] `GET /api/appointments/mine` without token → `401`.
- [ ] `GET /api/appointments` as customer → `403`.
- [ ] `PATCH /api/appointments/:reference/status` with invalid status → `400`.
- [ ] Unknown resource → `404`.
- [ ] API error responses are JSON with `success: false` and a safe `message`.

### 5.2 PostgreSQL

- [ ] Tables exist and relationships are correct (`User`, `Category`, `Service`, `Specialist`, `SpecialistService`, `WorkingHour`, `SpecialistDateException`, `Appointment`).
- [ ] A new registration creates a `User` row.
- [ ] A new booking creates an `Appointment` row linked to the correct service, provider, and customer.
- [ ] Cancelling updates the row instead of deleting it.
- [ ] Status changes persist.
- [ ] Image URLs persist in `Service.imageUrl` / `Specialist.imageUrl`.
- [ ] No credentials or password hashes appear in API responses.
- [ ] Database credentials are not visible in the frontend bundle.

### 5.3 Scheduling and concurrency

- [ ] Slots are generated from working hours and service duration.
- [ ] Breaks are excluded.
- [ ] Past dates/times are excluded.
- [ ] Date exceptions are respected.
- [ ] Pending and confirmed appointments block a slot.
- [ ] Cancelled, rejected, and completed appointments do not block a slot.
- [ ] Two simultaneous booking requests for the same slot result in one `201` and one `409`.
- [ ] An appointment that overlaps the middle of another appointment is rejected, not just an exact start-time match.

### 5.4 Authentication and authorization

- [ ] Missing token → `401`.
- [ ] Invalid token → `401`.
- [ ] Expired token → `401`.
- [ ] Customer token on admin route → `403`.
- [ ] Admin token on customer route → allowed where intended.
- [ ] Protected image endpoints enforce `requireAuth` and `requireAdmin`.
- [ ] JWT secret is read only from the backend environment.

---

## 6. Frontend deployment checks (Vercel)

- [ ] Vercel build succeeds.
- [ ] `VITE_API_BASE` points to the live Render API and includes `/api`.
- [ ] Home page loads over HTTPS.
- [ ] Public routes work: `/`, `/services`, `/services/:id`, `/specialists`, `/specialists/:id`, `/booking`, `/login`, `/register`.
- [ ] Customer routes work after login: `/dashboard`, `/my-appointments`, `/my-appointments/:reference`, `/profile`.
- [ ] Admin routes work after admin login: `/admin`, `/admin/appointments`, `/admin/services`, `/admin/categories`, `/admin/providers`, `/admin/working-hours`, `/admin/customers`.
- [ ] Refreshing each route returns the app, not a 404 (SPA rewrite).
- [ ] Unknown route shows the app's not-found page, not a server error.
- [ ] Browser console has no CORS, mixed-content, or unhandled promise errors.
- [ ] Network tab shows API requests going to the Render URL.
- [ ] Images load from UploadThing/HTTPS sources.
- [ ] Logout and re-login work in production.
- [ ] Protected routes redirect correctly when logged out.
- [ ] Expired/invalid token clears the session and redirects to login.

### Responsive checks

Test at these widths using DevTools device mode:

- [ ] Mobile: 375 px — navigation, cards, forms, booking steps, and tables remain usable.
- [ ] Tablet: 768 px — layout adapts without horizontal scrolling.
- [ ] Desktop: 1280 px+ — full layout renders correctly.
- [ ] No overlapping text, cut-off buttons, or unusable modals.
- [ ] Touch targets are large enough on mobile.
- [ ] Dashboard tables/cards scroll or stack correctly.

---

## 7. Production / live URL checks (Render + Neon/Supabase)

Repeat after every deployment.

- [ ] `https://<your-service>.onrender.com/api/health` returns `200` and `"database": "ok"`.
- [ ] Render logs show a clean startup and no secrets.
- [ ] Register a brand-new customer on the live frontend.
- [ ] Log in as that customer.
- [ ] Log in as the administrator.
- [ ] Browse services/providers on the live frontend.
- [ ] Create a booking using a real available slot.
- [ ] Confirm the slot disappears from availability.
- [ ] Attempt a double booking → rejected.
- [ ] Confirm the customer and admin emails arrive.
- [ ] Change the appointment status as admin.
- [ ] Confirm the status email arrives.
- [ ] Upload a service image and a provider photo.
- [ ] Refresh and confirm images and records persist.
- [ ] Verify all navigation links.
- [ ] Verify protected routes.
- [ ] Check the browser console for errors.
- [ ] Check Render logs for errors.
- [ ] Confirm Neon/Supabase tables contain the new records.
- [ ] Confirm no database credentials are visible in the browser or repository.
- [ ] Re-run `npm run smoke` against the live API.

---

## 8. Security and repository checks

- [ ] `git status` does not list `backend/.env`, `frontend/.env`, logs, `node_modules`, or `dist`.
- [ ] `git log --all -- backend/.env` shows no history for the env file.
- [ ] The public GitHub repository contains no secrets.
- [ ] `render.yaml` and `vercel.json` contain no secret values.
- [ ] `.gitignore` excludes `.env`, `.env.*`, logs, uploads, build output, and the generated Prisma client.
- [ ] `JWT_SECRET` is long and random.
- [ ] The production admin password is not the default `Admin@123`.
- [ ] Resend and UploadThing keys are only in Render.
- [ ] CORS allows only the real frontend origins and this project's own Vercel preview URLs.
- [ ] `OPTIONS /api/services` returns `204` with `Access-Control-Allow-Origin` for each allowed frontend origin.
- [ ] Any key exposed during testing has been rotated.

---

## 9. Final results

| Section | Passed | Failed | Notes |
| --- | --- | --- | --- |
| Automated backend tests | | | |
| Frontend build/lint | | | |
| API smoke test (local) | | | |
| Customer workflow | | | |
| Admin workflow | | | |
| Backend/database | | | |
| Frontend deployment | | | |
| Responsive design | | | |
| Production/live | | | |
| Security/repository | | | |

**Submission decision:** do not mark the deployment as successful until every production/live item passes. Record any known limitations in [`README.md#known-limitations`](./README.md#known-limitations).

### Known limitations to mention in the viva

- Render free-tier cold starts.
- Resend test-mode recipient restrictions until a domain is verified.
- UploadThing credentials required for image uploads.
- One weekly schedule and one break per provider.
- Server-local timezone for date/time rules.
- Stateless JWT with no refresh-token rotation.
- Best-effort email delivery.
- No payment integration.
- No rate limiting/CAPTCHA.
- Browser E2E and responsive checks are manual.
