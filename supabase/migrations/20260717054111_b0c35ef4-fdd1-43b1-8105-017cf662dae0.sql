
-- =========================================================
-- Sprint E1: Engagements Foundation (schema + RPCs + fixtures)
-- =========================================================

-- ---------- Helper: has_firm_role -------------------------
CREATE OR REPLACE FUNCTION public.has_firm_role(_firm_id uuid, _role_codes text[])
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
    JOIN public.roles r ON r.id = fm.role_id
    WHERE fm.user_id = auth.uid()
      AND fm.firm_id = _firm_id
      AND fm.status = 'active'
      AND f.status IN ('active','setup')
      AND r.code = ANY(_role_codes)
  )
$$;

REVOKE ALL ON FUNCTION public.has_firm_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_firm_role(uuid, text[]) TO authenticated, service_role;

-- ---------- Table: clients --------------------------------
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  client_code text NOT NULL,
  display_name text NOT NULL,
  legal_name text,
  status text NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect','active','inactive','archived')),
  primary_contact_email text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.clients IS
  'Practice Engine: client of record for a Firm. A Client is the party engaged; it is not an Engagement or an Engagement Period.';
CREATE UNIQUE INDEX clients_firm_code_uniq ON public.clients (firm_id, lower(client_code));
CREATE INDEX clients_firm_status_idx ON public.clients (firm_id, status);
CREATE INDEX clients_firm_display_idx ON public.clients (firm_id, lower(display_name));

GRANT SELECT ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read firm clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.user_has_active_firm(firm_id));

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Table: services -------------------------------
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  service_code text NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.services IS
  'Practice Engine: firm-defined catalog of services that may be sold to a client via an Engagement. A Service is a template/category, not an execution instance.';
CREATE UNIQUE INDEX services_firm_code_uniq ON public.services (firm_id, lower(service_code));
CREATE INDEX services_firm_status_idx ON public.services (firm_id, status);

GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read firm services" ON public.services
  FOR SELECT TO authenticated
  USING (public.user_has_active_firm(firm_id));

CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Table: engagements ----------------------------
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  engagement_reference text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','completed','cancelled')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.engagements IS
  'Practice Engine: the commercial/service agreement to deliver ONE Service to ONE Client for a Firm. Engagements answer "what have we agreed to provide". An Engagement is NOT an execution instance — recurring operational execution is modelled separately by Engagement Periods (introduced in a later milestone) and must never be conflated with this record.';
COMMENT ON COLUMN public.engagements.engagement_reference IS
  'Human-readable per-firm identifier, format ENG-<YYYY>-<seq>. Immutable after creation. Generation is performed by the E2 create RPC.';
CREATE UNIQUE INDEX engagements_firm_ref_uniq ON public.engagements (firm_id, engagement_reference);
CREATE INDEX engagements_firm_status_idx ON public.engagements (firm_id, status);
CREATE INDEX engagements_client_idx ON public.engagements (client_id);
CREATE INDEX engagements_service_idx ON public.engagements (service_id);
CREATE INDEX engagements_owner_idx ON public.engagements (owner_user_id);

GRANT SELECT ON public.engagements TO authenticated;
GRANT ALL ON public.engagements TO service_role;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read firm engagements" ON public.engagements
  FOR SELECT TO authenticated
  USING (public.user_has_active_firm(firm_id));

CREATE TRIGGER trg_engagements_updated_at
BEFORE UPDATE ON public.engagements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cross-firm integrity + date validation trigger.
CREATE OR REPLACE FUNCTION public.check_engagement_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients c
                 WHERE c.id = NEW.client_id AND c.firm_id = NEW.firm_id) THEN
    RAISE EXCEPTION 'client % does not belong to firm %', NEW.client_id, NEW.firm_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services s
                 WHERE s.id = NEW.service_id AND s.firm_id = NEW.firm_id) THEN
    RAISE EXCEPTION 'service % does not belong to firm %', NEW.service_id, NEW.firm_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.start_date IS NOT NULL
     AND NEW.end_date IS NOT NULL
     AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date (%) must be on or after start_date (%)',
      NEW.end_date, NEW.start_date
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_engagements_integrity
BEFORE INSERT OR UPDATE ON public.engagements
FOR EACH ROW EXECUTE FUNCTION public.check_engagement_integrity();

-- =========================================================
-- Write RPCs (SECURITY DEFINER) — E1 covers clients + services only
-- =========================================================

