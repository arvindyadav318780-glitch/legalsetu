
-- Profile extensions
ALTER TABLE public.professional_profiles
  ADD COLUMN IF NOT EXISTS membership_number text,
  ADD COLUMN IF NOT EXISTS availability text,
  ADD COLUMN IF NOT EXISTS fee_from_paise integer,
  ADD COLUMN IF NOT EXISTS fee_to_paise integer;

-- Settings (single row)
CREATE TABLE public.marketplace_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contact_price_paise integer NOT NULL DEFAULT 2000 CHECK (contact_price_paise >= 0),
  credits_enabled_ca boolean NOT NULL DEFAULT false,
  credits_enabled_advocate boolean NOT NULL DEFAULT false,
  pro_initiate_ca boolean NOT NULL DEFAULT false,
  pro_initiate_advocate boolean NOT NULL DEFAULT false,
  legal_review_note text,
  legal_review_completed_at date,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.marketplace_settings TO authenticated;
GRANT ALL ON public.marketplace_settings TO service_role;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms read" ON public.marketplace_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ms admin update" ON public.marketplace_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.marketplace_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_marketplace_settings() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  new.updated_at := now(); new.updated_by := auth.uid();
  if (new.credits_enabled_ca and not old.credits_enabled_ca) or (new.credits_enabled_advocate and not old.credits_enabled_advocate)
     or (new.pro_initiate_ca and not old.pro_initiate_ca) or (new.pro_initiate_advocate and not old.pro_initiate_advocate) then
    if new.legal_review_completed_at is null or length(coalesce(trim(new.legal_review_note),'')) < 20 then
      raise exception 'Record the completed legal review (date and a note of at least 20 characters) before enabling paid or professional-initiated contact';
    end if;
  end if;
  return new;
end $$;
CREATE TRIGGER guard_marketplace_settings BEFORE UPDATE ON public.marketplace_settings FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_settings();
CREATE TRIGGER audit_marketplace_settings AFTER UPDATE ON public.marketplace_settings FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

-- Blocks
CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL, blocked_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id), CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks own read" ON public.user_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "blocks own insert" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "blocks own delete" ON public.user_blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_blocked_pair(_a uuid, _b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.user_blocks where (blocker_id=_a and blocked_id=_b) or (blocker_id=_b and blocked_id=_a))
$$;

-- Risk alerts
CREATE TABLE public.risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, kind text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  reviewed_by uuid, review_note text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.risk_alerts TO authenticated;
GRANT ALL ON public.risk_alerts TO service_role;
ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts staff read" ON public.risk_alerts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "alerts staff update" ON public.risk_alerts FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER audit_risk_alerts AFTER UPDATE ON public.risk_alerts FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

