ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS assignment_accepted_at timestamptz;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS assignment_note text;
COMMENT ON TYPE public.request_status IS 'Lifecycle: submitted(New Request), under_review, professional_assigned, customer_action_required, in_progress, completed, closed, cancelled, disputed. DEPRECATED values: professional_review, awaiting_documents, quote_provided, awaiting_confirmation';

UPDATE public.service_requests SET status = 'professional_assigned' WHERE status = 'professional_review';
UPDATE public.service_requests SET status = 'customer_action_required' WHERE status IN ('awaiting_documents','quote_provided','awaiting_confirmation');

CREATE OR REPLACE FUNCTION public.guard_request_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); pro_changed boolean := new.assigned_professional_id is distinct from old.assigned_professional_id;
begin
  if new.status is distinct from old.status and new.status::text in ('professional_review','awaiting_documents','quote_provided','awaiting_confirmation') then
    raise exception 'This status is no longer used';
  end if;
  if new.assigned_professional_id is not null and pro_changed and not public.is_assignable_pro(new.assigned_professional_id) then
    raise exception 'Only verified professionals can be assigned';
  end if;
  if pro_changed then
    new.assignment_accepted_at := null;
    if new.status = old.status then
      new.status := case when new.assigned_professional_id is null then 'under_review'::request_status else 'professional_assigned'::request_status end;
    end if;
  end if;
  if uid is null then return new; end if;
  if new.customer_id is distinct from old.customer_id or new.reference is distinct from old.reference then raise exception 'Not allowed'; end if;

  if public.is_staff(uid) then
    if pro_changed then
      if old.assigned_professional_id is not null and coalesce(trim(new.assignment_note),'') = '' then
        raise exception 'A reason is required to reassign a professional';
      end if;
      insert into public.audit_logs(actor_id, action, target, details) values (uid,
        case when old.assigned_professional_id is null then 'request.assign' else 'request.reassign' end,
        'request:' || old.reference, jsonb_build_object('from', old.assigned_professional_id, 'to', new.assigned_professional_id, 'reason', new.assignment_note));
    end if;
  else
    if pro_changed or new.assignment_note is distinct from old.assignment_note then raise exception 'Not allowed to change assignment'; end if;
    if old.assigned_professional_id = uid then
      if new.status is distinct from old.status then
        if old.status = 'professional_assigned' and new.status = 'in_progress' then
          new.assignment_accepted_at := now();
          insert into public.audit_logs(actor_id, action, target, details) values (uid, 'request.accept', 'request:' || old.reference, '{}');
        elsif old.assignment_accepted_at is null then
          raise exception 'Accept the assignment first';
        elsif not (old.status in ('in_progress','customer_action_required') and new.status in ('in_progress','customer_action_required','completed')) then
          raise exception 'Professionals cannot move a request from % to %', old.status, new.status;
        end if;
      elsif new.assignment_accepted_at is distinct from old.assignment_accepted_at then
        raise exception 'Not allowed';
      end if;
    elsif old.customer_id = uid then
      if new.next_action is distinct from old.next_action or new.assignment_accepted_at is distinct from old.assignment_accepted_at then
        raise exception 'Not allowed';
      end if;
      if new.status is distinct from old.status and not (
           (new.status = 'cancelled' and old.status in ('submitted','under_review','professional_assigned','customer_action_required'))
        or (new.status = 'closed' and old.status = 'completed')) then
        raise exception 'Customers may only cancel before work starts, or close a completed request';
      end if;
    else
      raise exception 'Not allowed';
    end if;
  end if;
  if new.status is distinct from old.status then
    insert into public.audit_logs(actor_id, action, target, details) values (uid, 'request.status', 'request:' || old.reference, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $function$;

-- notify assigned professional when the customer acts
CREATE OR REPLACE FUNCTION public.log_request_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.request_status_history(request_id, status, changed_by) values (new.id, new.status, auth.uid());
    if auth.uid() is distinct from new.customer_id then
      insert into public.notifications(user_id, title, body, link)
        values (new.customer_id, 'Request ' || new.reference || ' updated', 'Status: ' || replace(new.status::text,'_',' '), '/dashboard/requests/' || new.id);
    end if;
    if tg_op = 'UPDATE' and new.assigned_professional_id is not null and auth.uid() = new.customer_id then
      insert into public.notifications(user_id, title, body, link)
        values (new.assigned_professional_id, 'Request ' || new.reference || ' updated by customer', 'Status: ' || replace(new.status::text,'_',' '), '/dashboard/requests/' || new.id);
    end if;
  end if;
  if tg_op = 'UPDATE' and new.assigned_professional_id is not null and new.assigned_professional_id is distinct from old.assigned_professional_id then
    insert into public.notifications(user_id, title, body, link)
      values (new.assigned_professional_id, 'New engagement ' || new.reference, new.service_name || ' — please accept or decline via support', '/dashboard/requests/' || new.id);
  end if;
  return new;
end $function$;

-- assigned professional name for the request's parties
CREATE OR REPLACE FUNCTION public.assigned_professional_name(_rid uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select p.display_name || ' (' || p.category || ')' from public.service_requests r
  join public.professional_profiles p on p.user_id = r.assigned_professional_id
  where r.id = _rid and public.can_access_request(_rid)
$function$;
REVOKE EXECUTE ON FUNCTION public.assigned_professional_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assigned_professional_name(uuid) TO authenticated;

-- document requests
CREATE TABLE public.document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  label text NOT NULL,
  note text,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  fulfilled_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.document_requests TO authenticated;
GRANT ALL ON public.document_requests TO service_role;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docreq read" ON public.document_requests FOR SELECT TO authenticated USING (public.can_access_request(request_id));
CREATE POLICY "docreq insert" ON public.document_requests FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid() and status = 'open' and fulfilled_document_id is null and not public.is_suspended(auth.uid())
  and (public.is_staff(auth.uid()) or exists (select 1 from public.service_requests r where r.id = request_id and r.assigned_professional_id = auth.uid() and r.assignment_accepted_at is not null)));
CREATE POLICY "docreq update" ON public.document_requests FOR UPDATE TO authenticated USING (public.can_access_request(request_id));

CREATE OR REPLACE FUNCTION public.guard_document_request()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r public.service_requests; uid uuid := auth.uid();
begin
  select * into r from public.service_requests where id = coalesce(new.request_id, old.request_id);
  if tg_op = 'INSERT' then
    if uid is not null then
      insert into public.audit_logs(actor_id, action, target, details) values (uid, 'document_request.create', 'request:' || r.reference, jsonb_build_object('label', new.label));
    end if;
    insert into public.notifications(user_id, title, body, link) values (r.customer_id, 'Document requested for ' || r.reference, new.label, '/dashboard/requests/' || r.id);
    return new;
  end if;
  if new.request_id is distinct from old.request_id or new.label is distinct from old.label or new.requested_by is distinct from old.requested_by then raise exception 'Not allowed'; end if;
  if uid is null then return new; end if;
  if uid = r.customer_id and not public.is_staff(uid) then
    if new.status <> 'fulfilled' or new.fulfilled_document_id is null
       or not exists (select 1 from public.documents d where d.id = new.fulfilled_document_id and d.owner_id = uid and d.request_id = r.id) then
      raise exception 'Upload a document for this request to fulfil it';
    end if;
    new.fulfilled_at := now();
    if r.assigned_professional_id is not null then
      insert into public.notifications(user_id, title, body, link) values (r.assigned_professional_id, 'Document uploaded for ' || r.reference, new.label, '/dashboard/requests/' || r.id);
    end if;
  elsif not (public.is_staff(uid) or r.assigned_professional_id = uid) then
    raise exception 'Not allowed';
  elsif new.status not in ('open','fulfilled','waived') then
    raise exception 'Invalid status';
  end if;
  insert into public.audit_logs(actor_id, action, target, details) values (uid, 'document_request.' || new.status, 'request:' || r.reference, jsonb_build_object('label', new.label));
  return new;
end $function$;
CREATE TRIGGER docreq_guard BEFORE INSERT OR UPDATE ON public.document_requests FOR EACH ROW EXECUTE FUNCTION public.guard_document_request();

-- professionals can schedule appointments on their accepted engagements
CREATE POLICY "appt pro insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (
  professional_id = auth.uid() and status = 'confirmed' and not public.is_suspended(auth.uid())
  and exists (select 1 from public.service_requests r where r.id = request_id and r.assigned_professional_id = auth.uid() and r.customer_id = appointments.customer_id and r.assignment_accepted_at is not null));

