DROP POLICY IF EXISTS "ms read" ON public.marketplace_settings;
CREATE POLICY "ms read" ON public.marketplace_settings FOR SELECT TO authenticated
USING (public.is_professional(auth.uid()) OR public.is_staff(auth.uid()));

-- Non-identifying lead details for the calling professional's own contact requests.
-- City is shown only while the client's consent on the linked request is active.
CREATE OR REPLACE FUNCTION public.pro_lead_summaries()
RETURNS TABLE(contact_request_id uuid, service_name text, city text, urgency text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, r.service_name,
    CASE WHEN r.contact_consent_at IS NOT NULL AND r.contact_consent_withdrawn_at IS NULL THEN r.city END,
    r.urgency
  FROM contact_requests c
  LEFT JOIN service_requests r ON r.id = c.request_id
  WHERE c.professional_id = auth.uid() AND public.is_professional(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.pro_lead_summaries() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pro_lead_summaries() TO authenticated;