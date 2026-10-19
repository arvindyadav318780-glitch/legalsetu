ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS contact_consent_withdrawn_at timestamptz;

-- Contact email/phone are no longer readable directly; only through request_contact().
REVOKE SELECT ON public.service_requests FROM anon, authenticated;
GRANT SELECT (id, reference, customer_id, service_slug, service_name, contact_name, state, city, mode, answers, details, status,
  assigned_professional_id, next_action, terms_accepted, created_at, updated_at, assignment_accepted_at, assignment_note,
  urgency, contact_preference, contact_consent_at, contact_consent_withdrawn_at) ON public.service_requests TO authenticated;

CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid REFERENCES public.service_requests(id),
  purpose text NOT NULL,
  version text NOT NULL,
  action text NOT NULL CHECK (action IN ('granted','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent read own or staff" ON public.consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE INDEX consents_user_idx ON public.consents(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.contact_shareable(_rid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.service_requests r where r.id = _rid and (
    r.customer_id = auth.uid() or public.is_staff(auth.uid()) or (
      r.assigned_professional_id = auth.uid() and r.assignment_accepted_at is not null
      and r.contact_consent_at is not null and r.contact_consent_withdrawn_at is null)))
$$;

CREATE OR REPLACE FUNCTION public.request_contact(_rid uuid)
RETURNS TABLE(contact_email text, contact_phone text, shared boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.contact_shareable(_rid) then
    return query select null::text, null::text, false; return;
  end if;
  return query select r.contact_email, r.contact_phone, true from public.service_requests r where r.id = _rid;
end $$;

CREATE OR REPLACE FUNCTION public.set_contact_consent(_rid uuid, _grant boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record;
begin
  select * into r from public.service_requests where id = _rid for update;
  if r is null or r.customer_id is distinct from auth.uid() then raise exception 'Not allowed'; end if;
  if _grant then
    update public.service_requests set contact_consent_at = now(), contact_consent_withdrawn_at = null where id = _rid;
  else
    update public.service_requests set contact_consent_withdrawn_at = now() where id = _rid;
  end if;
  insert into public.consents(user_id, request_id, purpose, version, action)
    values (auth.uid(), _rid, 'share_contact_with_assigned_professional', 'v1-2026-10', case when _grant then 'granted' else 'withdrawn' end);
end $$;

CREATE OR REPLACE FUNCTION public.log_request_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.contact_consent_at is not null then
    insert into public.consents(user_id, request_id, purpose, version, action, created_at)
      values (new.customer_id, new.id, 'share_contact_with_assigned_professional', 'v1-2026-10', 'granted', new.contact_consent_at);
  end if;
  if new.files_consent is true then null; end if;
  return new;
exception when undefined_column then return new;
end $$;
CREATE TRIGGER trg_request_consent AFTER INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.log_request_consent();

INSERT INTO public.consents(user_id, request_id, purpose, version, action, created_at)
  SELECT customer_id, id, 'share_contact_with_assigned_professional', 'v1-2026-10', 'granted', contact_consent_at
  FROM public.service_requests WHERE contact_consent_at IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.request_contact(uuid), public.set_contact_consent(uuid, boolean), public.contact_shareable(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.request_contact(uuid), public.set_contact_consent(uuid, boolean), public.contact_shareable(uuid) TO authenticated;

-- Documents: assigned professionals only after accepting the assignment.
DROP POLICY IF EXISTS "doc read" ON public.documents;
CREATE POLICY "doc read" ON public.documents FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.service_requests r WHERE r.id = documents.request_id
      AND r.assigned_professional_id = auth.uid() AND r.assignment_accepted_at IS NOT NULL));