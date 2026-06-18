-- Papel parceiro (empresas que oferecem recompensas)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';

-- Status do resgate com validação por QR
DO $$ BEGIN
  CREATE TYPE public.redemption_status AS ENUM ('pendente', 'validado', 'expirado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Empresa parceira
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  telefone TEXT,
  email_contato TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  descricao TEXT,
  categoria TEXT DEFAULT 'geral',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parceiros ativos visíveis"
  ON public.partners FOR SELECT TO authenticated
  USING (ativo = true OR public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Membro gerencia seu parceiro"
  ON public.partners FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = partners.id AND m.cargo = 'gestor')
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = partners.id AND m.cargo = 'gestor')
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Vínculo usuário ↔ parceiro (gestor ou funcionário)
CREATE TABLE IF NOT EXISTS public.partner_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  cargo TEXT NOT NULL DEFAULT 'funcionario' CHECK (cargo IN ('gestor', 'funcionario')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, partner_id)
);
GRANT SELECT ON public.partner_members TO authenticated;
GRANT ALL ON public.partner_members TO service_role;
ALTER TABLE public.partner_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membro vê seu vínculo parceiro"
  ON public.partner_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.partner_members g WHERE g.user_id = auth.uid() AND g.partner_id = partner_members.partner_id AND g.cargo = 'gestor')
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Gestor gerencia funcionários"
  ON public.partner_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.partner_members g WHERE g.user_id = auth.uid() AND g.partner_id = partner_members.partner_id AND g.cargo = 'gestor')
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.partner_members g WHERE g.user_id = auth.uid() AND g.partner_id = partner_members.partner_id AND g.cargo = 'gestor')
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Recompensas vinculadas ao parceiro
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Recompensas públicas" ON public.rewards;
DROP POLICY IF EXISTS "Admin gerencia recompensas" ON public.rewards;
DROP POLICY IF EXISTS "Recompensas ativas visíveis" ON public.rewards;
DROP POLICY IF EXISTS "Admin e concessionária gerenciam recompensas" ON public.rewards;
DROP POLICY IF EXISTS "Parceiro gerencia suas recompensas" ON public.rewards;

CREATE POLICY "Recompensas ativas visíveis"
  ON public.rewards FOR SELECT TO authenticated
  USING (ativo = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'abcr'));

CREATE POLICY "Parceiro gerencia suas recompensas"
  ON public.rewards FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = rewards.partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = rewards.partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Resgates com QR e validação
ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS status public.redemption_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS redemptions_codigo_idx ON public.redemptions(codigo);
CREATE INDEX IF NOT EXISTS redemptions_partner_id_idx ON public.redemptions(partner_id);
CREATE INDEX IF NOT EXISTS redemptions_status_idx ON public.redemptions(status);

DROP POLICY IF EXISTS "Usuário vê próprios resgates" ON public.redemptions;
DROP POLICY IF EXISTS "Usuário cria próprio resgate" ON public.redemptions;

CREATE POLICY "Usuário vê próprios resgates"
  ON public.redemptions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = redemptions.partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Usuário cria próprio resgate"
  ON public.redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Gera código alfanumérico para QR
CREATE OR REPLACE FUNCTION public.gerar_codigo_resgate()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'RH-';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Motorista inicia resgate: gera QR pendente (pontos só abatidos na validação)
CREATE OR REPLACE FUNCTION public.criar_resgate(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_reward RECORD;
  v_pontos INT;
  v_codigo TEXT;
  v_redemption_id UUID;
  v_pending INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = p_reward_id AND ativo = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recompensa não encontrada ou inativa';
  END IF;
  IF v_reward.partner_id IS NULL THEN
    RAISE EXCEPTION 'Recompensa sem parceiro vinculado';
  END IF;

  SELECT pontos INTO v_pontos FROM public.profiles WHERE id = v_user;
  IF v_pontos IS NULL OR v_pontos < v_reward.custo_pontos THEN
    RAISE EXCEPTION 'Pontos insuficientes';
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.redemptions
  WHERE user_id = v_user AND reward_id = p_reward_id AND status = 'pendente' AND expires_at > now();
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Você já tem um resgate pendente desta recompensa';
  END IF;

  LOOP
    v_codigo := public.gerar_codigo_resgate();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.redemptions WHERE codigo = v_codigo);
  END LOOP;

  INSERT INTO public.redemptions (user_id, reward_id, pontos_gastos, status, codigo, partner_id, expires_at)
  VALUES (v_user, p_reward_id, v_reward.custo_pontos, 'pendente', v_codigo, v_reward.partner_id, now() + interval '24 hours')
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'id', v_redemption_id,
    'codigo', v_codigo,
    'expires_at', (now() + interval '24 hours'),
    'pontos_gastos', v_reward.custo_pontos,
    'reward_nome', v_reward.nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_resgate(UUID) TO authenticated;

