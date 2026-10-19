COMMENT ON TABLE public.invoices IS 'DEPRECATED: legacy manual test records; replaced by public.payments';

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  professional_id uuid,
  description text NOT NULL,
  professional_fee_paise integer NOT NULL DEFAULT 0 CHECK (professional_fee_paise >= 0),
  professional_tax_paise integer NOT NULL DEFAULT 0 CHECK (professional_tax_paise >= 0),
  platform_fee_paise integer NOT NULL DEFAULT 0 CHECK (platform_fee_paise >= 0),
  platform_tax_paise integer NOT NULL DEFAULT 0 CHECK (platform_tax_paise >= 0),
  government_fee_paise integer NOT NULL DEFAULT 0 CHECK (government_fee_paise >= 0),
  total_paise integer NOT NULL CHECK (total_paise > 0),
  tax_note text,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'razorpay',
  test_mode boolean NOT NULL DEFAULT true,
  provider_order_id text UNIQUE,
  provider_payment_id text,
  failure_reason text,
  refunded_paise integer NOT NULL DEFAULT 0,
  invoice_number text UNIQUE,
  amount_confirmed_at timestamptz,
  paid_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay read" ON public.payments FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.is_staff(auth.uid()) OR professional_id = auth.uid());
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  outcome text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe staff read" ON public.payment_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  reviewer_id uuid,
  review_note text,
  reviewed_at timestamptz,
  provider_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr read" ON public.refund_requests FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_invoice_number()
 RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ select 'LS-TEST-INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0') $$;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

-- audit + notify on payment status changes (written by server only)
CREATE OR REPLACE FUNCTION public.audit_payment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.audit_logs(actor_id, action, target, details)
      values (new.created_by, 'payment.' || new.status, 'payment:' || new.id, jsonb_build_object('total_paise', new.total_paise, 'test_mode', new.test_mode, 'invoice', new.invoice_number));
    insert into public.notifications(user_id, title, body, link)
      values (new.customer_id, case when tg_op = 'INSERT' then 'Payment requested (TEST MODE)' else 'Payment ' || replace(new.status,'_',' ') || ' (TEST MODE)' end,
              new.description, '/dashboard/payments/' || new.id);
  end if;
  return new;
end $$;
CREATE TRIGGER payments_audit AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_payment();

CREATE OR REPLACE FUNCTION public.audit_refund()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into public.audit_logs(actor_id, action, target, details)
    values (coalesce(new.reviewer_id, new.customer_id), 'refund.' || new.status, 'payment:' || new.payment_id, jsonb_build_object('amount_paise', new.amount_paise, 'reason', new.reason, 'note', new.review_note));
  if tg_op = 'UPDATE' then
    insert into public.notifications(user_id, title, body, link) values (new.customer_id, 'Refund ' || new.status || ' (TEST MODE)', coalesce(new.review_note, ''), '/dashboard/payments/' || new.payment_id);
  end if;
  return new;
end $$;
CREATE TRIGGER refunds_audit AFTER INSERT OR UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.audit_refund();

INSERT INTO public.platform_settings(key, value) VALUES ('fee_model', jsonb_build_object(
  'default_platform_fee_paise', 0, 'platform_gst_percent', 18, 'refund_window_days', 7,
  'refund_terms', 'Platform fees are refundable if the request is cancelled before work starts. Professional fees are refundable as agreed with the professional before work starts; once work is in progress, refunds are reviewed case by case. Government/statutory fees already paid to authorities cannot be refunded.',
  'compliance_note', 'Professional fee-sharing, referral fees, commissions and platform charges for regulated professionals must be reviewed for compliance with applicable Indian professional regulations before production launch.'
)) ON CONFLICT (key) DO NOTHING;