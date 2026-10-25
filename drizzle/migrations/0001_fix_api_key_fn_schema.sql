create or replace function public.rotate_system_api_key(_system_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  if not public.is_hub_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  update public.systems set api_key = encode(extensions.gen_random_bytes(24), 'hex') where id = _system_id returning api_key into k;
  return k;
end $$;
alter table public.systems alter column api_key set default encode(extensions.gen_random_bytes(24), 'hex');