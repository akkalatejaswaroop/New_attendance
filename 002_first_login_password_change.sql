-- Additive migration: require every CampusAttend account to change its temporary password.
-- Existing account rows are retained; only the new security flag is added/updated.
ALTER TABLE public.campus_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

UPDATE public.campus_users
SET must_change_password = true;
