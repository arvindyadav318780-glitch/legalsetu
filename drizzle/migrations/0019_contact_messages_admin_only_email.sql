ALTER TABLE public.contact_messages ADD COLUMN handling_status text NOT NULL DEFAULT 'new';
ALTER TABLE public.contact_messages ADD COLUMN handling_note text;
ALTER TABLE public.contact_messages ADD COLUMN handled_by uuid;
ALTER TABLE public.contact_messages ADD COLUMN handled_at timestamptz;

DROP POLICY "contact staff read" ON public.contact_messages;
CREATE POLICY "contact admin read" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.staff_contact_messages()
RETURNS TABLE(id uuid, name text, email text, subject text, message text, created_at timestamptz, handling_status text, handling_note text, handled_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare adm boolean := public.has_role(auth.uid(), 'admin');
begin
  if not public.is_staff(auth.uid()) then return; end if;
  return query select m.id, m.name, case when adm then m.email else null end, m.subject, m.message, m.created_at, m.handling_status, m.handling_note, m.handled_at
    from public.contact_messages m order by m.created_at desc limit 500;
end $$;
REVOKE EXECUTE ON FUNCTION public.staff_contact_messages() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.staff_contact_messages() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_contact_message(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare adm boolean := public.has_role(auth.uid(), 'admin');
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not allowed'; end if;
  if _status not in ('in_review','needs_admin_reply','replied','closed') then raise exception 'Invalid status'; end if;
  if not adm and _status not in ('in_review','needs_admin_reply') then raise exception 'Only administrators can mark an inquiry replied or closed'; end if;
  if length(trim(coalesce(_note,''))) < 5 then raise exception 'Add a note (at least 5 characters)'; end if;
  update public.contact_messages set handling_status = _status, handling_note = left(trim(_note), 2000), handled_by = auth.uid(), handled_at = now() where id = _id;
  if not found then raise exception 'Message not found'; end if;
  insert into public.audit_logs(actor_id, action, target, details) values (auth.uid(), 'contact_message.' || _status, 'contact_message:' || _id, '{}');
end $$;
REVOKE EXECUTE ON FUNCTION public.update_contact_message(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_contact_message(uuid, text, text) TO authenticated;