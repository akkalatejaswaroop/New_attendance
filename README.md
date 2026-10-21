# CampusAttend — production-oriented starter

Campus attendance platform for HOD, faculty, and students:
- Next.js + TypeScript web dashboard and API, deployable to Vercel
- Neon PostgreSQL via server-only `pg` connection pool
- Native Android app can use the same `/api/v1/*` endpoints (Android client source is not included in this starter)
- Email/password login starter using Argon2id hashes and signed HTTP-only cookies
- CSV student import, classroom boundaries, QR session and attendance API foundations

## Current status

This is a source starter, not a deployed or security-audited production system. The migration is **additive** and is not run automatically. Existing `ATTENDANCE` tables and data are preserved. Review and test it on a Neon development branch before applying it to the current project.

The connected Neon project was inspected read-only. At inspection time the `production` branch was reported ready; earlier it had appeared archived. No schema, user data, branch settings, or credentials were modified by this starter generation.

## Requirements

- Node.js 20.11+ (or current supported LTS)
- Neon PostgreSQL connection string
- Vercel project (optional for local development)

## Setup

```bash
npm install
cp .env.example .env.local
# Fill DATABASE_URL with the Neon pooled URL.
# Fill AUTH_SECRET with a random 32+ byte secret.
npm run dev
```

Open http://localhost:3000.

## Database migration

1. Create a separate Neon development branch from `ATTENDANCE` in the Neon console.
2. Set `DATABASE_URL` to that branch's pooled connection string for app runtime.
3. For migrations, use its **direct / unpooled** connection string as `DATABASE_URL_UNPOOLED`.
4. Review `db/migrations/001_campus_attendance_additive.sql`.
5. Run it only on the development branch first using your SQL migration workflow.
6. Test import, role permissions, classroom geofence, QR expiry/replay, duplicate attendance, and audit events.
7. Only after approval, schedule a production migration window and backup/recovery plan. Do not use this starter to alter the existing production branch without review.

## Security notes before real deployment

- Set `AUTH_SECRET` to a unique high-entropy secret and configure HTTPS.
- Provision the first HOD out-of-band; do not allow public HOD signup.
- Add email verification, rate limiting, login lockout / abuse protection, password reset delivery, and security monitoring before public launch.
- Configure Vercel environment variables; never commit `.env.local`.
- QR token secrets are generated on the server and never contain student PII.
- GPS is approximate and can be spoofed; use it as a signal, not proof of identity. Offer an audited manual exception route.
- Review local privacy requirements, consent text, retention rules, and student-data access before launch.
- Keep Neon credentials out of the Android APK and browser bundle.

## Routes included

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/students/import` — HOD only, CSV JSON rows in this starter
- `POST /api/v1/sessions` — faculty/HOD authorized session creation
- `POST /api/v1/sessions/:id/qr` — create/rotate token
- `POST /api/v1/attendance/mark` — student attendance with QR + classroom location
- `GET /api/v1/attendance/me`

API endpoints are foundations and require full integration tests, email workflows, rate limiting, and deployment configuration before production use.
