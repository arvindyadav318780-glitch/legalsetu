create or replace function public.guard_request_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_professional_id is not null
     and new.assigned_professional_id is distinct from old.assigned_professional_id
     and not exists (select 1 from public.professional_profiles p where p.user_id = new.assigned_professional_id and p.verification_status = 'verified') then
    raise exception 'Only verified professionals can be assigned';
  end if;
  if public.is_staff(auth.uid()) then return new; end if;
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
     and not exists (select 1 from public.professional_profiles p where p.user_id = new.professional_id and p.verification_status = 'verified') then
    raise exception 'Only verified professionals can be assigned';
  end if;
  if public.is_staff(auth.uid()) then return new; end if;
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

drop trigger if exists appt_guard on public.appointments;
create trigger appt_guard before update on public.appointments for each row execute function public.guard_appointment_update();