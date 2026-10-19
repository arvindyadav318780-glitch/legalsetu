create policy "admin manage roles ins" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin manage roles del" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.log_request_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.request_status_history(request_id, status, changed_by) values (new.id, new.status, auth.uid());
    insert into public.notifications(user_id, title, body, link)
      values (new.customer_id, 'Request ' || new.reference || ' updated', 'Status: ' || replace(new.status::text,'_',' '), '/dashboard/requests/' || new.id);
  end if;
  if tg_op = 'UPDATE' and new.assigned_professional_id is not null and new.assigned_professional_id is distinct from old.assigned_professional_id then
    insert into public.notifications(user_id, title, body, link)
      values (new.assigned_professional_id, 'New engagement ' || new.reference, new.service_name, '/pro/requests');
  end if;
  return new;
end $$;
revoke execute on function public.log_request_status() from public, anon, authenticated;