CREATE OR REPLACE FUNCTION public.guard_pro_initiate_known() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.initiated_by = 'professional' and not exists (select 1 from public.conversations where client_id=new.client_id and professional_id=new.professional_id)
     and not exists (select 1 from public.service_requests where customer_id=new.client_id and assigned_professional_id=new.professional_id) then
    raise exception 'You can only contact clients you have already worked with';
  end if;
  return new;
end $$;
REVOKE EXECUTE ON FUNCTION public.guard_pro_initiate_known() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_pro_initiate_known BEFORE INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.guard_pro_initiate_known();