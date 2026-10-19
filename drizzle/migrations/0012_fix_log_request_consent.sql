CREATE OR REPLACE FUNCTION public.log_request_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.contact_consent_at is not null then
    insert into public.consents(user_id, request_id, purpose, version, action, created_at)
      values (new.customer_id, new.id, 'share_contact_with_assigned_professional', 'v1-2026-10', 'granted', new.contact_consent_at);
  end if;
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.log_request_consent() FROM anon, public, authenticated;