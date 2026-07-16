
-- Lock search_path on the trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- handle_new_user is only used by an auth trigger; strip external EXECUTE
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS helpers: revoke anon/public; keep authenticated so RLS can evaluate
REVOKE ALL ON FUNCTION public.user_has_active_firm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_active_firm(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.user_active_role_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_active_role_id() TO authenticated;
