-- init-db-user.sql
-- Runs once on first PostgreSQL container boot via docker-entrypoint-initdb.d.
-- Creates the app_user role used by the application (with RLS enforcement).

-- Create application user role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'dev_password';
  END IF;
END
$$;

-- Grant connection to the dev database
GRANT CONNECT ON DATABASE recruitment_os_dev TO app_user;

-- Grant schema usage and privileges
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Ensure future tables/sequences/functions also get privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO app_user;
