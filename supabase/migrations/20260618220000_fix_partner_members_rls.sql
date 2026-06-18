-- Evita recursão infinita em políticas RLS que consultam partner_members de dentro de partner_members.
CREATE OR REPLACE FUNCTION public.is_partner_gestor(_user_id UUID, _partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_members
    WHERE user_id = _user_id
      AND partner_id = _partner_id
      AND cargo = 'gestor'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_partner_member(_user_id UUID, _partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_members
    WHERE user_id = _user_id
      AND partner_id = _partner_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_partner_gestor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partner_member(UUID, UUID) TO authenticated;

-- partner_members
DROP POLICY IF EXISTS "Membro vê seu vínculo parceiro" ON public.partner_members;
DROP POLICY IF EXISTS "Gestor gerencia funcionários" ON public.partner_members;

CREATE POLICY "Membro vê seu vínculo parceiro"
  ON public.partner_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_partner_gestor(auth.uid(), partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Gestor gerencia funcionários"
  ON public.partner_members FOR ALL
  USING (
    public.is_partner_gestor(auth.uid(), partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_partner_gestor(auth.uid(), partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- partners
DROP POLICY IF EXISTS "Membro gerencia seu parceiro" ON public.partners;

CREATE POLICY "Membro gerencia seu parceiro"
  ON public.partners FOR ALL
  USING (
    public.is_partner_gestor(auth.uid(), id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_partner_gestor(auth.uid(), id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- rewards
DROP POLICY IF EXISTS "Parceiro gerencia suas recompensas" ON public.rewards;

CREATE POLICY "Parceiro gerencia suas recompensas"
  ON public.rewards FOR ALL
  USING (
    public.is_partner_member(auth.uid(), partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_partner_member(auth.uid(), partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );

-- redemptions
DROP POLICY IF EXISTS "Usuário vê próprios resgates" ON public.redemptions;

CREATE POLICY "Usuário vê próprios resgates"
  ON public.redemptions FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_partner_member(auth.uid(), partner_id)
    OR public.has_role(auth.uid(), 'abcr')
    OR public.has_role(auth.uid(), 'admin')
  );
