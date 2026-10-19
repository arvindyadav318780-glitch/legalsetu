
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS cop_number text;
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'client' CHECK (initiated_by IN ('client','professional'));
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS created_by uuid;
DROP POLICY IF EXISTS "cr client insert" ON public.contact_requests;
CREATE POLICY "cr party insert" ON public.contact_requests FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid() OR professional_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_contact_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare n int; declines int; cat text; s record;
begin
  new.status := 'pending'; new.decided_at := null; new.decline_reason := null; new.created_at := now(); new.created_by := auth.uid();
  new.pair_key := new.client_id::text || ':' || new.professional_id::text || ':' || coalesce(new.request_id::text,'none');
  if not exists (select 1 from public.professional_profiles where user_id = new.professional_id and is_listed and verification_status='approved' and not suspended) then
    raise exception 'This professional is not available for contact';
  end if;
  if public.is_blocked_pair(new.client_id, new.professional_id) then raise exception 'Contact is not possible between these accounts'; end if;
  if new.initiated_by = 'professional' then
    if new.professional_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
    select category into cat from public.professional_profiles where user_id = new.professional_id;
    select * into s from public.marketplace_settings where id = 1;
    if not ((cat = 'Chartered Accountant' and s.pro_initiate_ca) or (cat = 'Advocate' and s.pro_initiate_advocate)) then
      raise exception 'Professional-initiated contact is not enabled (pending legal review)';
    end if;
    if public.is_suspended(new.client_id) or not exists (select 1 from public.profiles where id = new.client_id) then raise exception 'Client not available'; end if;
    if new.request_id is not null and not exists (select 1 from public.service_requests where id=new.request_id and customer_id=new.client_id) then raise exception 'Request not found'; end if;
    select count(*) into n from public.contact_requests where professional_id=new.professional_id and initiated_by='professional' and created_at > now() - interval '1 day';
    if n >= 5 then raise exception 'Daily limit reached: up to 5 outgoing contact requests per day'; end if;
    return new;
  end if;
  new.initiated_by := 'client';
  if new.client_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  if public.is_suspended(new.client_id) then raise exception 'Your account is suspended'; end if;
  if new.request_id is not null and not exists (select 1 from public.service_requests where id=new.request_id and customer_id=new.client_id) then raise exception 'Request not found'; end if;
  select count(*) into n from public.contact_requests where client_id=new.client_id and initiated_by='client' and created_at > now() - interval '1 day';
  if n >= 5 then raise exception 'Daily limit reached: you can send up to 5 contact requests per day'; end if;
  select count(*) into declines from public.contact_requests where client_id=new.client_id and status='declined' and decided_at > now() - interval '7 days';
  if declines >= 3 then perform public.raise_alert(new.client_id, 'many_declined_contacts', jsonb_build_object('declined_7d', declines)); end if;
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.guard_contact_request() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_contact_request(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cr record; conv uuid; need boolean; bal int; price int; recipient uuid;
begin
  select * into cr from public.contact_requests where id=_id for update;
  if cr is null then raise exception 'Not allowed'; end if;
  recipient := case when cr.initiated_by = 'professional' then cr.client_id else cr.professional_id end;
  if recipient is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  if cr.status = 'accepted' then return (select id from public.conversations where contact_request_id=_id); end if;
  if cr.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
  if public.is_suspended(cr.professional_id) or exists(select 1 from public.professional_profiles where user_id=cr.professional_id and suspended) then raise exception 'This professional account is suspended'; end if;
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
  insert into public.notifications(user_id, title, body, link)
    values (case when recipient = cr.client_id then cr.professional_id else cr.client_id end, 'Contact request accepted', 'Your contact request was accepted. You can now message each other.',
            case when recipient = cr.client_id then '/pro/messages' else '/dashboard/messages' end);
  return conv;
end $$;

CREATE OR REPLACE FUNCTION public.decline_contact_request(_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cr record; recipient uuid;
begin
  select * into cr from public.contact_requests where id=_id for update;
  if cr is null then raise exception 'Not allowed'; end if;
  if cr.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
  recipient := case when cr.initiated_by = 'professional' then cr.client_id else cr.professional_id end;
  if recipient = auth.uid() then
    update public.contact_requests set status='declined', decided_at=now(), decline_reason=left(_reason, 500) where id=_id;
    insert into public.notifications(user_id, title, body, link) values (case when recipient = cr.client_id then cr.professional_id else cr.client_id end, 'Contact request declined', 'The request was declined. No charge applies.', case when recipient = cr.client_id then '/pro/messages' else '/dashboard/messages' end);
  elsif auth.uid() in (cr.client_id, cr.professional_id) then
    update public.contact_requests set status='withdrawn', decided_at=now() where id=_id;
  else raise exception 'Not allowed'; end if;
end $$;

-- Admin credit adjustments
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_pro uuid, _delta integer, _reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare bal int; nid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can adjust credits'; end if;
  if _delta = 0 or abs(_delta) > 500 then raise exception 'Adjustment must be between -500 and 500 and not zero'; end if;
  if length(coalesce(trim(_reason),'')) < 10 then raise exception 'Give a reason of at least 10 characters'; end if;
  if not exists (select 1 from public.professional_profiles where user_id=_pro) then raise exception 'Professional not found'; end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || _pro::text));
  select coalesce(sum(delta),0) into bal from public.credit_ledger where professional_id=_pro;
  if bal + _delta < 0 then raise exception 'Balance cannot go below zero'; end if;
  insert into public.credit_ledger(professional_id, delta, kind, note, created_by) values (_pro, _delta, 'adjustment', left(_reason, 500), auth.uid()) returning id into nid;
  return nid;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO authenticated;

