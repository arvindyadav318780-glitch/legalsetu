CREATE UNIQUE INDEX IF NOT EXISTS risk_alerts_open_dedupe ON public.risk_alerts (kind, (details->>'key')) WHERE status IN ('open','reviewing') AND details ? 'key';

CREATE OR REPLACE FUNCTION public.crm_overdue_days() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT (value->>'days')::int FROM platform_settings WHERE key='crm_overdue_days'), 3) $$;

CREATE OR REPLACE FUNCTION public.crm_is_test_request(_ref text, _name text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(_ref,'') ILIKE '%TEST%' OR COALESCE(_name,'') ILIKE '%TEST%' $$;

CREATE OR REPLACE FUNCTION public.crm_dashboard() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d int := public.crm_overdue_days(); r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'overdue_days', d,
    'clients', (SELECT count(DISTINCT user_id) FROM user_roles WHERE role='customer'),
    'pros_ca', (SELECT count(*) FROM professional_profiles WHERE category ILIKE 'ca%' OR category ILIKE '%chartered%'),
    'pros_advocate', (SELECT count(*) FROM professional_profiles WHERE category ILIKE '%advocate%'),
    'ver_pending', (SELECT count(*) FROM professional_profiles WHERE verification_status IN ('pending','under_review','more_info')),
    'ver_approved', (SELECT count(*) FROM professional_profiles WHERE verification_status='approved'),
    'unlisted', (SELECT count(*) FROM professional_profiles WHERE NOT is_listed),
    'restricted', (SELECT count(DISTINCT user_id) FROM account_restrictions WHERE lifted_at IS NULL AND ends_at > now()) + (SELECT count(*) FROM profiles WHERE suspended),
    'requests_by_status', (SELECT COALESCE(jsonb_object_agg(status, n),'{}') FROM (SELECT status::text, count(*) n FROM service_requests GROUP BY 1) s),
    'requests_test', (SELECT count(*) FROM service_requests WHERE crm_is_test_request(reference, contact_name)),
    'requests_total', (SELECT count(*) FROM service_requests),
    'unassigned', (SELECT count(*) FROM service_requests WHERE assigned_professional_id IS NULL AND status NOT IN ('completed','cancelled','closed')),
    'overdue', (SELECT count(*) FROM service_requests WHERE status NOT IN ('completed','cancelled','closed') AND updated_at < now() - make_interval(days => d)),
    'open_complaints', (SELECT count(*) FROM support_tickets WHERE kind IN ('complaint','profile_report') AND status IN ('open','in_progress')),
    'open_reports', (SELECT count(*) FROM abuse_reports WHERE status NOT IN ('resolved','dismissed','actioned')),
    'open_appeals', (SELECT count(*) FROM appeals WHERE status IN ('submitted','under_review')),
    'pending_contact', (SELECT count(*) FROM contact_messages WHERE handling_status NOT IN ('replied','closed')),
    'open_alerts', (SELECT count(*) FROM risk_alerts WHERE status IN ('open','reviewing'))
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.crm_finance_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'payments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'kind','service_payment','ref',sr.reference,'professional_id',p.professional_id,'pro_name',pp.display_name,
        'amount_paise',p.total_paise,'refunded_paise',p.refunded_paise,'status',p.status,'test_mode',p.test_mode,'provider_order_id',p.provider_order_id,
        'provider_payment_id',p.provider_payment_id,'created_at',p.created_at,'paid_at',p.paid_at) ORDER BY p.created_at DESC),'[]')
      FROM payments p LEFT JOIN service_requests sr ON sr.id=p.request_id LEFT JOIN professional_profiles pp ON pp.user_id=p.professional_id),
    'orders', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',o.id,'kind','credit_order','ref',left(o.id::text,8),'professional_id',o.professional_id,'pro_name',pp.display_name,
        'amount_paise',o.amount_paise,'refunded_paise',COALESCE((SELECT sum(amount_paise) FROM credit_refunds cr WHERE cr.order_id=o.id AND cr.status='processed'),0),
        'status',o.status,'test_mode',o.test_mode,'provider_order_id',o.provider_order_id,'provider_payment_id',o.provider_payment_id,'created_at',o.created_at,'paid_at',o.paid_at) ORDER BY o.created_at DESC),'[]')
      FROM credit_orders o LEFT JOIN professional_profiles pp ON pp.user_id=o.professional_id),
    'lead_fee_paise', (SELECT contact_price_paise FROM marketplace_settings LIMIT 1),
    'lead_unlocks', (SELECT count(*) FROM credit_ledger WHERE kind='consume'),
    'refund_requests', (SELECT COALESCE(jsonb_object_agg(status,n),'{}') FROM (SELECT status, count(*) n FROM refund_requests GROUP BY 1) s)
  );
