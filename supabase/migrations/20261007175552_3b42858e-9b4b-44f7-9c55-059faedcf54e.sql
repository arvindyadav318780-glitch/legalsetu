-- ===== Profiles: email + suspension =====
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists suspended_reason text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function public.is_suspended(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = _user_id), false)
$$;

create policy "staff profile update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.suspended is distinct from old.suspended or new.suspended_reason is distinct from old.suspended_reason) then
    if not public.has_role(auth.uid(),'admin') then raise exception 'Only administrators can suspend accounts'; end if;
    if new.id = auth.uid() then raise exception 'You cannot suspend your own account'; end if;
    insert into public.audit_logs(actor_id, action, target, details)
      values (auth.uid(), case when new.suspended then 'user.suspend' else 'user.reactivate' end, 'user:' || new.id, jsonb_build_object('reason', new.suspended_reason));
  end if;
  if new.email is distinct from old.email then raise exception 'Email is managed by sign-in'; end if;
  if old.id <> auth.uid() and (new.full_name is distinct from old.full_name or new.phone is distinct from old.phone or new.state is distinct from old.state or new.city is distinct from old.city) then
    raise exception 'Admins cannot edit customer profile details';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'account_type','customer');
begin
  insert into public.profiles(id, full_name, email) values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  if r not in ('customer','ca','advocate','professional') then r := 'customer'; end if;
  insert into public.user_roles(user_id, role) values (new.id, r::app_role);
  return new;
end $$;

-- ===== Roles: no self-changes, audited =====
grant insert, delete on public.user_roles to authenticated;
create or replace function public.guard_roles() returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := coalesce(new.user_id, old.user_id); rl text := coalesce(new.role, old.role)::text;
begin
  if auth.uid() is not null then
    if uid = auth.uid() then raise exception 'You cannot change your own roles'; end if;
    insert into public.audit_logs(actor_id, action, target, details)
      values (auth.uid(), case when tg_op = 'INSERT' then 'role.grant' else 'role.revoke' end, 'user:' || uid, jsonb_build_object('role', rl));
  end if;
  return coalesce(new, old);
end $$;
create trigger roles_guard before insert or delete on public.user_roles for each row execute function public.guard_roles();

-- ===== Professional verification =====
alter table public.professional_profiles add column if not exists verification_note text;
alter table public.professional_profiles add column if not exists reviewed_by uuid;
alter table public.professional_profiles add column if not exists reviewed_at timestamptz;
alter table public.professional_profiles add column if not exists suspended boolean not null default false;

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null,
  from_status text,
  to_status text not null,
  note text,
  reviewer_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.verification_reviews to authenticated;
grant all on public.verification_reviews to service_role;
alter table public.verification_reviews enable row level security;
create policy "vr read" on public.verification_reviews for select to authenticated using (professional_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.guard_verification() returns trigger language plpgsql security definer set search_path = public as $$
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

alter table public.professional_profiles drop constraint if exists professional_profiles_verification_status_check;
update public.professional_profiles set verification_status = 'approved' where verification_status = 'verified';
alter table public.professional_profiles add constraint professional_profiles_verification_status_check
  check (verification_status in ('not_submitted','pending','under_review','approved','rejected','more_info_required'));

drop policy if exists "public listed verified" on public.professional_profiles;
create policy "public listed verified" on public.professional_profiles for select to anon, authenticated
  using (is_listed and verification_status = 'approved' and not suspended);

create or replace function public.is_assignable_pro(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.professional_profiles p where p.user_id = _uid and p.verification_status = 'approved' and not p.suspended)
    and not public.is_suspended(_uid)
$$;

create or replace function public.guard_request_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_professional_id is not null and new.assigned_professional_id is distinct from old.assigned_professional_id
     and not public.is_assignable_pro(new.assigned_professional_id) then
    raise exception 'Only verified professionals can be assigned';
  end if;
  if auth.uid() is null then return new; end if;
  if public.is_staff(auth.uid()) then
    if new.assigned_professional_id is distinct from old.assigned_professional_id then
      insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'request.assign', 'request:' || old.reference, jsonb_build_object('professional_id', new.assigned_professional_id));
    end if;
    if new.status is distinct from old.status then
      insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'request.status', 'request:' || old.reference, jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    return new;
  end if;
  if new.assigned_professional_id is distinct from old.assigned_professional_id or new.customer_id is distinct from old.customer_id then
    raise exception 'Not allowed to change assignment';
  end if;
  if old.assigned_professional_id = auth.uid() then return new; end if;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'Customers may only cancel requests';
  end if;
  return new;
end $$;

create or replace function public.guard_appointment_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is distinct from old.customer_id then raise exception 'Not allowed'; end if;
  if new.professional_id is not null and new.professional_id is distinct from old.professional_id
     and not public.is_assignable_pro(new.professional_id) then
    raise exception 'Only verified professionals can be assigned';
  end if;
  if auth.uid() is null then return new; end if;
  if public.is_staff(auth.uid()) then
    if new.professional_id is distinct from old.professional_id or new.status is distinct from old.status then
      insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'appointment.update', 'appointment:' || old.id, jsonb_build_object('professional_id', new.professional_id, 'status', new.status));
    end if;
    return new;
  end if;
  if new.professional_id is distinct from old.professional_id then raise exception 'Not allowed to change assignment'; end if;
  if old.professional_id = auth.uid() then
    if new.status not in ('requested','confirmed','declined','completed','cancelled') then raise exception 'Invalid status'; end if;
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'Customers may only cancel appointments';
  end if;
  return new;
end $$;

-- ===== Suspended accounts cannot create new activity =====
drop policy if exists "req insert" on public.service_requests;
create policy "req insert" on public.service_requests for insert to authenticated with check (customer_id = auth.uid() and status = 'submitted' and assigned_professional_id is null and terms_accepted and not public.is_suspended(auth.uid()));
drop policy if exists "appt insert" on public.appointments;
create policy "appt insert" on public.appointments for insert to authenticated with check (customer_id = auth.uid() and status = 'requested' and not public.is_suspended(auth.uid()));
drop policy if exists "doc insert" on public.documents;
create policy "doc insert" on public.documents for insert to authenticated with check (owner_id = auth.uid() and storage_path like auth.uid()::text || '/%' and not public.is_suspended(auth.uid()));

revoke execute on function public.guard_profile_update(), public.guard_roles(), public.guard_verification(), public.guard_request_update(),
  public.guard_appointment_update(), public.handle_new_user(), public.log_request_status() from public, anon, authenticated;
revoke execute on function public.is_suspended(uuid), public.is_assignable_pro(uuid) from public, anon;
grant execute on function public.is_suspended(uuid), public.is_assignable_pro(uuid) to authenticated;