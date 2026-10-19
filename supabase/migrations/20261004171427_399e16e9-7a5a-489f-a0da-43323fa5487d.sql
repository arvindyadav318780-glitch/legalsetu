create type public.app_role as enum ('customer','ca','advocate','professional','support','admin');
create type public.request_status as enum ('submitted','under_review','awaiting_documents','professional_review','quote_provided','awaiting_confirmation','in_progress','completed','cancelled','disputed');

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key,
  full_name text,
  phone text,
  state text,
  city text,
  preferred_language text default 'en',
  notify_email boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','support'))
$$;
create or replace function public.is_professional(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('ca','advocate','professional'))
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.professional_profiles (
  user_id uuid primary key,
  display_name text not null,
  category text not null,
  qualifications text,
  registration_details text,
  years_experience int,
  languages text[] default '{}',
  state text,
  city text,
  consultation_modes text[] default '{}',
  expertise text[] default '{}',
  description text,
  verification_status text not null default 'not_submitted' check (verification_status in ('not_submitted','pending','verified','rejected')),
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.professional_profiles to anon;
grant select, insert, update on public.professional_profiles to authenticated;
grant all on public.professional_profiles to service_role;
alter table public.professional_profiles enable row level security;
create policy "public listed verified" on public.professional_profiles for select to anon, authenticated using (is_listed and verification_status = 'verified');
create policy "own pro read" on public.professional_profiles for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "own pro insert" on public.professional_profiles for insert to authenticated with check (user_id = auth.uid() and public.is_professional(auth.uid()) and verification_status in ('not_submitted','pending'));
create policy "own pro update" on public.professional_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin pro update" on public.professional_profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger pro_updated before update on public.professional_profiles for each row execute function public.set_updated_at();

create or replace function public.guard_verification() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status is distinct from old.verification_status
     and not public.has_role(auth.uid(),'admin')
     and not (old.verification_status in ('not_submitted','rejected') and new.verification_status = 'pending') then
    raise exception 'Only administrators can change verification status';
  end if;
  return new;
end $$;
create trigger pro_guard before update on public.professional_profiles for each row execute function public.guard_verification();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif own upd" on public.notifications for update to authenticated using (user_id = auth.uid());

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('LS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  customer_id uuid not null default auth.uid(),
  service_slug text not null,
  service_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  state text,
  city text,
  mode text,
  answers jsonb not null default '{}',
  details text,
  status request_status not null default 'submitted',
  assigned_professional_id uuid,
  next_action text,
  terms_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.service_requests to authenticated;
grant all on public.service_requests to service_role;
alter table public.service_requests enable row level security;
create policy "req read" on public.service_requests for select to authenticated using (customer_id = auth.uid() or assigned_professional_id = auth.uid() or public.is_staff(auth.uid()));
create policy "req insert" on public.service_requests for insert to authenticated with check (customer_id = auth.uid() and status = 'submitted' and assigned_professional_id is null and terms_accepted);
create policy "req update staff/pro" on public.service_requests for update to authenticated using (assigned_professional_id = auth.uid() or public.is_staff(auth.uid()));
create policy "req cancel own" on public.service_requests for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create trigger req_updated before update on public.service_requests for each row execute function public.set_updated_at();

create or replace function public.guard_request_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
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
create trigger req_guard before update on public.service_requests for each row execute function public.guard_request_update();

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  status request_status not null,
  note text,
  changed_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.request_status_history to authenticated;
grant all on public.request_status_history to service_role;
alter table public.request_status_history enable row level security;
create policy "hist read" on public.request_status_history for select to authenticated using (exists (select 1 from public.service_requests r where r.id = request_id and (r.customer_id = auth.uid() or r.assigned_professional_id = auth.uid() or public.is_staff(auth.uid()))));

create or replace function public.log_request_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.request_status_history(request_id, status, changed_by) values (new.id, new.status, auth.uid());
    insert into public.notifications(user_id, title, body, link)
      values (new.customer_id, 'Request ' || new.reference || ' updated', 'Status: ' || replace(new.status::text,'_',' '), '/dashboard/requests/' || new.id);
  end if;
  return new;
end $$;
create trigger req_status_log after insert or update on public.service_requests for each row execute function public.log_request_status();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  request_id uuid references public.service_requests(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  category text not null default 'Other',
  mime_type text,
  size_bytes int,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "doc read" on public.documents for select to authenticated using (owner_id = auth.uid() or public.is_staff(auth.uid()) or exists (select 1 from public.service_requests r where r.id = request_id and r.assigned_professional_id = auth.uid()));
create policy "doc insert" on public.documents for insert to authenticated with check (owner_id = auth.uid() and storage_path like auth.uid()::text || '/%');
create policy "doc delete" on public.documents for delete to authenticated using (owner_id = auth.uid());

create or replace function public.can_access_request(_rid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.service_requests r where r.id = _rid and (r.customer_id = auth.uid() or r.assigned_professional_id = auth.uid() or public.is_staff(auth.uid())))
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "msg read" on public.messages for select to authenticated using (public.can_access_request(request_id));
create policy "msg insert" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.can_access_request(request_id));

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid(),
  professional_id uuid,
  request_id uuid references public.service_requests(id) on delete set null,
  preferred_at timestamptz not null,
  mode text not null default 'online',
  topic text not null,
  status text not null default 'requested' check (status in ('requested','confirmed','declined','completed','cancelled')),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "appt read" on public.appointments for select to authenticated using (customer_id = auth.uid() or professional_id = auth.uid() or public.is_staff(auth.uid()));
create policy "appt insert" on public.appointments for insert to authenticated with check (customer_id = auth.uid() and status = 'requested');
create policy "appt update" on public.appointments for update to authenticated using (customer_id = auth.uid() or professional_id = auth.uid() or public.is_staff(auth.uid()));

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  subject text not null,
  body text not null,
  kind text not null default 'support' check (kind in ('support','complaint','profile_report')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "ticket read" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "ticket insert" on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'open');
create policy "ticket staff update" on public.support_tickets for update to authenticated using (public.is_staff(auth.uid()));
create trigger ticket_updated before update on public.support_tickets for each row execute function public.set_updated_at();

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 255),
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 3000),
  created_at timestamptz not null default now()
);
grant insert on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;
create policy "contact insert" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "contact staff read" on public.contact_messages for select to authenticated using (public.is_staff(auth.uid()));