END $$;

CREATE OR REPLACE FUNCTION public.crm_refresh_alerts() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d int := public.crm_overdue_days(); n int := 0; c int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  INSERT INTO risk_alerts(user_id, kind, details, status)
  SELECT sr.customer_id, 'crm_overdue_request', jsonb_build_object('key', sr.id::text, 'reference', sr.reference, 'link', '/dashboard/requests/'||sr.id, 'days', d), 'open'
  FROM service_requests sr WHERE sr.status NOT IN ('completed','cancelled','closed') AND sr.updated_at < now() - make_interval(days => d)
  ON CONFLICT DO NOTHING; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  INSERT INTO risk_alerts(user_id, kind, details, status)
  SELECT a.customer_id, 'crm_possible_duplicate', jsonb_build_object('key', least(a.id,b.id)::text||greatest(a.id,b.id)::text, 'reference', a.reference||' / '||b.reference, 'link', '/admin/requests'), 'open'
  FROM service_requests a JOIN service_requests b ON a.customer_id=b.customer_id AND a.service_slug=b.service_slug AND a.id<b.id AND abs(extract(epoch FROM a.created_at-b.created_at)) < 86400
  ON CONFLICT DO NOTHING; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  INSERT INTO risk_alerts(user_id, kind, details, status)
  SELECT p.customer_id, 'crm_payment_mismatch', jsonb_build_object('key', p.id::text, 'reason',
      CASE WHEN p.refunded_paise > p.total_paise THEN 'Refund larger than payment' ELSE 'Marked paid without a payment ID' END, 'link', '/admin/finance'), 'open'
  FROM payments p WHERE p.refunded_paise > p.total_paise OR (p.status IN ('paid','partially_refunded','refunded') AND p.provider_payment_id IS NULL)
  ON CONFLICT DO NOTHING; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  INSERT INTO risk_alerts(user_id, kind, details, status)
  SELECT o.professional_id, 'crm_payment_mismatch', jsonb_build_object('key', o.id::text, 'reason', 'Credit order marked successful without a payment ID', 'link', '/admin/finance'), 'open'
  FROM credit_orders o WHERE o.status IN ('successful','refunded') AND o.provider_payment_id IS NULL
  ON CONFLICT DO NOTHING; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.crm_ack_alert(_id uuid, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  UPDATE risk_alerts SET status='resolved', reviewed_by=auth.uid(), reviewed_at=now(), review_note=left(COALESCE(NULLIF(trim(_note),''),'Acknowledged'),500) WHERE id=_id;
  INSERT INTO audit_logs(actor_id, action, target, details) VALUES (auth.uid(), 'alert.acknowledge', 'risk_alert:'||_id, jsonb_build_object('note', left(_note,200)));
END $$;

CREATE OR REPLACE FUNCTION public.crm_set_overdue_days(_days int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  IF _days < 1 OR _days > 90 THEN RAISE EXCEPTION 'Choose 1 to 90 days'; END IF;
  INSERT INTO platform_settings(key, value) VALUES ('crm_overdue_days', jsonb_build_object('days', _days))
  ON CONFLICT (key) DO UPDATE SET value=excluded.value, updated_at=now();
  INSERT INTO audit_logs(actor_id, action, target, details) VALUES (auth.uid(), 'settings.crm_overdue_days', 'platform_settings', jsonb_build_object('days', _days));
END $$;

REVOKE ALL ON FUNCTION public.crm_dashboard(), public.crm_finance_summary(), public.crm_refresh_alerts(), public.crm_ack_alert(uuid,text), public.crm_set_overdue_days(int), public.crm_overdue_days() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_dashboard(), public.crm_finance_summary(), public.crm_refresh_alerts(), public.crm_ack_alert(uuid,text), public.crm_set_overdue_days(int), public.crm_overdue_days() TO authenticated;