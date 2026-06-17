
-- 1. Profiles: restrict SELECT to authenticated users (ranking page is behind auth)
DROP POLICY IF EXISTS "Perfis públicos para leitura" ON public.profiles;
CREATE POLICY "Perfis visiveis para autenticados"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 2. Reports: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Ocorrências públicas para leitura" ON public.reports;
CREATE POLICY "Ocorrencias visiveis para autenticados"
ON public.reports FOR SELECT
TO authenticated
USING (true);

-- 3. Storage: restrict reads to owner folder OR concessionaria/admin
DROP POLICY IF EXISTS "Ler fotos e audios de ocorrencias" ON storage.objects;
CREATE POLICY "Ler fotos e audios proprias ou admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['report-photos'::text, 'report-audios'::text])
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'concessionaria'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 4. user_roles: explicit admin-only mutation policies (deny by default for everyone else)
CREATE POLICY "Admin gerencia papeis - insert"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin gerencia papeis - update"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin gerencia papeis - delete"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Lock down has_role: revoke EXECUTE from anon/public, keep for authenticated + service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
