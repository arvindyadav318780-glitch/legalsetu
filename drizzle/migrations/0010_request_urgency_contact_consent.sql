ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS contact_preference text,
  ADD COLUMN IF NOT EXISTS contact_consent_at timestamptz;
ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_urgency_chk CHECK (urgency IS NULL OR urgency IN ('urgent','this_week','this_month','flexible')),
  ADD CONSTRAINT service_requests_contact_pref_chk CHECK (contact_preference IS NULL OR contact_preference IN ('phone','email','whatsapp','in_app'));
CREATE INDEX IF NOT EXISTS service_requests_customer_slug_idx ON public.service_requests (customer_id, service_slug, created_at DESC);