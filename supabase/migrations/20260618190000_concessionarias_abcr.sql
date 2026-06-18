-- Papel ABCR (gestão nacional)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'abcr';

-- Entidade concessionária
CREATE TABLE IF NOT EXISTS public.concessionarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sigla TEXT,
  rodovia TEXT,
  uf TEXT,
  extensao_km NUMERIC(8, 2),
  cor TEXT NOT NULL DEFAULT '#005A9C',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.concessionarias TO authenticated;
GRANT ALL ON public.concessionarias TO service_role;
ALTER TABLE public.concessionarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Concessionárias visíveis para autenticados"
  ON public.concessionarias FOR SELECT TO authenticated USING (true);

CREATE POLICY "ABCR e admin gerenciam concessionárias"
  ON public.concessionarias FOR ALL
  USING (public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'));

-- Vínculo usuário ↔ concessionária
CREATE TABLE IF NOT EXISTS public.concessionaria_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concessionaria_id UUID NOT NULL REFERENCES public.concessionarias(id) ON DELETE CASCADE,
  cargo TEXT DEFAULT 'operador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, concessionaria_id)
);
GRANT SELECT ON public.concessionaria_members TO authenticated;
GRANT ALL ON public.concessionaria_members TO service_role;
ALTER TABLE public.concessionaria_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membro vê seu vínculo"
  ON public.concessionaria_members FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ABCR gerencia membros"
  ON public.concessionaria_members FOR ALL
  USING (public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'));

-- Pedágios cadastrados pela concessionária
CREATE TABLE IF NOT EXISTS public.concessionaria_pedagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concessionaria_id UUID NOT NULL REFERENCES public.concessionarias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  km TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  preco_carro_centavos INTEGER NOT NULL DEFAULT 0,
  sentido TEXT DEFAULT 'ambos',
  raio_metros INTEGER NOT NULL DEFAULT 1500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concessionaria_pedagios_conc_idx ON public.concessionaria_pedagios(concessionaria_id);
GRANT SELECT ON public.concessionaria_pedagios TO authenticated;
GRANT ALL ON public.concessionaria_pedagios TO service_role;
ALTER TABLE public.concessionaria_pedagios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedágios visíveis para autenticados"
  ON public.concessionaria_pedagios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Membro gerencia pedágios da sua concessionária"
  ON public.concessionaria_pedagios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.concessionaria_members m
      WHERE m.user_id = auth.uid() AND m.concessionaria_id = concessionaria_pedagios.concessionaria_id
    )
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.concessionaria_members m
      WHERE m.user_id = auth.uid() AND m.concessionaria_id = concessionaria_pedagios.concessionaria_id
    )
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Trecho pedagiado (polilinha da via)
CREATE TABLE IF NOT EXISTS public.concessionaria_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concessionaria_id UUID NOT NULL REFERENCES public.concessionarias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Trecho principal',
  coordinates JSONB NOT NULL DEFAULT '[]',
  buffer_metros INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concessionaria_rotas_conc_idx ON public.concessionaria_rotas(concessionaria_id);
GRANT SELECT ON public.concessionaria_rotas TO authenticated;
GRANT ALL ON public.concessionaria_rotas TO service_role;
ALTER TABLE public.concessionaria_rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rotas visíveis para autenticados"
  ON public.concessionaria_rotas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Membro gerencia rotas da sua concessionária"
  ON public.concessionaria_rotas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.concessionaria_members m
      WHERE m.user_id = auth.uid() AND m.concessionaria_id = concessionaria_rotas.concessionaria_id
    )
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.concessionaria_members m
      WHERE m.user_id = auth.uid() AND m.concessionaria_id = concessionaria_rotas.concessionaria_id
    )
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Denormalização: qual concessionária cobre o alerta
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS concessionaria_id UUID REFERENCES public.concessionarias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS reports_concessionaria_id_idx ON public.reports(concessionaria_id);

DROP POLICY IF EXISTS "Concessionária e admin atualizam qualquer ocorrência" ON public.reports;
CREATE POLICY "Concessionária, ABCR e admin atualizam ocorrências"
  ON public.reports FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'concessionaria')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'abcr')
  );
