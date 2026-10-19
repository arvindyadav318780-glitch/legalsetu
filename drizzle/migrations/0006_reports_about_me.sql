CREATE OR REPLACE FUNCTION public.reports_about_me() RETURNS TABLE(open_count integer, total_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select count(*) filter (where status in ('open','reviewing'))::int, count(*)::int from public.abuse_reports where target_user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.reports_about_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reports_about_me() TO authenticated;