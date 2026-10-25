REVOKE ALL ON TABLE public.hub_initialization FROM anon, authenticated;
GRANT ALL ON TABLE public.hub_initialization TO service_role;