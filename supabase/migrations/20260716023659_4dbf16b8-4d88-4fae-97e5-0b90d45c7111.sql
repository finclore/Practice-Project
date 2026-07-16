
-- =========================================================
-- FIRMS
-- =========================================================
CREATE TABLE public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_code text UNIQUE NOT NULL,
  display_name text NOT NULL,
  legal_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('setup','active','suspended','archived')),
  country_code text NOT NULL DEFAULT 'US',
  primary_state_code text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  default_currency text NOT NULL DEFAULT 'USD',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  general_email text,
  default_sender_name text,
  default_sender_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.firms TO authenticated;
GRANT ALL ON public.firms TO service_role;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  first_name text,
  last_name text,
  job_title text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','disabled','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ROLES
-- =========================================================
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  role_level integer NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- FIRM MEMBERSHIPS
-- =========================================================
CREATE TABLE public.firm_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended','ended')),
  is_primary_firm boolean NOT NULL DEFAULT true,
  reports_to_user_id uuid REFERENCES auth.users(id),
  access_start_date date NOT NULL DEFAULT current_date,
  access_end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, user_id)
);
GRANT SELECT ON public.firm_memberships TO authenticated;
GRANT ALL ON public.firm_memberships TO service_role;
ALTER TABLE public.firm_memberships ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- FIRM BRANDING
-- =========================================================
CREATE TABLE public.firm_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  branding_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  brand_display_name text NOT NULL,
  tagline text,
  primary_logo_path text,
  primary_color_hex text NOT NULL DEFAULT '#1F4E79',
  secondary_color_hex text NOT NULL DEFAULT '#D9EAF7',
  accent_color_hex text,
  default_font_family text NOT NULL DEFAULT 'Aptos',
  default_footer_text text,
  default_signatory_name text,
  default_signatory_title text,
  default_reply_to_email text,
  version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX firm_branding_one_active_per_firm
  ON public.firm_branding (firm_id) WHERE status = 'active';
GRANT SELECT ON public.firm_branding TO authenticated;
GRANT ALL ON public.firm_branding TO service_role;
ALTER TABLE public.firm_branding ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Shared: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_firms_updated_at BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_firm_memberships_updated_at BEFORE UPDATE ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_firm_branding_updated_at BEFORE UPDATE ON public.firm_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Security-definer helpers (avoid recursive RLS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_has_active_firm(_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.firm_memberships fm
    JOIN public.firms f ON f.id = fm.firm_id
    WHERE fm.user_id = auth.uid()
      AND fm.firm_id = _firm_id
      AND fm.status = 'active'
      AND f.status IN ('active','setup')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_active_role_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fm.role_id
  FROM public.firm_memberships fm
  JOIN public.firms f ON f.id = fm.firm_id
  WHERE fm.user_id = auth.uid()
    AND fm.status = 'active'
    AND f.status IN ('active','setup')
  ORDER BY fm.is_primary_firm DESC, fm.created_at ASC
  LIMIT 1
$$;

-- =========================================================
-- RLS policies
-- =========================================================

-- profiles
CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- firm_memberships
CREATE POLICY "read own memberships" ON public.firm_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- firms
CREATE POLICY "read member firms" ON public.firms
  FOR SELECT TO authenticated USING (public.user_has_active_firm(id));

-- firm_branding
CREATE POLICY "read member firm branding" ON public.firm_branding
  FOR SELECT TO authenticated USING (public.user_has_active_firm(firm_id));

-- roles: read the role attached to caller's active membership
CREATE POLICY "read active role" ON public.roles
  FOR SELECT TO authenticated USING (id = public.user_active_role_id());

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Seed fixed roles
-- =========================================================
INSERT INTO public.roles (code, name, role_level, description) VALUES
  ('FIRM_ADMIN',      'Firm Administrator', 10, 'Full administrative access within the firm.'),
  ('MANAGER',         'Manager',            20, 'Manages engagements, staff, and workflows.'),
  ('REVIEWER',        'Reviewer',           30, 'Reviews and approves work products.'),
  ('STAFF',           'Staff',              40, 'Executes assigned work.'),
  ('CLIENT_SERVICES', 'Client Services',    50, 'Handles client communications and intake.'),
  ('VIEWER',          'Viewer',             60, 'Read-only access.');

-- =========================================================
-- Seed dummy development firm (no auth user attached)
-- =========================================================
INSERT INTO public.firms (firm_code, display_name, legal_name, status, general_email)
VALUES ('DEMO', 'Demo Practice', 'Demo Practice LLC', 'active', 'hello@demopractice.example');

INSERT INTO public.firm_branding (firm_id, branding_name, brand_display_name, tagline, default_signatory_title)
SELECT id, 'Default', 'Demo Practice', 'Precision. Clarity. Trust.', 'Managing Partner'
FROM public.firms WHERE firm_code = 'DEMO';

-- =========================================================
-- Bootstrap: elevate the calling authenticated user to first
-- Firm Administrator of a firm that has no active admin yet.
-- =========================================================
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(_firm_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firm_id uuid;
  v_role_id uuid;
  v_admin_count int;
  v_membership_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_firm_id FROM public.firms WHERE firm_code = _firm_code;
  IF v_firm_id IS NULL THEN
    RAISE EXCEPTION 'Firm not found: %', _firm_code;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = 'FIRM_ADMIN';

  SELECT count(*) INTO v_admin_count
  FROM public.firm_memberships fm
  WHERE fm.firm_id = v_firm_id
    AND fm.role_id = v_role_id
    AND fm.status = 'active';

  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'Firm % already has an active Firm Administrator', _firm_code;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (auth.uid(), COALESCE(split_part(v_email, '@', 1), 'Administrator'))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.firm_memberships (firm_id, user_id, role_id, status, is_primary_firm)
  VALUES (v_firm_id, auth.uid(), v_role_id, 'active', true)
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END $$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(text) TO authenticated;