-- ---------- Clients: create / update / archive ------------
CREATE OR REPLACE FUNCTION public.create_client(
  _firm_id uuid,
  _client_code text,
  _display_name text,
  _legal_name text DEFAULT NULL,
  _status text DEFAULT 'prospect',
  _primary_contact_email text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT public.has_firm_role(_firm_id, ARRAY['FIRM_ADMIN','MANAGER']) THEN
    RAISE EXCEPTION 'insufficient permissions to manage clients in this firm';
  END IF;
  IF _client_code IS NULL OR length(btrim(_client_code)) = 0 THEN
    RAISE EXCEPTION 'client_code is required';
  END IF;
  IF _display_name IS NULL OR length(btrim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name is required';
  END IF;

  INSERT INTO public.clients
    (firm_id, client_code, display_name, legal_name, status,
     primary_contact_email, notes, created_by, updated_by)
  VALUES
    (_firm_id, btrim(_client_code), btrim(_display_name), _legal_name,
     COALESCE(_status,'prospect'), _primary_contact_email, _notes, v_uid, v_uid)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_client(uuid,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client(uuid,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_client(
  _client_id uuid,
  _display_name text DEFAULT NULL,
  _legal_name text DEFAULT NULL,
  _status text DEFAULT NULL,
  _primary_contact_email text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_firm uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT firm_id INTO v_firm FROM public.clients WHERE id = _client_id;
  IF v_firm IS NULL THEN RAISE EXCEPTION 'client not found'; END IF;
  IF NOT public.has_firm_role(v_firm, ARRAY['FIRM_ADMIN','MANAGER']) THEN
    RAISE EXCEPTION 'insufficient permissions to manage clients in this firm';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('prospect','active','inactive','archived') THEN
    RAISE EXCEPTION 'invalid client status: %', _status;
  END IF;

  UPDATE public.clients SET
    display_name = COALESCE(NULLIF(btrim(_display_name),''), display_name),
    legal_name = COALESCE(_legal_name, legal_name),
    status = COALESCE(_status, status),
    primary_contact_email = COALESCE(_primary_contact_email, primary_contact_email),
    notes = COALESCE(_notes, notes),
    updated_by = v_uid
  WHERE id = _client_id;
END $$;

REVOKE ALL ON FUNCTION public.update_client(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_client(uuid,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_client(_client_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_firm uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT firm_id INTO v_firm FROM public.clients WHERE id = _client_id;
  IF v_firm IS NULL THEN RAISE EXCEPTION 'client not found'; END IF;
  IF NOT public.has_firm_role(v_firm, ARRAY['FIRM_ADMIN','MANAGER']) THEN
    RAISE EXCEPTION 'insufficient permissions to manage clients in this firm';
  END IF;
  UPDATE public.clients
     SET status = 'archived', updated_by = v_uid
   WHERE id = _client_id;
END $$;

REVOKE ALL ON FUNCTION public.archive_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_client(uuid) TO authenticated;

-- ---------- Services: create / update / archive -----------
-- Services are Administration-managed → FIRM_ADMIN only.
CREATE OR REPLACE FUNCTION public.create_service(
  _firm_id uuid,
  _service_code text,
  _name text,
  _description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT public.has_firm_role(_firm_id, ARRAY['FIRM_ADMIN']) THEN
    RAISE EXCEPTION 'insufficient permissions to manage services in this firm';
  END IF;
  IF _service_code IS NULL OR length(btrim(_service_code)) = 0 THEN
    RAISE EXCEPTION 'service_code is required';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN
    RAISE EXCEPTION 'name is required';
  END IF;

  INSERT INTO public.services
    (firm_id, service_code, name, description, created_by, updated_by)
  VALUES
    (_firm_id, btrim(_service_code), btrim(_name), _description, v_uid, v_uid)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_service(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_service(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_service(
  _service_id uuid,
  _name text DEFAULT NULL,
  _description text DEFAULT NULL,
  _status text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_firm uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT firm_id INTO v_firm FROM public.services WHERE id = _service_id;
  IF v_firm IS NULL THEN RAISE EXCEPTION 'service not found'; END IF;
  IF NOT public.has_firm_role(v_firm, ARRAY['FIRM_ADMIN']) THEN
    RAISE EXCEPTION 'insufficient permissions to manage services in this firm';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('active','archived') THEN
    RAISE EXCEPTION 'invalid service status: %', _status;
  END IF;

  UPDATE public.services SET
    name = COALESCE(NULLIF(btrim(_name),''), name),
    description = COALESCE(_description, description),
    status = COALESCE(_status, status),
    updated_by = v_uid
  WHERE id = _service_id;
END $$;

REVOKE ALL ON FUNCTION public.update_service(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_service(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_service(_service_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_firm uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT firm_id INTO v_firm FROM public.services WHERE id = _service_id;
  IF v_firm IS NULL THEN RAISE EXCEPTION 'service not found'; END IF;
  IF NOT public.has_firm_role(v_firm, ARRAY['FIRM_ADMIN']) THEN
    RAISE EXCEPTION 'insufficient permissions to manage services in this firm';
  END IF;
  UPDATE public.services
     SET status = 'archived', updated_by = v_uid
   WHERE id = _service_id;
END $$;

REVOKE ALL ON FUNCTION public.archive_service(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_service(uuid) TO authenticated;

-- =========================================================
-- DEMO-only fixtures (guarded)
-- =========================================================
DO $$
DECLARE v_firm uuid;
        v_client_a uuid; v_client_b uuid;
        v_svc_a uuid; v_svc_b uuid;
BEGIN
  SELECT id INTO v_firm FROM public.firms WHERE firm_code = 'DEMO';
  IF v_firm IS NULL THEN
    RAISE NOTICE 'DEMO firm not present; skipping E1 fixtures';
    RETURN;
  END IF;

  INSERT INTO public.clients (firm_id, client_code, display_name, legal_name, status)
  VALUES (v_firm, 'ACME', 'Acme Holdings', 'Acme Holdings, LLC', 'active')
  ON CONFLICT (firm_id, lower(client_code)) DO NOTHING
  RETURNING id INTO v_client_a;
  IF v_client_a IS NULL THEN
    SELECT id INTO v_client_a FROM public.clients
      WHERE firm_id = v_firm AND lower(client_code) = 'acme';
  END IF;

  INSERT INTO public.clients (firm_id, client_code, display_name, legal_name, status)
  VALUES (v_firm, 'NORTHWIND', 'Northwind Traders', 'Northwind Traders, Inc.', 'prospect')
  ON CONFLICT (firm_id, lower(client_code)) DO NOTHING
  RETURNING id INTO v_client_b;
  IF v_client_b IS NULL THEN
    SELECT id INTO v_client_b FROM public.clients
      WHERE firm_id = v_firm AND lower(client_code) = 'northwind';
  END IF;

  INSERT INTO public.services (firm_id, service_code, name, description, status)
  VALUES (v_firm, 'TAX-1120', 'Corporate Tax Return (1120)', 'Preparation and filing of Form 1120.', 'active')
  ON CONFLICT (firm_id, lower(service_code)) DO NOTHING
  RETURNING id INTO v_svc_a;
  IF v_svc_a IS NULL THEN
    SELECT id INTO v_svc_a FROM public.services
      WHERE firm_id = v_firm AND lower(service_code) = 'tax-1120';
  END IF;

  INSERT INTO public.services (firm_id, service_code, name, description, status)
  VALUES (v_firm, 'BOOKS-MO', 'Monthly Bookkeeping', 'Recurring monthly bookkeeping and close.', 'active')
  ON CONFLICT (firm_id, lower(service_code)) DO NOTHING
  RETURNING id INTO v_svc_b;
  IF v_svc_b IS NULL THEN
    SELECT id INTO v_svc_b FROM public.services
      WHERE firm_id = v_firm AND lower(service_code) = 'books-mo';
  END IF;

  INSERT INTO public.engagements
    (firm_id, engagement_reference, client_id, service_id, name, status, start_date)
  VALUES
    (v_firm, 'ENG-2026-0001', v_client_a, v_svc_a, 'Acme — 2025 Form 1120', 'active', DATE '2026-01-15')
  ON CONFLICT (firm_id, engagement_reference) DO NOTHING;

  INSERT INTO public.engagements
    (firm_id, engagement_reference, client_id, service_id, name, status)
  VALUES
    (v_firm, 'ENG-2026-0002', v_client_a, v_svc_b, 'Acme — Monthly Bookkeeping', 'draft')
  ON CONFLICT (firm_id, engagement_reference) DO NOTHING;
END $$;