create table public.saved_professionals (
  user_id uuid not null default auth.uid(),
  professional_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, professional_key)
);
grant select, insert, delete on public.saved_professionals to authenticated;
grant all on public.saved_professionals to service_role;
alter table public.saved_professionals enable row level security;
create policy "saved own" on public.saved_professionals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  description text not null,
  amount_paise int not null,
  status text not null default 'test_mode' check (status in ('test_mode','due','paid','refunded','failed')),
  created_at timestamptz not null default now()
);
grant select on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "inv read" on public.invoices for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target text,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "audit staff insert" on public.audit_logs for insert to authenticated with check (actor_id = auth.uid() and public.is_staff(auth.uid()));

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  category text not null,
  author_name text not null default 'LegalSetu Editorial Team',
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.blog_posts to anon;
grant select, insert, update, delete on public.blog_posts to authenticated;
grant all on public.blog_posts to service_role;
alter table public.blog_posts enable row level security;
create policy "blog public" on public.blog_posts for select to anon, authenticated using (published or public.is_staff(auth.uid()));
create policy "blog admin write" on public.blog_posts for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.platform_settings to anon, authenticated;
grant insert, update on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "settings read" on public.platform_settings for select to anon, authenticated using (true);
create policy "settings admin ins" on public.platform_settings for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "settings admin upd" on public.platform_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'account_type','customer');
begin
  insert into public.profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  if r not in ('customer','ca','advocate','professional') then r := 'customer'; end if;
  insert into public.user_roles(user_id, role) values (new.id, r::app_role);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create policy "docs own upload" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "docs read" on storage.objects for select to authenticated using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid()) or exists (select 1 from public.documents d join public.service_requests r on r.id = d.request_id where d.storage_path = name and r.assigned_professional_id = auth.uid())));
create policy "docs own delete" on storage.objects for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.blog_posts (slug,title,excerpt,body,category,published,published_at) values
('what-is-gst-registration','What is GST registration and who needs it?','A plain-language overview of GST registration basics for small businesses in India.','GST registration is the process by which a business obtains a GSTIN. Whether registration is mandatory depends on factors such as turnover thresholds, the nature of supply, and inter-state activity. Thresholds and rules change from time to time, so always confirm current requirements with a qualified professional or the official GST portal before acting.

Typical documents include PAN, proof of business address, identity and address proof of proprietors, partners or directors, and bank account details.','GST',true,now()),
('itr-basics-for-freelancers','Income tax return basics for freelancers','Understanding which ITR form may apply and what records to keep through the year.','Freelancers in India generally report professional income and may be eligible for different computation approaches depending on their situation. Choosing the correct ITR form and tax regime depends on the nature and amount of income.

Keep invoices, bank statements, Form 26AS / AIS and expense records organised throughout the year.','Income Tax',true,now()),
('choosing-a-business-structure','Proprietorship, LLP or private limited: choosing a structure','Key factors to weigh when deciding how to register your business.','The right structure depends on liability, compliance burden, funding plans, number of owners and tax considerations. A proprietorship is simple to start, an LLP offers limited liability with flexible management, and a private limited company suits businesses planning to raise equity.

Discuss your specific plans with a qualified professional.','Business Registration',true,now()),
('startup-compliance-checklist','A starter compliance checklist for new companies','Recurring filings and records new companies commonly need to track.','Newly incorporated companies typically need to track board meetings, statutory registers, annual filings, auditor appointment and tax registrations. Exact obligations depend on the entity type and activities.','Startup Compliance',true,now()),
('rent-agreement-essentials','Rent agreement essentials','Clauses commonly included in residential and commercial rent agreements.','Rent agreements usually cover parties, property description, rent and deposit, duration, maintenance, termination and lock-in terms. Stamp duty and registration requirements vary by state.','Legal Basics',true,now()),
('managing-small-business-cash-flow','Managing cash flow in a small business','Practical habits that keep working capital healthy.','Track receivables, separate business and personal accounts, plan for tax payments and maintain a small reserve. Simple monthly bookkeeping makes all of this easier.','Small Business Finance',true,now());
