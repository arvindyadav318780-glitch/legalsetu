create or replace function public.is_suspended(_user_id uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = _user_id), false)
$$;
revoke execute on function public.is_assignable_pro(uuid) from public, anon, authenticated;

-- ===== Support tickets =====
alter table public.support_tickets add column if not exists request_id uuid references public.service_requests(id) on delete set null;
alter table public.support_tickets add column if not exists assigned_to uuid;
alter table public.support_tickets add column if not exists resolution_note text;
drop policy if exists "ticket insert" on public.support_tickets;
create policy "ticket insert" on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'open' and assigned_to is null and resolution_note is null and (request_id is null or public.can_access_request(request_id)));

create or replace function public.audit_ticket() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to or new.resolution_note is distinct from old.resolution_note then
    insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'ticket.update', 'ticket:' || old.id, jsonb_build_object('status', new.status, 'assigned_to', new.assigned_to, 'kind', old.kind));
    if new.status is distinct from old.status then
      insert into public.notifications(user_id, title, body, link) values (old.user_id, 'Ticket updated: ' || left(old.subject, 60), 'Status: ' || replace(new.status,'_',' '), '/dashboard/support');
    end if;
  end if;
  return new;
end $$;
create trigger ticket_audit after update on public.support_tickets for each row execute function public.audit_ticket();

create table public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
grant select, insert on public.ticket_replies to authenticated;
grant all on public.ticket_replies to service_role;
alter table public.ticket_replies enable row level security;
create policy "reply read" on public.ticket_replies for select to authenticated using (public.is_staff(auth.uid()) or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy "reply insert" on public.ticket_replies for insert to authenticated with check (author_id = auth.uid() and is_staff = public.is_staff(auth.uid()) and (public.is_staff(auth.uid()) or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed')));

-- ===== Document access with reason =====
create table public.doc_access_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  staff_id uuid not null default auth.uid(),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
grant select, insert on public.doc_access_log to authenticated;
grant all on public.doc_access_log to service_role;
alter table public.doc_access_log enable row level security;
create policy "dal insert" on public.doc_access_log for insert to authenticated with check (staff_id = auth.uid() and public.is_staff(auth.uid()));
create policy "dal read" on public.doc_access_log for select to authenticated using (public.has_role(auth.uid(),'admin') or staff_id = auth.uid());
create or replace function public.audit_doc_access() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, action, target, details) values (new.staff_id, 'document.open', 'document:' || new.document_id, jsonb_build_object('reason', new.reason));
  return new;
end $$;
create trigger dal_audit after insert on public.doc_access_log for each row execute function public.audit_doc_access();

create or replace function public.staff_doc_unlocked(_path text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(auth.uid()) and exists (
    select 1 from public.doc_access_log l join public.documents d on d.id = l.document_id
    where d.storage_path = _path and l.staff_id = auth.uid() and l.created_at > now() - interval '10 minutes')
$$;

drop policy if exists "docs read" on storage.objects;
create policy "docs read" on storage.objects for select to authenticated using (
  bucket_id = 'documents' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.staff_doc_unlocked(name)
    or exists (select 1 from public.documents d join public.service_requests r on r.id = d.request_id where d.storage_path = objects.name and r.assigned_professional_id = auth.uid())
  ));

-- ===== Conversation oversight =====
create table public.conversation_access_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  staff_id uuid not null default auth.uid(),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
grant select, insert on public.conversation_access_log to authenticated;
grant all on public.conversation_access_log to service_role;
alter table public.conversation_access_log enable row level security;
create or replace function public.oversight_eligible(_rid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.service_requests r where r.id = _rid and r.status = 'disputed')
      or exists (select 1 from public.support_tickets t where t.request_id = _rid and t.status in ('open','in_progress'))
$$;
create policy "cal insert" on public.conversation_access_log for insert to authenticated with check (staff_id = auth.uid() and public.is_staff(auth.uid()) and public.oversight_eligible(request_id));
create policy "cal read" on public.conversation_access_log for select to authenticated using (public.has_role(auth.uid(),'admin') or staff_id = auth.uid());
create or replace function public.audit_conv_access() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, action, target, details) values (new.staff_id, 'conversation.open', 'request:' || new.request_id, jsonb_build_object('reason', new.reason));
  return new;
end $$;
create trigger cal_audit after insert on public.conversation_access_log for each row execute function public.audit_conv_access();

create or replace function public.can_read_conversation(_rid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.service_requests r where r.id = _rid and (r.customer_id = auth.uid() or r.assigned_professional_id = auth.uid()))
      or (public.is_staff(auth.uid()) and public.oversight_eligible(_rid) and exists (
            select 1 from public.conversation_access_log l where l.request_id = _rid and l.staff_id = auth.uid() and l.created_at > now() - interval '60 minutes'))
$$;
drop policy if exists "msg read" on public.messages;
drop policy if exists "msg insert" on public.messages;
create policy "msg read" on public.messages for select to authenticated using (public.can_read_conversation(request_id));
create policy "msg insert" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.can_read_conversation(request_id) and not public.is_suspended(auth.uid()));