-- Credit-pack refunds
ALTER TABLE public.credit_ledger ADD COLUMN IF NOT EXISTS refund_id uuid;
CREATE TABLE public.credit_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.credit_orders(id),
  professional_id uuid NOT NULL,
  credits_reversed integer NOT NULL,
  amount_paise integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','failed')),
  provider_refund_id text UNIQUE,
  failure_reason text,
  reviewer_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE UNIQUE INDEX credit_refunds_one_active ON public.credit_refunds(order_id) WHERE status IN ('pending','processed');
CREATE UNIQUE INDEX credit_ledger_refund_once ON public.credit_ledger(refund_id, (delta > 0)) WHERE refund_id IS NOT NULL;
GRANT SELECT ON public.credit_refunds TO authenticated;
GRANT ALL ON public.credit_refunds TO service_role;
ALTER TABLE public.credit_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crefund read" ON public.credit_refunds FOR SELECT TO authenticated USING (professional_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER audit_credit_refunds AFTER INSERT OR UPDATE ON public.credit_refunds FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

CREATE OR REPLACE FUNCTION public.start_credit_refund(_order uuid, _note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare o record; bal int; rid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins can refund credit packs'; end if;
  if length(coalesce(trim(_note),'')) < 5 then raise exception 'Add a note of at least 5 characters'; end if;
  select * into o from public.credit_orders where id=_order for update;
  if o is null or o.status <> 'successful' or o.provider_payment_id is null then raise exception 'Only verified, paid credit orders can be refunded'; end if;
  if exists (select 1 from public.credit_refunds where order_id=_order and status in ('pending','processed')) then raise exception 'A refund for this order already exists'; end if;
  perform pg_advisory_xact_lock(hashtext('credits:' || o.professional_id::text));
  select coalesce(sum(delta),0) into bal from public.credit_ledger where professional_id=o.professional_id;
  if bal < o.credits then raise exception 'Some credits from this pack were already used (balance %). Only fully unused packs can be refunded.', bal; end if;
  insert into public.credit_refunds(order_id, professional_id, credits_reversed, amount_paise, reviewer_id, note) values (_order, o.professional_id, o.credits, o.amount_paise, auth.uid(), left(_note,500)) returning id into rid;
  insert into public.credit_ledger(professional_id, delta, kind, order_id, refund_id, note, created_by) values (o.professional_id, -o.credits, 'adjustment', o.id, rid, 'Credit pack refund requested (credits held)', auth.uid());
  return rid;
end $$;
REVOKE EXECUTE ON FUNCTION public.start_credit_refund(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_credit_refund(uuid, text) TO authenticated;

-- Settled only by server code after Razorpay confirms. Idempotent.
CREATE OR REPLACE FUNCTION public.settle_credit_refund(_refund uuid, _status text, _provider_refund_id text, _reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record;
begin
  select * into r from public.credit_refunds where id=_refund for update;
  if r is null or r.status <> 'pending' then return false; end if;
  if _status = 'processed' then
    update public.credit_refunds set status='processed', provider_refund_id=coalesce(_provider_refund_id, provider_refund_id), settled_at=now() where id=_refund;
    update public.credit_orders set status='refunded' where id=r.order_id;
  elsif _status = 'failed' then
    update public.credit_refunds set status='failed', provider_refund_id=coalesce(_provider_refund_id, provider_refund_id), failure_reason=left(coalesce(_reason,'Refund failed'),300), settled_at=now() where id=_refund;
    insert into public.credit_ledger(professional_id, delta, kind, refund_id, note) values (r.professional_id, r.credits_reversed, 'adjustment', r.id, 'Credit pack refund failed — credits restored');
  else return false; end if;
  return true;
end $$;
REVOKE EXECUTE ON FUNCTION public.settle_credit_refund(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_credit_refund(uuid, text, text, text) TO service_role;

-- Retention
CREATE TABLE public.retention_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  message_retention_days integer NOT NULL DEFAULT 1095 CHECK (message_retention_days >= 180),
  closed_contact_retention_days integer NOT NULL DEFAULT 730 CHECK (closed_contact_retention_days >= 90),
  backup_note text,
  last_purge_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.retention_settings TO authenticated;
GRANT ALL ON public.retention_settings TO service_role;
ALTER TABLE public.retention_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ret staff read" ON public.retention_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "ret admin update" ON public.retention_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.retention_settings(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TRIGGER audit_retention AFTER UPDATE ON public.retention_settings FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change('id');

CREATE OR REPLACE FUNCTION public.retention_preview() RETURNS TABLE(old_messages integer, old_closed_contacts integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare s record;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins'; end if;
  select * into s from public.retention_settings where id=1;
  return query select
    (select count(*)::int from public.conversation_messages m where m.created_at < now() - make_interval(days => s.message_retention_days)
       and not exists (select 1 from public.abuse_reports r where r.conversation_id=m.conversation_id and r.status in ('open','reviewing'))),
    (select count(*)::int from public.contact_requests c where c.status in ('declined','withdrawn','failed') and coalesce(c.decided_at,c.created_at) < now() - make_interval(days => s.closed_contact_retention_days)
       and not exists (select 1 from public.credit_ledger l where l.contact_request_id=c.id) and not exists (select 1 from public.conversations v where v.contact_request_id=c.id));
end $$;
REVOKE EXECUTE ON FUNCTION public.retention_preview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retention_preview() TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired(_confirm text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare s record; m int; c int;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Only admins'; end if;
  if _confirm is distinct from 'PURGE' then raise exception 'Type PURGE to confirm'; end if;
  select * into s from public.retention_settings where id=1;
  delete from public.conversation_messages mm where mm.created_at < now() - make_interval(days => s.message_retention_days)
    and not exists (select 1 from public.abuse_reports r where r.conversation_id=mm.conversation_id and r.status in ('open','reviewing'));
  get diagnostics m = row_count;
  delete from public.contact_requests cc where cc.status in ('declined','withdrawn','failed') and coalesce(cc.decided_at,cc.created_at) < now() - make_interval(days => s.closed_contact_retention_days)
    and not exists (select 1 from public.credit_ledger l where l.contact_request_id=cc.id) and not exists (select 1 from public.conversations v where v.contact_request_id=cc.id)
    and not exists (select 1 from public.abuse_reports r where false);
  get diagnostics c = row_count;
  update public.retention_settings set last_purge_at=now() where id=1;
  insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'retention.purge', 'retention_settings:1', jsonb_build_object('messages', m, 'contact_requests', c));
  return jsonb_build_object('messages', m, 'contact_requests', c);
end $$;
REVOKE EXECUTE ON FUNCTION public.purge_expired(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired(text) TO authenticated;
