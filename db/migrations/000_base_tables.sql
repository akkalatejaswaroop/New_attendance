-- Fresh-database base tables required by the additive CampusAttend migration.
-- Safe to run on the NEW campus-attendance-deploy Neon project only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no text NOT NULL UNIQUE,
  name text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 1 AND 4),
  section text NOT NULL,
  dept text NOT NULL DEFAULT 'CSE-AIML',
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS students_class_idx ON public.students(dept, year, section, status);

CREATE TABLE IF NOT EXISTS public.faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE,
  name text NOT NULL,
  email text UNIQUE,
  department text NOT NULL DEFAULT 'CSE-AIML',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
