# CampusAttend

Campus attendance starter using Next.js App Router, TypeScript, PostgreSQL on Neon, role-based HOD/faculty/student accounts, rotating QR tokens and classroom-location checks.

## Repository repair
The initial upload placed app and API files in the repository root with duplicate names such as `route (1).ts`. Next.js does not treat those as routes. The deployed source is organized under `src/app` and `src/lib`; original upload files are retained at the root for auditability.

## Deploy
1. Connect this GitHub repository to Vercel.
2. Set `DATABASE_URL` to the pooled connection string from the dedicated Neon project.
3. Set `AUTH_SECRET` to a unique random secret of at least 32 characters.
4. Set `APP_ORIGIN` to the deployed HTTPS URL.
5. Run `db/migrations/000_base_tables.sql`, then `db/migrations/001_campus_attendance_additive.sql` on this dedicated database only.
6. Provision the first HOD account with a strong password hash. Never enable public HOD signup.

## Security
This starter is not yet security-audited or ready for real student data. Add login rate limiting, password reset/verification, monitoring, CSRF/origin protection for state-changing requests, privacy/retention policy, and full end-to-end tests before production use. GPS can be spoofed and should not be treated as identity proof.

Never commit database URLs, secrets, real student data or actual passwords. Do not run the migration against any pre-existing attendance database without a separate backup and explicit review.
