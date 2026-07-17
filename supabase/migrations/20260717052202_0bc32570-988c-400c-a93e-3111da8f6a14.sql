
-- Sprint B: enforce "no client writes on Kernel tables" for profiles.

DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
-- SELECT for authenticated and ALL for service_role remain intact.
-- handle_new_user() is SECURITY DEFINER and bypasses these grants,
-- so automatic profile creation on signup is unaffected.
