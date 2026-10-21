-- CampusAttend additive schema extension.
-- Do NOT run against production until tested on a separate Neon development branch.
-- Existing tables (users, students, faculty, attendance, attendance_sessions) are not altered.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.campus_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('hod','faculty','student')),
  student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  faculty_id uuid NULL REFERENCES public.faculty(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz NULL,
  password_changed_at timestamptz NULL,
  last_login_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role <> 'student') OR student_id IS NOT NULL),
  CHECK ((role <> 'faculty') OR faculty_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_users_student_unique
  ON public.campus_users(student_id) WHERE student_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campus_users_faculty_unique
  ON public.campus_users(faculty_id) WHERE faculty_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campus_users_email_lower_idx ON public.campus_users(lower(email));

CREATE TABLE IF NOT EXISTS public.campus_student_contacts (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_student_contacts_email_lower_idx
  ON public.campus_student_contacts(lower(email));

CREATE TABLE IF NOT EXISTS public.campus_classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  building text NULL,
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  radius_m integer NOT NULL DEFAULT 60 CHECK(radius_m BETWEEN 10 AND 500),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campus_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_user_id uuid NOT NULL REFERENCES public.campus_users(id) ON DELETE RESTRICT,
  subject_code text NOT NULL,
  year integer NOT NULL CHECK(year BETWEEN 1 AND 4),
  section text NOT NULL,
  dept text NOT NULL DEFAULT 'CSE-AIML',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(faculty_user_id,subject_code,year,section,dept)
);

CREATE TABLE IF NOT EXISTS public.campus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.campus_users(id) ON DELETE RESTRICT,
  year integer NOT NULL CHECK(year BETWEEN 1 AND 4),
  section text NOT NULL,
  dept text NOT NULL DEFAULT 'CSE-AIML',
  subject_code text NOT NULL,
  classroom_id uuid NOT NULL REFERENCES public.campus_classrooms(id) ON DELETE RESTRICT,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(closes_at > opens_at)
);
CREATE INDEX IF NOT EXISTS campus_sessions_class_time_idx
  ON public.campus_sessions(year,section,dept,opens_at DESC);

CREATE TABLE IF NOT EXISTS public.campus_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.campus_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.campus_users(id) ON DELETE RESTRICT,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campus_qr_tokens_session_expiry_idx
  ON public.campus_qr_tokens(session_id,expires_at);

CREATE TABLE IF NOT EXISTS public.campus_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.campus_sessions(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('present','absent','excused')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision NULL CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude double precision NULL CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
  accuracy_m double precision NULL CHECK(accuracy_m IS NULL OR accuracy_m >= 0),
  distance_m integer NULL CHECK(distance_m IS NULL OR distance_m >= 0),
  verification_method text NOT NULL CHECK(verification_method IN ('qr_gps','manual','admin_correction')),
  corrected_by uuid NULL REFERENCES public.campus_users(id) ON DELETE RESTRICT,
  correction_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,student_id),
  CHECK ((verification_method NOT IN ('manual','admin_correction')) OR correction_reason IS NOT NULL OR corrected_by IS NULL)
);
CREATE INDEX IF NOT EXISTS campus_attendance_student_marked_idx
  ON public.campus_attendance(student_id,marked_at DESC);
CREATE INDEX IF NOT EXISTS campus_attendance_session_status_idx
  ON public.campus_attendance(session_id,status);

CREATE TABLE IF NOT EXISTS public.campus_audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid NULL REFERENCES public.campus_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campus_audit_logs_created_idx
  ON public.campus_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS campus_audit_logs_actor_idx
  ON public.campus_audit_logs(actor_user_id,created_at DESC);

-- Deliberately no user is seeded here. Provision the first HOD through a trusted,
-- one-time administrative script after the migration is reviewed.
-- Deliberately no destructive changes are made to the legacy attendance schema.
