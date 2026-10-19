CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL CHECK (kind IN ('permission_denied','app_error','suspicious_activity','auth_failure')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  area text,
  summary text NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_created_idx ON public.security_events (created_at DESC);
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read security events" ON public.security_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Only way to write: sanitised, rate-limited, no free-form personal data.
CREATE OR REPLACE FUNCTION public.log_security_event(_kind text, _area text, _summary text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _sev text; _test boolean := false; _clean text;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _kind NOT IN ('permission_denied','app_error','suspicious_activity') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF (SELECT count(*) FROM security_events WHERE user_id = _uid AND created_at > now() - interval '1 hour') >= 30 THEN RETURN; END IF;
  -- strip emails, phone-like digit runs and token-like strings
  _clean := left(coalesce(_summary,''), 300);
  _clean := regexp_replace(_clean, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', '[email]', 'g');
  _clean := regexp_replace(_clean, '\+?\d[\d\s-]{8,}\d', '[number]', 'g');
  _clean := regexp_replace(_clean, '(eyJ[\w-]+\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{32,})', '[redacted]', 'g');
  _sev := CASE _kind WHEN 'permission_denied' THEN 'medium' WHEN 'suspicious_activity' THEN 'high' ELSE 'low' END;
  SELECT (coalesce(full_name,'') ILIKE '%test%' OR coalesce(email,'') ILIKE '%test%') INTO _test FROM profiles WHERE id = _uid;
  INSERT INTO security_events(user_id, kind, severity, area, summary, is_test)
  VALUES (_uid, _kind, _sev, left(coalesce(_area,''),80), _clean, coalesce(_test,false));
END $$;
REVOKE ALL ON FUNCTION public.log_security_event(text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text) TO authenticated;