do $$
declare d text := pg_get_functiondef('public.ams_selftest()'::regprocedure);
begin
  d := replace(d, 'values (r2, ''user'', u2, site);', 'values (r2, ''user'', u3, site);');
  d := replace(d, 'ams_effective_core(u2, ''tst1'', site)', 'ams_effective_core(u3, ''tst1'', site)');
  d := replace(d, 'ams_effective_core(u2, ''tst1'', site2)', 'ams_effective_core(u3, ''tst1'', site2)');
  d := replace(d, 'ams_effective_core(u2, ''tst1'') where action_key = ''release''', 'ams_effective_core(u3, ''tst1'') where action_key = ''release''');
  execute d;
end $$;