-- Funcionário parceiro valida QR e abate pontos do motorista
CREATE OR REPLACE FUNCTION public.validar_resgate(p_codigo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_redemption RECORD;
  v_pontos INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT r.*, rw.nome AS reward_nome
  INTO v_redemption
  FROM public.redemptions r
  JOIN public.rewards rw ON rw.id = r.reward_id
  WHERE r.codigo = upper(trim(p_codigo));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.partner_members m
    WHERE m.user_id = v_user AND m.partner_id = v_redemption.partner_id
  ) THEN
    RAISE EXCEPTION 'Você não pode validar recompensas deste parceiro';
  END IF;

  IF v_redemption.status = 'validado' THEN
    RAISE EXCEPTION 'Este código já foi utilizado';
  END IF;

  IF v_redemption.status != 'pendente' THEN
    RAISE EXCEPTION 'Resgate não está pendente';
  END IF;

  IF v_redemption.expires_at IS NOT NULL AND v_redemption.expires_at < now() THEN
    UPDATE public.redemptions SET status = 'expirado' WHERE id = v_redemption.id;
    RAISE EXCEPTION 'Código expirado';
  END IF;

  SELECT pontos INTO v_pontos FROM public.profiles WHERE id = v_redemption.user_id FOR UPDATE;
  IF v_pontos IS NULL OR v_pontos < v_redemption.pontos_gastos THEN
    RAISE EXCEPTION 'Motorista sem pontos suficientes';
  END IF;

  UPDATE public.profiles
  SET pontos = pontos - v_redemption.pontos_gastos
  WHERE id = v_redemption.user_id;

  UPDATE public.redemptions
  SET status = 'validado', validated_at = now(), validated_by = v_user
  WHERE id = v_redemption.id;

  RETURN jsonb_build_object(
    'id', v_redemption.id,
    'codigo', v_redemption.codigo,
    'reward_nome', v_redemption.reward_nome,
    'pontos_gastos', v_redemption.pontos_gastos,
    'user_id', v_redemption.user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_resgate(TEXT) TO authenticated;

-- Marca resgates pendentes expirados (pode ser chamado periodicamente)
CREATE OR REPLACE FUNCTION public.expirar_resgates_pendentes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.redemptions SET status = 'expirado'
  WHERE status = 'pendente' AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expirar_resgates_pendentes() TO authenticated;

-- Cadastro inicial da empresa parceira (após criar conta)
CREATE OR REPLACE FUNCTION public.registrar_parceiro(
  p_nome_fantasia TEXT,
  p_razao_social TEXT DEFAULT NULL,
  p_cnpj TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_email_contato TEXT DEFAULT NULL,
  p_endereco TEXT DEFAULT NULL,
  p_cidade TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_categoria TEXT DEFAULT 'geral'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_partner_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF EXISTS (SELECT 1 FROM public.partner_members WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'Você já está vinculado a um parceiro';
  END IF;
  IF trim(p_nome_fantasia) = '' THEN RAISE EXCEPTION 'Nome fantasia obrigatório'; END IF;

  INSERT INTO public.partners (nome_fantasia, razao_social, cnpj, telefone, email_contato, endereco, cidade, uf, descricao, categoria)
  VALUES (trim(p_nome_fantasia), p_razao_social, p_cnpj, p_telefone, p_email_contato, p_endereco, p_cidade, p_uf, p_descricao, p_categoria)
  RETURNING id INTO v_partner_id;

  INSERT INTO public.partner_members (user_id, partner_id, cargo) VALUES (v_user, v_partner_id, 'gestor');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'partner') ON CONFLICT DO NOTHING;

  RETURN v_partner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_parceiro(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.ativar_portal_parceiro()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'partner')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ativar_portal_parceiro() TO authenticated;

-- Realtime para notificar motorista quando resgate for validado
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.redemptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
