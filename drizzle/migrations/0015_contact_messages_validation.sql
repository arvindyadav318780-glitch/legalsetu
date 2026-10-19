DROP POLICY IF EXISTS "contact insert" ON public.contact_messages;
CREATE POLICY "contact insert" ON public.contact_messages FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(trim(name)) BETWEEN 2 AND 120
  AND char_length(email) BETWEEN 5 AND 200 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND char_length(trim(subject)) BETWEEN 2 AND 200
  AND char_length(trim(message)) BETWEEN 5 AND 5000
  AND created_at > now() - interval '5 minutes'
);