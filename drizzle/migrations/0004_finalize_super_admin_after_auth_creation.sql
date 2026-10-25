CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_setup_available() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin'))
    AND NOT EXISTS (SELECT 1 FROM public.hub_initialization h WHERE h.completed_at IS NOT NULL
      OR h.claimed_at > now() - interval '5 minutes'
      OR EXISTS (SELECT 1 FROM auth.users u WHERE u.raw_app_meta_data->>'hub_setup_token' = h.claim_token::text));
$$;

CREATE FUNCTION public.finalize_hub_setup(_token uuid, _user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  PERFORM pg_advisory_xact_lock(81273041);
  IF EXISTS (SELECT 1 FROM public.hub_initialization WHERE completed_at IS NOT NULL) THEN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
      AND EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND raw_app_meta_data->>'hub_setup_token' = _token::text);
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Hub setup is already complete';
  END IF;
  SELECT u.email INTO _email FROM auth.users u JOIN public.hub_initialization h
    ON h.claim_token = _token AND h.completed_at IS NULL
    WHERE u.id = _user_id AND u.email_confirmed_at IS NOT NULL
      AND u.raw_app_meta_data->>'hub_setup_token' = _token::text
      AND u.created_at >= h.claimed_at AND u.created_at < h.claimed_at + interval '5 minutes';
  IF NOT FOUND THEN RAISE EXCEPTION 'Hub setup account does not match the trusted claim'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, 'super_admin');
  UPDATE public.hub_initialization SET completed_at = now(), claim_token = NULL WHERE singleton;
  INSERT INTO public.audit_log(actor_id, actor_email, action, target) VALUES (_user_id, _email, 'hub.initialized', _email);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_hub_setup(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_hub_setup(uuid, uuid) TO service_role;