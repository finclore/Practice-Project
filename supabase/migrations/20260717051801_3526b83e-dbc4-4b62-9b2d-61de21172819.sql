
-- Sprint A: lock down first-admin bootstrap.

DROP FUNCTION IF EXISTS public.bootstrap_first_admin(text);

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  _firm_code text,
  _user_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id uuid;
  v_role_id uuid;
  v_user_id uuid;
  v_membership_id uuid;
BEGIN
  IF _firm_code IS NULL OR length(btrim(_firm_code)) = 0 THEN
    RAISE EXCEPTION 'firm_code is required';
  END IF;
  IF _user_email IS NULL OR length(btrim(_user_email)) = 0 THEN
    RAISE EXCEPTION 'user_email is required';
  END IF;

  -- Serialize concurrent bootstraps against this firm.
  SELECT id INTO v_firm_id
  FROM public.firms
  WHERE firm_code = _firm_code
  FOR UPDATE;

  IF v_firm_id IS NULL THEN
    RAISE EXCEPTION 'Firm not found: %', _firm_code;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'FIRM_ADMIN';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'FIRM_ADMIN role missing; kernel seed not applied';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(btrim(_user_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %', _user_email;
  END IF;

  -- Precondition evaluated under the row lock: exactly one first admin.
  IF EXISTS (
    SELECT 1 FROM public.firm_memberships
    WHERE firm_id = v_firm_id
      AND role_id = v_role_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Firm % already has an active Firm Administrator', _firm_code;
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  SELECT v_user_id, COALESCE(split_part(u.email, '@', 1), 'Administrator')
  FROM auth.users u WHERE u.id = v_user_id
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.firm_memberships
    (firm_id, user_id, role_id, status, is_primary_firm)
  VALUES
    (v_firm_id, v_user_id, v_role_id, 'active', true)
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END $$;

-- Service-role only. Browser sessions (anon / authenticated) cannot execute.
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(text, text)
  TO service_role;