CREATE OR REPLACE FUNCTION public.notify_appointment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and auth.uid() = new.professional_id then
    insert into public.notifications(user_id, title, body, link) values (new.customer_id, 'Appointment scheduled', new.topic || ' — ' || to_char(new.preferred_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') || ' IST', '/dashboard/appointments');
    insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'appointment.schedule', 'appointment:' || new.id, jsonb_build_object('request_id', new.request_id));
  end if;
  return new;
end $function$;
CREATE TRIGGER appt_notify AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_appointment();

-- listing rules: only complete, approved, active profiles may be listed
CREATE OR REPLACE FUNCTION public.guard_listing()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
begin
  if new.verification_status <> 'approved' or new.suspended then
    new.is_listed := false;
  elsif new.is_listed and not coalesce(old.is_listed, false) and (
       coalesce(trim(new.qualifications),'') = '' or coalesce(trim(new.registration_details),'') = ''
    or coalesce(trim(new.category),'') = '' or coalesce(trim(new.city),'') = '' or coalesce(trim(new.state),'') = '') then
    raise exception 'Complete qualifications, registration details, category, city and state before listing';
  end if;
  return new;
end $function$;
CREATE TRIGGER pro_listing_guard BEFORE INSERT OR UPDATE ON public.professional_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_listing();
UPDATE public.professional_profiles SET is_listed = false WHERE is_listed AND (verification_status <> 'approved' OR suspended);

-- reviewer history visible to the professional
DROP POLICY IF EXISTS "vr own read" ON public.verification_reviews;
CREATE POLICY "vr own read" ON public.verification_reviews FOR SELECT TO authenticated USING (professional_id = auth.uid());