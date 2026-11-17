create or replace function public.ams_guard_last_super_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'user_roles' then
    if old.role = 'super_admin' and public.ams_active_super_admins() <= 1
       and exists (select 1 from public.accounts where user_id = old.user_id and status = 'active') then
      raise exception 'The last active Super Admin cannot be removed' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'active' and new.status <> 'active'
     and exists (select 1 from public.user_roles where user_id = old.user_id and role = 'super_admin') and public.ams_active_super_admins() <= 1 then
    raise exception 'The last active Super Admin cannot be disabled' using errcode = '42501';
  end if;
  return new;
end $$;