CREATE OR REPLACE FUNCTION public.raise_alert(_uid uuid, _kind text, _details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not exists (select 1 from public.risk_alerts where user_id=_uid and kind=_kind and status in ('open','reviewing') and created_at > now() - interval '1 day') then
    insert into public.risk_alerts(user_id, kind, details) values (_uid, _kind, coalesce(_details,'{}'::jsonb));
  end if;
end $$;
REVOKE EXECUTE ON FUNCTION public.raise_alert(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;

-- Contact requests
CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  request_id uuid REFERENCES public.service_requests(id),
  pair_key text NOT NULL DEFAULT '',
  message text NOT NULL CHECK (length(message) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn','failed')),
  decline_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (client_id <> professional_id)
);
CREATE UNIQUE INDEX contact_requests_active_pair ON public.contact_requests(pair_key) WHERE status IN ('pending','accepted');
CREATE INDEX contact_requests_pro ON public.contact_requests(professional_id, status);
CREATE INDEX contact_requests_client ON public.contact_requests(client_id, created_at);
GRANT SELECT, INSERT ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr parties read" ON public.contact_requests FOR SELECT TO authenticated USING (client_id = auth.uid() OR professional_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "cr client insert" ON public.contact_requests FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_contact_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n int; declines int;
begin
  if new.client_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  new.status := 'pending'; new.decided_at := null; new.decline_reason := null; new.created_at := now();
  new.pair_key := new.client_id::text || ':' || new.professional_id::text || ':' || coalesce(new.request_id::text,'none');
  if public.is_suspended(new.client_id) then raise exception 'Your account is suspended'; end if;
  if not exists (select 1 from public.professional_profiles where user_id = new.professional_id and is_listed and verification_status='approved' and not suspended) then
    raise exception 'This professional is not available for contact';
  end if;
  if public.is_blocked_pair(new.client_id, new.professional_id) then raise exception 'Contact is not possible between these accounts'; end if;
  if new.request_id is not null and not exists (select 1 from public.service_requests where id=new.request_id and customer_id=new.client_id) then
    raise exception 'Request not found';
  end if;
  select count(*) into n from public.contact_requests where client_id=new.client_id and created_at > now() - interval '1 day';
  if n >= 5 then raise exception 'Daily limit reached: you can send up to 5 contact requests per day'; end if;
  select count(*) into declines from public.contact_requests where client_id=new.client_id and status='declined' and decided_at > now() - interval '7 days';
  if declines >= 3 then perform public.raise_alert(new.client_id, 'many_declined_contacts', jsonb_build_object('declined_7d', declines)); end if;
  return new;
end $$;
CREATE TRIGGER guard_contact_request BEFORE INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.guard_contact_request();

-- Conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id uuid NOT NULL UNIQUE REFERENCES public.contact_requests(id),
  client_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id),
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conv_msgs_conv ON public.conversation_messages(conversation_id, created_at);
CREATE INDEX conv_msgs_sender ON public.conversation_messages(sender_id, created_at);
GRANT SELECT, INSERT ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Abuse reports
CREATE TABLE public.abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id),
  reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','actioned','dismissed')),
  reviewed_by uuid, review_note text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id <> target_user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.abuse_reports TO authenticated;
GRANT ALL ON public.abuse_reports TO service_role;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports read" ON public.abuse_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "reports insert" ON public.abuse_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND (conversation_id IS NULL OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.client_id = auth.uid() OR c.professional_id = auth.uid()))));
CREATE POLICY "reports staff update" ON public.abuse_reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER audit_abuse_reports AFTER UPDATE ON public.abuse_reports FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

CREATE OR REPLACE FUNCTION public.guard_abuse_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n int;
begin
  new.status := 'open'; new.reviewed_by := null; new.review_note := null; new.reviewed_at := null; new.created_at := now();
  select count(*) into n from public.abuse_reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Too many reports today'; end if;
  select count(distinct reporter_id) into n from public.abuse_reports where target_user_id = new.target_user_id and created_at > now() - interval '30 days';
  if n + 1 >= 3 then perform public.raise_alert(new.target_user_id, 'repeated_reports', jsonb_build_object('reporters_30d', n + 1)); end if;
  return new;
end $$;
CREATE TRIGGER guard_abuse_report BEFORE INSERT ON public.abuse_reports FOR EACH ROW EXECUTE FUNCTION public.guard_abuse_report();

-- Conversation policies (staff only on reported conversations)
CREATE POLICY "conv parties read" ON public.conversations FOR SELECT TO authenticated USING (
  client_id = auth.uid() OR professional_id = auth.uid()
  OR (public.is_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.abuse_reports r WHERE r.conversation_id = conversations.id)));

CREATE OR REPLACE FUNCTION public.is_conversation_party(_cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.conversations where id=_cid and (client_id=auth.uid() or professional_id=auth.uid()))
$$;
CREATE OR REPLACE FUNCTION public.staff_can_read_conversation(_cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.is_staff(auth.uid()) and exists(select 1 from public.abuse_reports where conversation_id=_cid)
$$;
CREATE POLICY "msgs read" ON public.conversation_messages FOR SELECT TO authenticated USING (public.is_conversation_party(conversation_id) OR public.staff_can_read_conversation(conversation_id));
CREATE POLICY "msgs insert" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_conversation_party(conversation_id));

