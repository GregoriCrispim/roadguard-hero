
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('user', 'concessionaria', 'admin');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Guardião',
  cidade TEXT,
  pontos INTEGER NOT NULL DEFAULT 0,
  nivel TEXT NOT NULL DEFAULT 'Bronze',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfis públicos para leitura" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Usuário gerencia o próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Usuário insere o próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seus papéis" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger para auto-criar profile e role no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, cidade)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'cidade'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reports
CREATE TYPE public.report_categoria AS ENUM (
  'animal_na_pista',
  'veiculo_parado',
  'acidente',
  'objeto_na_pista',
  'incendio',
  'risco_seguranca',
  'clima_severo',
  'suspeita_assalto'
);
CREATE TYPE public.report_gravidade AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE public.report_status AS ENUM ('em_analise', 'validado', 'resolvido', 'descartado');

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria public.report_categoria NOT NULL,
  descricao TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  foto_url TEXT,
  audio_url TEXT,
  status public.report_status NOT NULL DEFAULT 'em_analise',
  gravidade public.report_gravidade,
  score_ia NUMERIC(3,2),
  rodovia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT SELECT ON public.reports TO anon;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ocorrências públicas para leitura" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Usuário cria ocorrência própria" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuário atualiza ocorrência própria" ON public.reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Concessionária e admin atualizam qualquer ocorrência" ON public.reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'concessionaria') OR public.has_role(auth.uid(), 'admin'));

-- Rewards
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  custo_pontos INTEGER NOT NULL,
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards TO anon, authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recompensas públicas" ON public.rewards FOR SELECT USING (ativo = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia recompensas" ON public.rewards FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'concessionaria'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'concessionaria'));

-- Redemptions
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  pontos_gastos INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê próprios resgates" ON public.redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuário cria próprio resgate" ON public.redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Função para calcular nível com base em pontos
CREATE OR REPLACE FUNCTION public.calcular_nivel(_pontos INTEGER)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN _pontos >= 5001 THEN 'Diamante'
    WHEN _pontos >= 2001 THEN 'Ouro'
    WHEN _pontos >= 501 THEN 'Prata'
    ELSE 'Bronze'
  END
$$;

-- Trigger para atualizar nivel automaticamente
CREATE OR REPLACE FUNCTION public.atualizar_nivel()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.nivel = public.calcular_nivel(NEW.pontos);
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_nivel BEFORE INSERT OR UPDATE OF pontos ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.atualizar_nivel();

-- Seed inicial de recompensas
INSERT INTO public.rewards (nome, descricao, custo_pontos, categoria) VALUES
  ('R$ 10 em cashback no pedágio', 'Crédito automático no seu TAG de pedágio.', 500, 'pedagio'),
  ('Desconto de 5% em combustível', 'Voucher válido em postos parceiros por 30 dias.', 800, 'combustivel'),
  ('Café grátis na estrada', 'Resgate em conveniências parceiras.', 200, 'alimentacao'),
  ('15% em restaurantes parceiros', 'Desconto na próxima refeição na rodovia.', 600, 'alimentacao'),
  ('Kit Guardião RoadHero', 'Camiseta + adesivo oficial do programa.', 1500, 'brinde');
