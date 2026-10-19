ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'professional_assigned';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'customer_action_required';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'closed';