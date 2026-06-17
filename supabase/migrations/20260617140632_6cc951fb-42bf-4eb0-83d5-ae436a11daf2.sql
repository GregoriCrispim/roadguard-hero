
CREATE POLICY "Upload publico fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Upload publico audios" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-audios' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Update proprias fotos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('report-photos','report-audios') AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Delete proprias fotos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('report-photos','report-audios') AND auth.uid()::text = (storage.foldername(name))[1]);
