CREATE TABLE public.hub_initialization (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  claim_token uuid,
  claimed_at timestamptz,
  completed_at timestamptz
);
GRANT ALL ON public.hub_initialization TO service_role;
ALTER TABLE public.hub_initialization ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.hub_setup_available() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin'))
    AND NOT EXISTS (SELECT 1 FROM public.hub_initialization WHERE completed_at IS NOT NULL OR claimed_at > now() - interval '5 minutes');
$$;
REVOKE ALL ON FUNCTION public.hub_setup_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_setup_available() TO anon, authenticated, service_role;

CREATE FUNCTION public.claim_hub_setup(_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(81273041);
  IF NOT public.hub_setup_available() THEN RETURN false; END IF;
  INSERT INTO public.hub_initialization(singleton, claim_token, claimed_at)
  VALUES (true, _token, now())
  ON CONFLICT (singleton) DO UPDATE SET claim_token = _token, claimed_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_hub_setup(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hub_setup(uuid) TO service_role;

CREATE FUNCTION public.release_hub_setup(_token uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.hub_initialization SET claim_token = NULL, claimed_at = NULL
  WHERE claim_token = _token AND completed_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.release_hub_setup(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_hub_setup(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  IF new.raw_app_meta_data->>'hub_setup_token' IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(81273041);
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')) THEN
      RAISE EXCEPTION 'Hub setup is already complete';
    END IF;
    UPDATE public.hub_initialization SET completed_at = now(), claim_token = NULL
    WHERE singleton = true AND completed_at IS NULL
      AND claim_token::text = new.raw_app_meta_data->>'hub_setup_token'
      AND claimed_at > now() - interval '5 minutes';
    IF NOT FOUND THEN RAISE EXCEPTION 'Hub setup claim is invalid or expired'; END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'super_admin');
    INSERT INTO public.audit_log(actor_id, actor_email, action, target)
    VALUES (new.id, new.email, 'hub.initialized', new.email);
  END IF;
  RETURN new;
END;
$$;