CREATE OR REPLACE FUNCTION public.guard_conversation_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c record; per_min int; per_day int;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c is null or new.sender_id not in (c.client_id, c.professional_id) or new.sender_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  if c.closed then raise exception 'This conversation is closed'; end if;
  if public.is_suspended(new.sender_id) or exists(select 1 from public.professional_profiles where user_id=new.sender_id and suspended) then raise exception 'Your account is suspended'; end if;
  if public.is_blocked_pair(c.client_id, c.professional_id) then raise exception 'Messaging is blocked for this conversation'; end if;
  new.created_at := now(); new.body := trim(new.body);
  select count(*) into per_min from public.conversation_messages where sender_id=new.sender_id and created_at > now() - interval '1 minute';
  if per_min >= 20 then raise exception 'You are sending messages too quickly. Please wait a minute.'; end if;
  if per_min = 15 then perform public.raise_alert(new.sender_id, 'message_burst', jsonb_build_object('per_minute', per_min)); end if;
  select count(*) into per_day from public.conversation_messages where sender_id=new.sender_id and created_at > now() - interval '1 day';
  if per_day >= 300 then raise exception 'Daily message limit reached (300)'; end if;
  return new;
end $$;
CREATE TRIGGER guard_conversation_message BEFORE INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_message();

-- Credit orders & ledger
CREATE TABLE public.credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 500),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','initiated','successful','failed','cancelled','refunded')),
  provider_order_id text UNIQUE,
  provider_payment_id text,
  failure_reason text,
  test_mode boolean NOT NULL DEFAULT true,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_orders TO authenticated;
GRANT ALL ON public.credit_orders TO service_role;
ALTER TABLE public.credit_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders own read" ON public.credit_orders FOR SELECT TO authenticated USING (professional_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  delta integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('purchase','consume','refund','adjustment')),
  price_paise integer NOT NULL DEFAULT 0,
  contact_request_id uuid REFERENCES public.contact_requests(id),
  pair_key text,
  order_id uuid REFERENCES public.credit_orders(id),
  reverses_id uuid REFERENCES public.credit_ledger(id),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX credit_ledger_one_consume_per_pair ON public.credit_ledger(pair_key) WHERE kind = 'consume';
CREATE UNIQUE INDEX credit_ledger_one_purchase_per_order ON public.credit_ledger(order_id) WHERE kind = 'purchase';
CREATE UNIQUE INDEX credit_ledger_one_reversal ON public.credit_ledger(reverses_id) WHERE reverses_id IS NOT NULL;
CREATE INDEX credit_ledger_pro ON public.credit_ledger(professional_id, created_at);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger own read" ON public.credit_ledger FOR SELECT TO authenticated USING (professional_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.ledger_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin raise exception 'The credit ledger is append-only'; end $$;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON public.credit_ledger FOR EACH ROW EXECUTE FUNCTION public.ledger_append_only();

CREATE OR REPLACE FUNCTION public.audit_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.audit_logs(actor_id, action, target, details)
  values (auth.uid(), 'credit_ledger.' || new.kind, 'credit_ledger:' || new.id, to_jsonb(new));
  return new;
