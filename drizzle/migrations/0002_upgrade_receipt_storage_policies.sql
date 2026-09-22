CREATE POLICY "Users upload own upgrade receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'upgrade-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own upgrade receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'upgrade-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);