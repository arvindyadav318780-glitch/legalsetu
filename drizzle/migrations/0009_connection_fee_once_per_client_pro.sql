ALTER TABLE public.marketplace_settings ALTER COLUMN contact_price_paise SET DEFAULT 9900;
COMMENT ON COLUMN public.marketplace_settings.contact_price_paise IS 'Platform fee per unique client-professional connection, charged to the professional (proposed, gated by legal review).';

CREATE OR REPLACE FUNCTION public.accept_contact_request(_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare cr record; conv uuid; need boolean; bal int; price int; recipient uuid; conn text;
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
  -- One fee per unique client-professional connection, whatever the request.
  conn := cr.client_id::text || ':' || cr.professional_id::text || ':';
  if need and not exists (
    select 1 from public.credit_ledger l where l.professional_id=cr.professional_id and l.kind='consume'
      and left(l.pair_key, length(conn)) = conn
      and not exists (select 1 from public.credit_ledger r where r.reverses_id = l.id)
  ) then
    select coalesce(sum(delta),0) into bal from public.credit_ledger where professional_id=cr.professional_id;
    if bal < 1 then raise exception 'Not enough connection credits. Buy credits to accept this new client.'; end if;
    select contact_price_paise into price from public.marketplace_settings where id=1;
    insert into public.credit_ledger(professional_id, delta, kind, price_paise, contact_request_id, pair_key, note, created_by)
      values (cr.professional_id, -1, 'consume', coalesce(price,0), _id, cr.pair_key, 'New unique client connected, conversation opened', auth.uid());
  end if;
  update public.contact_requests set status='accepted', decided_at=now() where id=_id;
  insert into public.notifications(user_id, title, body, link)
    values (case when recipient = cr.client_id then cr.professional_id else cr.client_id end, 'Contact request accepted', 'Your contact request was accepted. You can now message each other.',
            case when recipient = cr.client_id then '/pro/messages' else '/dashboard/messages' end);
  return conv;
end $function$;