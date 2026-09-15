-- Lock the public schema away from the Supabase REST API.
--
-- Every table has row-level security ENABLED with ZERO policies, and the API roles hold no
-- table privileges. All reads and writes go through the Next.js server (lib/server/data/*),
-- which connects as the database owner. This migration is idempotent and re-asserts the rule
-- for any table that exists when it runs; tests/unit/rls.test.ts asserts it after every migrate.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END
$$;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
--> statement-breakpoint
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled on: %', missing;
  END IF;
END
$$;
