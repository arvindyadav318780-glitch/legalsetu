CREATE OR REPLACE FUNCTION public.crm_client_detail(_uid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d int := public.crm_overdue_days();
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id=_uid) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'profile', (SELECT jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'phone',p.phone,'city',p.city,'state',p.state,'created_at',p.created_at,'suspended',p.suspended,'suspended_reason',p.suspended_reason,
        'roles',(SELECT jsonb_agg(role) FROM user_roles WHERE user_id=p.id),'restricted',public.has_active_restriction(p.id)) FROM profiles p WHERE p.id=_uid),
    'overdue_days', d,
    'last_activity', (SELECT max(t) FROM (
        SELECT max(created_at) t FROM service_requests WHERE customer_id=_uid UNION ALL
        SELECT max(created_at) FROM conversation_messages WHERE sender_id=_uid UNION ALL
        SELECT max(created_at) FROM messages WHERE sender_id=_uid UNION ALL
        SELECT max(created_at) FROM support_tickets WHERE user_id=_uid UNION ALL
        SELECT max(created_at) FROM consents WHERE user_id=_uid) x),
    'requests', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'service_name',r.service_name,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
        'professional_id',r.assigned_professional_id,'pro_name',pp.display_name,'accepted_at',r.assignment_accepted_at,
        'overdue', r.status::text NOT IN ('completed','cancelled','closed') AND r.updated_at < now()-make_interval(days=>d)) ORDER BY r.created_at DESC),'[]')
      FROM service_requests r LEFT JOIN professional_profiles pp ON pp.user_id=r.assigned_professional_id WHERE r.customer_id=_uid),
    'contacts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'status',c.status,'created_at',c.created_at,'decided_at',c.decided_at,'professional_id',c.professional_id,'pro_name',pp.display_name,
        'conversation_id',cv.id,'closed',cv.closed,'message_count',(SELECT count(*) FROM conversation_messages m WHERE m.conversation_id=cv.id),
        'last_message_at',(SELECT max(created_at) FROM conversation_messages m WHERE m.conversation_id=cv.id)) ORDER BY c.created_at DESC),'[]')
      FROM contact_requests c LEFT JOIN conversations cv ON cv.contact_request_id=c.id LEFT JOIN professional_profiles pp ON pp.user_id=c.professional_id WHERE c.client_id=_uid),
    'payments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'request_id',p.request_id,'reference',sr.reference,'description',p.description,'total_paise',p.total_paise,'refunded_paise',p.refunded_paise,'status',p.status,'test_mode',p.test_mode,'invoice_number',p.invoice_number,'created_at',p.created_at) ORDER BY p.created_at DESC),'[]')
      FROM payments p LEFT JOIN service_requests sr ON sr.id=p.request_id WHERE p.customer_id=_uid),
    'invoices', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'description',description,'amount_paise',amount_paise,'status',status,'test_mode',test_mode,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM invoices WHERE user_id=_uid),
    'tickets', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'subject',subject,'kind',kind,'status',status,'request_id',request_id,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM support_tickets WHERE user_id=_uid),
    'reports_made', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'reason_code',reason_code,'status',status,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM abuse_reports WHERE reporter_id=_uid),
    'reports_about', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'reason_code',reason_code,'status',status,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM abuse_reports WHERE target_user_id=_uid),
    'restrictions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'starts_at',starts_at,'ends_at',ends_at,'lifted_at',lifted_at) ORDER BY created_at DESC),'[]') FROM account_restrictions WHERE user_id=_uid),
    'appeals', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'subject',subject,'status',status,'created_at',created_at,'decided_at',decided_at) ORDER BY created_at DESC),'[]') FROM appeals WHERE user_id=_uid),
    'history', (SELECT COALESCE(jsonb_agg(jsonb_build_object('at',h.created_at,'reference',r.reference,'request_id',r.id,'status',h.status) ORDER BY h.created_at DESC),'[]') FROM request_status_history h JOIN service_requests r ON r.id=h.request_id WHERE r.customer_id=_uid)
  );
END $$;

