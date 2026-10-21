-- CampusAttend workflow expansion (additive; safe to re-run).
-- Apply to the same Neon database used by the deployed application.
CREATE TABLE IF NOT EXISTS public.campus_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  leave_type text NOT NULL CHECK (leave_type IN ('medical','personal','official','other')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  evidence_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by uuid REFERENCES public.campus_users(id) ON DELETE SET NULL,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date),
  CHECK (to_date - from_date <= 30)
);
CREATE INDEX IF NOT EXISTS campus_leave_student_idx ON public.campus_leave_requests(student_id, from_date DESC);
CREATE INDEX IF NOT EXISTS campus_leave_review_idx ON public.campus_leave_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.campus_timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dept text NOT NULL DEFAULT 'CSE-AIML',
  year integer NOT NULL CHECK (year BETWEEN 1 AND 4),
  section text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject_code text NOT NULL,
  subject_name text NOT NULL,
  faculty_user_id uuid REFERENCES public.campus_users(id) ON DELETE SET NULL,
  classroom_id uuid REFERENCES public.campus_classrooms(id) ON DELETE SET NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.campus_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
CREATE INDEX IF NOT EXISTS campus_timetable_class_day_idx
  ON public.campus_timetable(dept, year, section, day_of_week, start_time) WHERE active = true;
CREATE INDEX IF NOT EXISTS campus_timetable_faculty_idx
  ON public.campus_timetable(faculty_user_id, day_of_week, start_time) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.campus_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by uuid REFERENCES public.campus_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.campus_settings(setting_key, setting_value)
VALUES ('absence_fine_per_day', '{"amount":50,"currency":"INR"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.campus_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  absent_date date NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  reason text NOT NULL DEFAULT 'Unexcused absence',
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','waived','cancelled')),
  source_session_id uuid REFERENCES public.campus_sessions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.campus_users(id) ON DELETE SET NULL,
  resolved_by uuid REFERENCES public.campus_users(id) ON DELETE SET NULL,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, absent_date)
);
CREATE INDEX IF NOT EXISTS campus_fines_student_status_idx ON public.campus_fines(student_id, status, absent_date DESC);
CREATE INDEX IF NOT EXISTS campus_fines_date_idx ON public.campus_fines(absent_date DESC);

CREATE TABLE IF NOT EXISTS public.campus_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.campus_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campus_notifications_user_idx ON public.campus_notifications(user_id, created_at DESC);

-- Seed the standard fine policy without overwriting an HOD-configured amount.
INSERT INTO public.campus_audit_logs(action, entity_type, metadata)
SELECT 'settings.seeded', 'campus_settings', '{"setting":"absence_fine_per_day","amount":50,"currency":"INR"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.campus_audit_logs WHERE action='settings.seeded' AND entity_type='campus_settings'
);
