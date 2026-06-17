
CREATE POLICY "Ler fotos e audios de ocorrencias" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('report-photos','report-audios'));