CREATE OR REPLACE FUNCTION public.crm_pro_detail(_uid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d int := public.crm_overdue_days();
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM professional_profiles WHERE user_id=_uid) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'profile', (SELECT to_jsonb(pp) - 'photo_path' || jsonb_build_object('email',p.email,'phone',p.phone,'account_suspended',p.suspended,'restricted',public.has_active_restriction(pp.user_id),
        'roles',(SELECT jsonb_agg(role) FROM user_roles WHERE user_id=pp.user_id)) FROM professional_profiles pp LEFT JOIN profiles p ON p.id=pp.user_id WHERE pp.user_id=_uid),
    'overdue_days', d,
    'last_activity', (SELECT max(t) FROM (
        SELECT max(updated_at) t FROM professional_profiles WHERE user_id=_uid UNION ALL
        SELECT max(created_at) FROM conversation_messages WHERE sender_id=_uid UNION ALL
        SELECT max(created_at) FROM messages WHERE sender_id=_uid UNION ALL
        SELECT max(decided_at) FROM contact_requests WHERE professional_id=_uid UNION ALL
        SELECT max(assignment_accepted_at) FROM service_requests WHERE assigned_professional_id=_uid) x),
    'requests', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',r.id,'reference',r.reference,'service_name',r.service_name,'status',r.status,'created_at',r.created_at,'updated_at',r.updated_at,
        'client_id',r.customer_id,'client_name',cp.full_name,'accepted_at',r.assignment_accepted_at,
        'completed_at',(SELECT min(created_at) FROM request_status_history h WHERE h.request_id=r.id AND h.status='completed'),
        'overdue', r.status::text NOT IN ('completed','cancelled','closed') AND r.updated_at < now()-make_interval(days=>d)) ORDER BY r.created_at DESC),'[]')
      FROM service_requests r LEFT JOIN profiles cp ON cp.id=r.customer_id WHERE r.assigned_professional_id=_uid),
    'contacts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'status',c.status,'initiated_by',c.initiated_by,'created_at',c.created_at,'decided_at',c.decided_at,'client_id',c.client_id,'client_name',cp.full_name,
        'conversation_id',cv.id,'closed',cv.closed,'message_count',(SELECT count(*) FROM conversation_messages m WHERE m.conversation_id=cv.id)) ORDER BY c.created_at DESC),'[]')
      FROM contact_requests c LEFT JOIN conversations cv ON cv.contact_request_id=c.id LEFT JOIN profiles cp ON cp.id=c.client_id WHERE c.professional_id=_uid),
    'credential_checks', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'method',method,'checked_on',checked_on,'reference',reference,'outcome',outcome,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM credential_checks WHERE professional_id=_uid),
    'verification', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'from_status',from_status,'to_status',to_status,'note',note,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM verification_reviews WHERE professional_id=_uid),
    'payments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'request_id',p.request_id,'reference',sr.reference,'description',p.description,'total_paise',p.total_paise,'refunded_paise',p.refunded_paise,'status',p.status,'test_mode',p.test_mode,'created_at',p.created_at) ORDER BY p.created_at DESC),'[]')
      FROM payments p LEFT JOIN service_requests sr ON sr.id=p.request_id WHERE p.professional_id=_uid OR sr.assigned_professional_id=_uid),
    'orders', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'credits',credits,'amount_paise',amount_paise,'status',status,'test_mode',test_mode,'provider_payment_id',provider_payment_id,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM credit_orders WHERE professional_id=_uid),
    'ledger', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'delta',delta,'kind',kind,'price_paise',price_paise,'note',note,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM credit_ledger WHERE professional_id=_uid),
    'credit_balance', public.credit_balance(_uid),
    'reports_about', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'reason_code',reason_code,'status',status,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM abuse_reports WHERE target_user_id=_uid),
    'complaints', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'subject',t.subject,'kind',t.kind,'status',t.status,'created_at',t.created_at) ORDER BY t.created_at DESC),'[]')
      FROM support_tickets t JOIN service_requests r ON r.id=t.request_id WHERE r.assigned_professional_id=_uid AND t.kind IN ('complaint','profile_report')),
    'reviews', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'rating',rating,'status',status,'created_at',created_at) ORDER BY created_at DESC),'[]') FROM reviews WHERE professional_id=_uid),
    'restrictions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'starts_at',starts_at,'ends_at',ends_at,'lifted_at',lifted_at) ORDER BY created_at DESC),'[]') FROM account_restrictions WHERE user_id=_uid),
    'appeals', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'subject',subject,'status',status,'created_at',created_at,'decided_at',decided_at) ORDER BY created_at DESC),'[]') FROM appeals WHERE user_id=_uid)
  );
END $$;

REVOKE ALL ON FUNCTION public.crm_client_detail(uuid), public.crm_pro_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_client_detail(uuid), public.crm_pro_detail(uuid) TO authenticated;