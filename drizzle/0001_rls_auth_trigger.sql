-- Custom migration: RLS lockdown, auth.users linkage, and profile bootstrap.
-- Hand-authored (drizzle-kit generate --custom). Do not edit after applying.

-- ---------------------------------------------------------------------------
-- 1. Row Level Security: enabled on every public table with NO policies.
--    The anon key therefore grants zero access. All real access is server-side
--    through the pooled Postgres role (Server Actions / Server Components).
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Link profiles.id to auth.users(id). auth.users is a reference target only
--    and is never migrated by drizzle-kit; the FK lives here in raw SQL.
--    Deleting an auth user removes their profile row.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_auth_users_id_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. AFTER INSERT trigger on auth.users: create the matching profiles row.
--    New accounts (created by an admin in the Supabase dashboard) become
--    'admin' by default. full_name is pulled from user metadata when present.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";--> statement-breakpoint

CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."handle_new_user"();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Bootstrap the singleton app_settings row (id = 1). Idempotent.
-- ---------------------------------------------------------------------------
INSERT INTO "public"."app_settings" ("id") VALUES (1)
  ON CONFLICT ("id") DO NOTHING;
