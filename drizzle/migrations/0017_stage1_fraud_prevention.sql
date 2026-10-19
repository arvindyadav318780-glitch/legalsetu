
-- 1. Request submission limits + exact-duplicate detection (server side)
CREATE OR REPLACE FUNCTION public.request_signature(_details text, _answers jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  select md5(lower(regexp_replace(trim(coalesce(_details,'') || ' ' || coalesce(_answers::text,'')), '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE FUNCTION public.guard_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare n int;
begin
  if auth.uid() is null then return new; end if;
  select count(*) into n from public.service_requests where customer_id = new.customer_id and created_at > now() - interval '1 hour';
  if n >= 3 then raise exception 'Request limit reached: you can submit up to 3 new requests per hour. Please try again later.'; end if;
  select count(*) into n from public.service_requests where customer_id = new.customer_id and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Request limit reached: you can submit up to 10 new requests per day. Please try again tomorrow.'; end if;
  if exists (select 1 from public.service_requests r where r.customer_id = new.customer_id and r.service_slug = new.service_slug
      and r.created_at > now() - interval '7 days' and r.status::text not in ('cancelled','closed','completed')
      and public.request_signature(r.details, r.answers) = public.request_signature(new.details, new.answers)) then
    raise exception 'Duplicate request: you already have an open request for this service with the same details. Please continue with that request instead.';
  end if;
  return new;
end $$;
CREATE TRIGGER req_insert_guard BEFORE INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.guard_request_insert();

-- 2. Report reason codes
ALTER TABLE public.abuse_reports ADD COLUMN reason_code text NOT NULL DEFAULT 'other';
ALTER TABLE public.abuse_reports ADD COLUMN source text NOT NULL DEFAULT 'conversation';
ALTER TABLE public.abuse_reports ADD COLUMN contact_request_id uuid REFERENCES public.contact_requests(id);
ALTER TABLE public.abuse_reports ALTER COLUMN reason SET DEFAULT '';

CREATE OR REPLACE FUNCTION public.guard_abuse_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare n int;
begin
  new.status := 'open'; new.reviewed_by := null; new.review_note := null; new.reviewed_at := null; new.created_at := now();
  new.reason := left(trim(coalesce(new.reason,'')), 2000);
  if new.reporter_id = new.target_user_id then raise exception 'You cannot report yourself'; end if;
  if new.reason_code not in ('fraud','impersonation','misleading_credentials','harassment','spam','payment_dispute','off_platform_solicitation','privacy_violation','other') then
    raise exception 'Choose a valid report reason';
  end if;
  if new.reason_code = 'other' and length(new.reason) < 10 then raise exception 'Please describe the problem (at least 10 characters)'; end if;
  if new.conversation_id is not null then
    if not exists (select 1 from public.conversations c where c.id = new.conversation_id and (
        (c.client_id = new.reporter_id and c.professional_id = new.target_user_id) or (c.professional_id = new.reporter_id and c.client_id = new.target_user_id))) then
      raise exception 'You can only report the other person in your conversation';
    end if;
    new.source := 'conversation'; new.contact_request_id := null;
  elsif new.contact_request_id is not null then
    if not exists (select 1 from public.contact_requests c where c.id = new.contact_request_id and (
        (c.client_id = new.reporter_id and c.professional_id = new.target_user_id) or (c.professional_id = new.reporter_id and c.client_id = new.target_user_id))) then
      raise exception 'You can only report the other person in your contact request';
    end if;
    new.source := 'contact_request';
  else
    if not exists (select 1 from public.professional_profiles p where p.user_id = new.target_user_id and p.is_listed and p.verification_status = 'approved' and not p.suspended) then
      raise exception 'Only listed professional profiles can be reported from a profile page';
    end if;
    new.source := 'profile';
  end if;
  if exists (select 1 from public.abuse_reports where reporter_id = new.reporter_id and target_user_id = new.target_user_id and status = 'open' and created_at > now() - interval '1 day') then
    raise exception 'You already reported this account today. LegalSetu staff will review it.';
  end if;
  select count(*) into n from public.abuse_reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Too many reports today'; end if;
  select count(distinct reporter_id) into n from public.abuse_reports where target_user_id = new.target_user_id and created_at > now() - interval '30 days';
  if n + 1 >= 3 then perform public.raise_alert(new.target_user_id, 'repeated_reports', jsonb_build_object('reporters_30d', n + 1)); end if;
  return new;
end $$;

DROP POLICY "reports insert" ON public.abuse_reports;
CREATE POLICY "reports insert" ON public.abuse_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND NOT public.is_suspended(auth.uid()));

-- 3. Support privacy: only the owner and admins read profile rows; staff get a contact-free directory
DROP POLICY "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.staff_directory()
RETURNS TABLE(id uuid, full_name text, email text, state text, city text, created_at timestamptz, suspended boolean, suspended_reason text, is_customer boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare adm boolean := public.has_role(auth.uid(), 'admin');
begin
  if not public.is_staff(auth.uid()) then return; end if;
  return query select p.id, p.full_name, case when adm then p.email else null end, p.state, p.city, p.created_at, p.suspended,
    p.suspended_reason, exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'customer')
  from public.profiles p order by p.created_at desc limit 2000;
end $$;
REVOKE EXECUTE ON FUNCTION public.staff_directory() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.contact_shareable(_rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.service_requests r where r.id = _rid and (
    r.customer_id = auth.uid() or public.has_role(auth.uid(), 'admin') or (
      r.assigned_professional_id = auth.uid() and r.assignment_accepted_at is not null
      and r.contact_consent_at is not null and r.contact_consent_withdrawn_at is null)))
$$;

-- 4. Temporary restrictions
CREATE TABLE public.account_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  issued_by uuid NOT NULL,
  lifted_at timestamptz,
  lifted_by uuid,
  lift_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_restrictions TO authenticated;
GRANT ALL ON public.account_restrictions TO service_role;
ALTER TABLE public.account_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restrictions read" ON public.account_restrictions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE INDEX account_restrictions_user_idx ON public.account_restrictions(user_id, ends_at);

CREATE OR REPLACE FUNCTION public.has_active_restriction(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.account_restrictions where user_id = _uid and lifted_at is null and starts_at <= now() and ends_at > now())
$$;

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  select coalesce((select suspended from public.profiles where id = _user_id), false) or public.has_active_restriction(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.admin_restrict_account(_uid uuid, _hours integer, _reason text, _starts_at timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare rid uuid; ends timestamptz;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only administrators can restrict accounts'; end if;
  if _uid = auth.uid() then raise exception 'You cannot restrict your own account'; end if;
  if public.has_role(_uid, 'admin') then raise exception 'Administrator accounts cannot be restricted here'; end if;
  if not exists (select 1 from public.profiles where id = _uid) then raise exception 'Account not found'; end if;
  if _hours is null or _hours < 1 or _hours > 2160 then raise exception 'Duration must be between 1 hour and 90 days'; end if;
  if length(trim(coalesce(_reason,''))) < 5 then raise exception 'Enter a reason (at least 5 characters)'; end if;
  if _starts_at < now() - interval '5 minutes' then raise exception 'Start time cannot be in the past'; end if;
  ends := _starts_at + make_interval(hours => _hours);
  insert into public.account_restrictions(user_id, reason, starts_at, ends_at, issued_by)
    values (_uid, left(trim(_reason), 500), _starts_at, ends, auth.uid()) returning id into rid;
  insert into public.audit_logs(actor_id, action, target, details)
    values (auth.uid(), 'restriction.issue', 'user:' || _uid, jsonb_build_object('restriction', rid, 'starts_at', _starts_at, 'ends_at', ends, 'reason', left(trim(_reason), 500)));
  insert into public.notifications(user_id, title, body, link)
    values (_uid, 'Temporary account restriction', 'Messaging, contact and new requests are paused until ' || to_char(ends at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI') || ' IST. You can appeal from Support.', '/dashboard/support');
  return rid;
end $$;

CREATE OR REPLACE FUNCTION public.admin_lift_restriction(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare r record;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only administrators can lift restrictions'; end if;
  if length(trim(coalesce(_reason,''))) < 5 then raise exception 'Enter a reason (at least 5 characters)'; end if;
  update public.account_restrictions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = left(trim(_reason), 500)
    where id = _id and lifted_at is null returning * into r;
  if r.id is null then raise exception 'Restriction not found or already lifted'; end if;
  insert into public.audit_logs(actor_id, action, target, details)
    values (auth.uid(), 'restriction.lift', 'user:' || r.user_id, jsonb_build_object('restriction', _id, 'reason', left(trim(_reason), 500)));
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_restrict_account(uuid, integer, text, timestamptz) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_lift_restriction(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_restrict_account(uuid, integer, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lift_restriction(uuid, text) TO authenticated;

ALTER TABLE public.appeals ADD COLUMN restriction_id uuid REFERENCES public.account_restrictions(id);

CREATE OR REPLACE FUNCTION public.guard_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if tg_op = 'INSERT' then
    new.status := 'submitted'; new.decision_note := null; new.decided_by := null; new.decided_at := null; new.created_at := now();
    if (select count(*) from public.appeals where user_id=new.user_id and status in ('submitted','under_review')) >= 2 then raise exception 'You already have open appeals'; end if;
    if new.restriction_id is not null and not exists (select 1 from public.account_restrictions where id = new.restriction_id and user_id = new.user_id) then
      raise exception 'Restriction not found';
    end if;
  else
    if new.user_id <> old.user_id or new.body <> old.body or new.subject <> old.subject or new.restriction_id is distinct from old.restriction_id then raise exception 'Appeal text cannot be changed'; end if;
    if new.status in ('upheld','rejected') then
      if length(coalesce(trim(new.decision_note),'')) < 5 then raise exception 'Add a decision note'; end if;
      new.decided_by := auth.uid(); new.decided_at := now();
      if new.status = 'upheld' and new.restriction_id is not null then
        update public.account_restrictions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = left('Appeal upheld: ' || trim(new.decision_note), 500)
          where id = new.restriction_id and lifted_at is null;
        insert into public.audit_logs(actor_id, action, target, details)
          values (auth.uid(), 'restriction.lift', 'user:' || new.user_id, jsonb_build_object('restriction', new.restriction_id, 'via_appeal', new.id));
      end if;
      insert into public.notifications(user_id, title, body, link) values (new.user_id, 'Appeal decided', 'Your appeal was ' || new.status || '.', '/dashboard/support');
    end if;
  end if;
  return new;
end $$;

-- 5. Recorded credential checks before approval
CREATE TABLE public.credential_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  profession text NOT NULL,
  method text NOT NULL,
  checked_on date NOT NULL,
  reference text NOT NULL,
  outcome text NOT NULL,
  notes text,
  reviewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credential_checks TO authenticated;
GRANT ALL ON public.credential_checks TO service_role;
ALTER TABLE public.credential_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credential checks staff read" ON public.credential_checks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_credential_check(_pro uuid, _method text, _checked_on date, _reference text, _outcome text, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare cat text; cid uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only administrators can record credential checks'; end if;
  if _pro = auth.uid() then raise exception 'You cannot check your own credentials'; end if;
  select category into cat from public.professional_profiles where user_id = _pro;
  if cat is null then raise exception 'Professional profile not found'; end if;
  if cat = 'Chartered Accountant' and _method not in ('icai_online_member_verification','icai_certificate_reviewed','icai_written_confirmation') then
    raise exception 'Choose an ICAI verification method for a Chartered Accountant';
  elsif cat = 'Advocate' and _method not in ('bar_council_roll_verification','bar_council_certificate_reviewed','bar_council_written_confirmation') then
    raise exception 'Choose a Bar Council verification method for an Advocate';
  elsif cat not in ('Chartered Accountant','Advocate') and _method <> 'other_documented' then
    raise exception 'Choose a documented verification method';
  end if;
  if _outcome not in ('confirmed','not_found','mismatch','inconclusive') then raise exception 'Choose a valid outcome'; end if;
  if _checked_on is null or _checked_on > current_date or _checked_on < current_date - 180 then raise exception 'Check date must be within the last 180 days'; end if;
  if length(trim(coalesce(_reference,''))) < 3 then raise exception 'Enter the reference checked (membership/enrolment number, document or correspondence reference)'; end if;
  insert into public.credential_checks(professional_id, profession, method, checked_on, reference, outcome, notes, reviewer_id)
    values (_pro, cat, _method, _checked_on, left(trim(_reference), 200), _outcome, nullif(left(trim(coalesce(_notes,'')), 1000), ''), auth.uid()) returning id into cid;
  insert into public.audit_logs(actor_id, action, target, details)
    values (auth.uid(), 'credential_check.record', 'professional:' || _pro, jsonb_build_object('check', cid, 'method', _method, 'outcome', _outcome, 'checked_on', _checked_on));
  return cid;
end $$;
REVOKE EXECUTE ON FUNCTION public.record_credential_check(uuid, text, date, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_credential_check(uuid, text, date, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare is_admin boolean;
begin
  if auth.uid() is null then return new; end if;
  is_admin := public.has_role(auth.uid(),'admin');
  if old.user_id <> auth.uid() and (
       new.display_name is distinct from old.display_name or new.category is distinct from old.category
    or new.qualifications is distinct from old.qualifications or new.registration_details is distinct from old.registration_details
    or new.years_experience is distinct from old.years_experience or new.languages is distinct from old.languages
    or new.state is distinct from old.state or new.city is distinct from old.city
    or new.consultation_modes is distinct from old.consultation_modes or new.expertise is distinct from old.expertise
    or new.description is distinct from old.description) then
    raise exception 'Credentials can only be edited by the professional';
  end if;
  if old.user_id <> auth.uid() and new.is_listed and not old.is_listed then
    raise exception 'Only the professional can turn on public listing';
  end if;
  if new.suspended is distinct from old.suspended and not is_admin then
    raise exception 'Only administrators can suspend professionals';
  end if;
  if new.verification_status is distinct from old.verification_status then
    if is_admin and old.user_id <> auth.uid() then
      if new.verification_status in ('rejected','more_info_required') and coalesce(trim(new.verification_note),'') = '' then
        raise exception 'A reviewer note is required';
      end if;
      if new.verification_status = 'approved' and not exists (
          select 1 from public.credential_checks c where c.professional_id = old.user_id and c.outcome = 'confirmed' and c.profession = old.category
            and c.created_at > coalesce((select max(v.created_at) from public.verification_reviews v where v.professional_id = old.user_id and v.to_status = 'pending'), '-infinity'::timestamptz)) then
        raise exception 'Record a confirmed credential check (ICAI for CAs, Bar Council for Advocates) before approving';
      end if;
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    elsif old.verification_status in ('not_submitted','rejected','more_info_required') and new.verification_status = 'pending' then
      null;
    else
      raise exception 'Only administrators can change verification status';
    end if;
    insert into public.verification_reviews(professional_id, from_status, to_status, note, reviewer_id)
      values (old.user_id, old.verification_status, new.verification_status, new.verification_note, auth.uid());
    if is_admin and old.user_id <> auth.uid() then
      insert into public.audit_logs(actor_id, action, target, details)
        values (auth.uid(), 'verification.' || new.verification_status, 'professional:' || old.user_id, jsonb_build_object('from', old.verification_status, 'note', new.verification_note));
      insert into public.notifications(user_id, title, body, link)
        values (old.user_id, 'Verification update', 'Status: ' || replace(new.verification_status,'_',' ') || coalesce(' — ' || new.verification_note, ''), '/pro/profile');
    end if;
  elsif new.verification_note is distinct from old.verification_note and not (is_admin and old.user_id <> auth.uid()) then
    new.verification_note := old.verification_note;
  end if;
  if new.suspended is distinct from old.suspended then
    insert into public.audit_logs(actor_id, action, target, details)
      values (auth.uid(), case when new.suspended then 'professional.suspend' else 'professional.reinstate' end, 'professional:' || old.user_id, '{}');
  end if;
  if new.is_listed is distinct from old.is_listed and old.user_id <> auth.uid() then
    insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'professional.unlist', 'professional:' || old.user_id, '{}');
  end if;
  return new;
end $$;
