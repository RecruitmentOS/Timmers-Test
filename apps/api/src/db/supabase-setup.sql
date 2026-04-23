-- supabase-setup.sql
-- Run this ONCE in the Supabase SQL Editor BEFORE running Drizzle migrations.
-- Creates the app_user role used by the application for RLS-enforced queries.
-- Replace 'CHANGE_ME_APP_USER_PASSWORD' with a strong password.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'CHANGE_ME_APP_USER_PASSWORD';
  END IF;
END
$$;

-- Grant connection and schema privileges
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Ensure future tables/sequences/functions also get privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO app_user;