-- ===== Services & categories =====
create table public.service_categories (
  key text primary key check (key ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 80),
  blurb text,
  visible boolean not null default true,
  sort int not null default 100,
  updated_at timestamptz not null default now()
);
create table public.services (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 2 and 120),
  category text not null,
  short text,
  overview text,
  who_needs text[] not null default '{}',
  documents text[] not null default '{}',
  workflow text[] not null default '{}',
  professional text,
  modes text[] not null default '{Online}',
  popular boolean not null default false,
  visible boolean not null default true,
  sort int not null default 100,
  updated_at timestamptz not null default now()
);
grant select on public.service_categories, public.services to anon, authenticated;
grant insert, update, delete on public.service_categories, public.services to authenticated;
grant all on public.service_categories, public.services to service_role;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
create policy "cat read" on public.service_categories for select to anon, authenticated using (true);
create policy "cat admin ins" on public.service_categories for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "cat admin upd" on public.service_categories for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "cat admin del" on public.service_categories for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "svc read" on public.services for select to anon, authenticated using (true);
create policy "svc admin ins" on public.services for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "svc admin upd" on public.services for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "svc admin del" on public.services for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== Platform fees =====
create table public.platform_fees (
  service_slug text primary key,
  fee_paise int check (fee_paise is null or fee_paise between 0 and 100000000),
  note text,
  updated_at timestamptz not null default now()
);
grant select on public.platform_fees to anon, authenticated;
grant insert, update, delete on public.platform_fees to authenticated;
grant all on public.platform_fees to service_role;
alter table public.platform_fees enable row level security;
create policy "fee read" on public.platform_fees for select to anon, authenticated using (true);
create policy "fee admin ins" on public.platform_fees for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "fee admin upd" on public.platform_fees for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "fee admin del" on public.platform_fees for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== FAQs =====
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 5 and 300),
  answer text not null check (char_length(answer) between 5 and 3000),
  published boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;
grant all on public.faqs to service_role;
alter table public.faqs enable row level security;
create policy "faq anon" on public.faqs for select to anon using (published);
create policy "faq auth read" on public.faqs for select to authenticated using (published or public.is_staff(auth.uid()));
create policy "faq admin ins" on public.faqs for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "faq admin upd" on public.faqs for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "faq admin del" on public.faqs for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== Generic audit trigger =====
create or replace function public.audit_admin_change() returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  k := coalesce(to_jsonb(new), to_jsonb(old)) ->> tg_argv[0];
  insert into public.audit_logs(actor_id, action, target, details)
    values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name || ':' || coalesce(k,'?'), case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger services_audit after insert or update or delete on public.services for each row execute function public.audit_admin_change('slug');
create trigger categories_audit after insert or update or delete on public.service_categories for each row execute function public.audit_admin_change('key');
create trigger fees_audit after insert or update or delete on public.platform_fees for each row execute function public.audit_admin_change('service_slug');
create trigger faqs_audit after insert or update or delete on public.faqs for each row execute function public.audit_admin_change('id');
create trigger blog_audit after insert or update or delete on public.blog_posts for each row execute function public.audit_admin_change('slug');
create trigger settings_audit after insert or update on public.platform_settings for each row execute function public.audit_admin_change('key');

-- ===== Payments & refunds (test-mode records) =====
alter table public.invoices add column if not exists refund_note text;
alter table public.invoices add column if not exists refund_recorded_by uuid;
alter table public.invoices add column if not exists refund_recorded_at timestamptz;
alter table public.invoices add column if not exists test_mode boolean not null default true;
grant insert, update on public.invoices to authenticated;
create policy "inv admin insert" on public.invoices for insert to authenticated with check (public.has_role(auth.uid(),'admin') and test_mode and status = 'test_mode');
create policy "inv admin update" on public.invoices for update to authenticated using (public.has_role(auth.uid(),'admin'));
create or replace function public.guard_invoice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.amount_paise is distinct from old.amount_paise or new.user_id is distinct from old.user_id or new.description is distinct from old.description or new.test_mode is distinct from old.test_mode then
    raise exception 'Payment records cannot be edited; only refund notes can be recorded';
  end if;
  if new.status is distinct from old.status and not (old.test_mode or new.status = 'refunded') then
    raise exception 'Status changes require the payment gateway';
  end if;
  new.refund_recorded_by := auth.uid(); new.refund_recorded_at := now();
  insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'invoice.refund_note', 'invoice:' || old.id, jsonb_build_object('note', new.refund_note, 'status', new.status));
  return new;
end $$;
create trigger invoice_guard before update on public.invoices for each row execute function public.guard_invoice();

-- ===== Announcements =====
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('customers','professionals','user')),
  target_user uuid,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 3 and 1000),
  recipients int not null default 0,
  sent_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "ann staff read" on public.announcements for select to authenticated using (public.is_staff(auth.uid()));

-- ===== Blog: anon policy never calls staff helpers =====
drop policy if exists "blog public" on public.blog_posts;
create policy "blog anon" on public.blog_posts for select to anon using (published);
create policy "blog auth read" on public.blog_posts for select to authenticated using (published or public.is_staff(auth.uid()));

-- ===== Function execute permissions =====
revoke execute on function public.audit_ticket(), public.audit_doc_access(), public.audit_conv_access(), public.audit_admin_change(), public.guard_invoice() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role), public.is_staff(uuid), public.is_professional(uuid), public.can_access_request(uuid),
  public.staff_doc_unlocked(text), public.oversight_eligible(uuid), public.can_read_conversation(uuid) from public, anon;
grant execute on function public.has_role(uuid, app_role), public.is_staff(uuid), public.is_professional(uuid), public.can_access_request(uuid),
  public.staff_doc_unlocked(text), public.oversight_eligible(uuid), public.can_read_conversation(uuid) to authenticated;