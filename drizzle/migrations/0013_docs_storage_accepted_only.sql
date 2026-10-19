DROP POLICY IF EXISTS "docs read" ON storage.objects;
CREATE POLICY "docs read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.staff_doc_unlocked(name) OR EXISTS (
      SELECT 1 FROM public.documents d JOIN public.service_requests r ON r.id = d.request_id
      WHERE d.storage_path = objects.name AND r.assigned_professional_id = auth.uid() AND r.assignment_accepted_at IS NOT NULL)));