end $$;
CREATE TRIGGER audit_ledger AFTER INSERT ON public.credit_ledger FOR EACH ROW EXECUTE FUNCTION public.audit_ledger();
REVOKE EXECUTE ON FUNCTION public.audit_ledger() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_balance(_uid uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select case when _uid = auth.uid() or public.is_staff(auth.uid()) or auth.uid() is null
    then coalesce((select sum(delta)::int from public.credit_ledger where professional_id=_uid), 0) else null end
$$;
REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.credits_required_for(_pro uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((select case p.category when 'Chartered Accountant' then s.credits_enabled_ca when 'Advocate' then s.credits_enabled_advocate else false end
    from public.professional_profiles p, public.marketplace_settings s where p.user_id=_pro and s.id=1), false)
$$;

-- Accept: one atomic step
CREATE OR REPLACE FUNCTION public.accept_contact_request(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cr record; conv uuid; need boolean; bal int; price int;
begin
  select * into cr from public.contact_requests where id=_id for update;
  if cr is null or cr.professional_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  if cr.status = 'accepted' then return (select id from public.conversations where contact_request_id=_id); end if;
  if cr.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
  if public.is_suspended(cr.professional_id) or exists(select 1 from public.professional_profiles where user_id=cr.professional_id and suspended) then raise exception 'Your account is suspended'; end if;
  if public.is_suspended(cr.client_id) or public.is_blocked_pair(cr.client_id, cr.professional_id) then raise exception 'Contact is no longer possible'; end if;
  need := public.credits_required_for(cr.professional_id);
  perform pg_advisory_xact_lock(hashtext('credits:' || cr.professional_id::text));
  insert into public.conversations(contact_request_id, client_id, professional_id) values (_id, cr.client_id, cr.professional_id)
    on conflict (contact_request_id) do nothing returning id into conv;
  if conv is null then return (select id from public.conversations where contact_request_id=_id); end if;
  if need and not exists (select 1 from public.credit_ledger where pair_key=cr.pair_key and kind='consume') then
    select coalesce(sum(delta),0) into bal from public.credit_ledger where professional_id=cr.professional_id;
    if bal < 1 then raise exception 'Not enough contact credits. Buy credits to accept this request.'; end if;
    select contact_price_paise into price from public.marketplace_settings where id=1;
    insert into public.credit_ledger(professional_id, delta, kind, price_paise, contact_request_id, pair_key, note, created_by)
      values (cr.professional_id, -1, 'consume', coalesce(price,0), _id, cr.pair_key, 'Contact accepted, conversation created', auth.uid());
  end if;
  update public.contact_requests set status='accepted', decided_at=now() where id=_id;
  insert into public.notifications(user_id, title, body, link) values (cr.client_id, 'Contact request accepted', 'A professional accepted your request. You can now message them.', '/dashboard/messages');
  return conv;
end $$;
REVOKE EXECUTE ON FUNCTION public.accept_contact_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_contact_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_contact_request(_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cr record;
begin
  select * into cr from public.contact_requests where id=_id for update;
  if cr is null then raise exception 'Not allowed'; end if;
  if cr.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
  if cr.professional_id = auth.uid() then
    update public.contact_requests set status='declined', decided_at=now(), decline_reason=left(_reason, 500) where id=_id;
    insert into public.notifications(user_id, title, body, link) values (cr.client_id, 'Contact request declined', 'The professional could not take this request. No charge applies.', '/dashboard/messages');
  elsif cr.client_id = auth.uid() then
    update public.contact_requests set status='withdrawn', decided_at=now() where id=_id;
  else raise exception 'Not allowed'; end if;
end $$;
REVOKE EXECUTE ON FUNCTION public.decline_contact_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_contact_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reverse_credit(_ledger_id uuid, _note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare l record; nid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can refund credits'; end if;
  if length(coalesce(trim(_note),'')) < 5 then raise exception 'Add a note of at least 5 characters'; end if;
  select * into l from public.credit_ledger where id=_ledger_id;
  if l is null or l.kind <> 'consume' then raise exception 'Only consumed credits can be refunded'; end if;
  insert into public.credit_ledger(professional_id, delta, kind, price_paise, reverses_id, note, created_by)
    values (l.professional_id, -l.delta, 'refund', l.price_paise, l.id, left(_note, 500), auth.uid()) returning id into nid;
  return nid;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_reverse_credit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reverse_credit(uuid, text) TO authenticated;

-- Grant credits for a verified, paid order (server/service role only). Idempotent.
CREATE OR REPLACE FUNCTION public.grant_order_credits(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare o record; nid uuid;
begin
  select * into o from public.credit_orders where id=_order_id for update;
  if o is null or o.status <> 'successful' then return false; end if;
  insert into public.credit_ledger(professional_id, delta, kind, price_paise, order_id, note)
    values (o.professional_id, o.credits, 'purchase', o.amount_paise, o.id, '[TEST MODE] credit pack purchase')
    on conflict do nothing returning id into nid;
  return nid is not null;
end $$;
REVOKE EXECUTE ON FUNCTION public.grant_order_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_order_credits(uuid) TO service_role;

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  conversation_id uuid UNIQUE REFERENCES public.conversations(id),
  request_id uuid UNIQUE REFERENCES public.service_requests(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text CHECK (body IS NULL OR length(body) <= 2000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  moderation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((conversation_id IS NULL) <> (request_id IS NULL))
);
GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'published' OR client_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "reviews client insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "reviews staff moderate" ON public.reviews FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER audit_reviews AFTER UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

CREATE OR REPLACE FUNCTION public.guard_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n int;
begin
  if tg_op = 'UPDATE' then
    if new.client_id <> old.client_id or new.professional_id <> old.professional_id or new.rating <> old.rating or new.body is distinct from old.body
       or new.conversation_id is distinct from old.conversation_id or new.request_id is distinct from old.request_id then
      raise exception 'Reviews can only be moderated, not edited';
    end if;
    return new;
  end if;
  if new.client_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  new.status := 'published'; new.moderation_note := null; new.created_at := now();
  if new.conversation_id is not null then
    if not exists (select 1 from public.conversations c where c.id=new.conversation_id and c.client_id=new.client_id and c.professional_id=new.professional_id
       and exists (select 1 from public.conversation_messages m where m.conversation_id=c.id and m.sender_id=c.professional_id)) then
      raise exception 'You can review only after a real conversation in which the professional replied';
    end if;
  else
    if not exists (select 1 from public.service_requests r where r.id=new.request_id and r.customer_id=new.client_id and r.assigned_professional_id=new.professional_id and r.status in ('completed','closed')) then
      raise exception 'You can review only a completed request handled by this professional';
    end if;
  end if;
  select count(*) into n from public.reviews where client_id=new.client_id and created_at > now() - interval '1 day';
  if n >= 3 then perform public.raise_alert(new.client_id, 'review_burst', jsonb_build_object('reviews_24h', n + 1)); end if;
  return new;
end $$;
CREATE TRIGGER guard_review BEFORE INSERT OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.guard_review();

CREATE OR REPLACE FUNCTION public.pro_public_stats(_pro uuid) RETURNS TABLE(avg_rating numeric, review_count integer, interaction_count integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select (select round(avg(rating)::numeric, 1) from public.reviews where professional_id=_pro and status='published'),
         (select count(*)::int from public.reviews where professional_id=_pro and status='published'),
         ((select count(*) from public.conversations where professional_id=_pro) + (select count(*) from public.service_requests where assigned_professional_id=_pro and status in ('completed','closed')))::int
  where exists (select 1 from public.professional_profiles where user_id=_pro and is_listed)
$$;
GRANT EXECUTE ON FUNCTION public.pro_public_stats(uuid) TO anon, authenticated;

-- Appeals
CREATE TABLE public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL CHECK (length(subject) BETWEEN 3 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 20 AND 4000),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','upheld','rejected')),
  decision_note text, decided_by uuid, decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.appeals TO authenticated;
GRANT ALL ON public.appeals TO service_role;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appeals read" ON public.appeals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appeals insert" ON public.appeals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "appeals staff decide" ON public.appeals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.guard_appeal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if tg_op = 'INSERT' then
    new.status := 'submitted'; new.decision_note := null; new.decided_by := null; new.decided_at := null; new.created_at := now();
    if (select count(*) from public.appeals where user_id=new.user_id and status in ('submitted','under_review')) >= 2 then raise exception 'You already have open appeals'; end if;
  else
    if new.user_id <> old.user_id or new.body <> old.body or new.subject <> old.subject then raise exception 'Appeal text cannot be changed'; end if;
    if new.status in ('upheld','rejected') then
      if length(coalesce(trim(new.decision_note),'')) < 5 then raise exception 'Add a decision note'; end if;
      new.decided_by := auth.uid(); new.decided_at := now();
      insert into public.notifications(user_id, title, body, link) values (new.user_id, 'Appeal decided', 'Your appeal was ' || new.status || '.', '/dashboard/support');
    end if;
  end if;
  return new;
end $$;
CREATE TRIGGER guard_appeal BEFORE INSERT OR UPDATE ON public.appeals FOR EACH ROW EXECUTE FUNCTION public.guard_appeal();
CREATE TRIGGER audit_appeals AFTER UPDATE ON public.appeals FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

REVOKE EXECUTE ON FUNCTION public.guard_contact_request(), public.guard_conversation_message(), public.guard_abuse_report(), public.guard_review(), public.guard_appeal(), public.ledger_append_only(), public.guard_marketplace_settings() FROM PUBLIC, anon, authenticated;
