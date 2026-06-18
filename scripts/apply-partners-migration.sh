#!/bin/bash
# Aplica o restante da migration de parceiros (com pausa anti rate-limit)
set -euo pipefail
URL="https://api.supabase.com/v1/projects/muotvbxyfhjxmlipprlz/database/query"
TOKEN="${SUPABASE_ACCESS_TOKEN:?}"

run_sql() {
  local label="$1"
  local query="$2"
  echo "→ $label"
  curl -sf -X POST "$URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.stdin.read()}))" <<< "$query")" \
    && echo "  OK" || echo "  FALHOU (tente novamente)"
  sleep 45
}

run_sql "rewards policies" "DROP POLICY IF EXISTS \"Recompensas públicas\" ON public.rewards;
DROP POLICY IF EXISTS \"Admin gerencia recompensas\" ON public.rewards;
DROP POLICY IF EXISTS \"Recompensas ativas visíveis\" ON public.rewards;
DROP POLICY IF EXISTS \"Parceiro gerencia suas recompensas\" ON public.rewards;
CREATE POLICY \"Recompensas ativas visíveis\" ON public.rewards FOR SELECT TO authenticated USING (ativo = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'abcr'));
CREATE POLICY \"Parceiro gerencia suas recompensas\" ON public.rewards FOR ALL USING (EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = rewards.partner_id) OR public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = rewards.partner_id) OR public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'));"

run_sql "redemptions columns" "ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS status public.redemption_status NOT NULL DEFAULT 'pendente';
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS redemptions_codigo_idx ON public.redemptions(codigo);
CREATE INDEX IF NOT EXISTS redemptions_partner_id_idx ON public.redemptions(partner_id);
CREATE INDEX IF NOT EXISTS redemptions_status_idx ON public.redemptions(status);"

run_sql "redemptions policies" "DROP POLICY IF EXISTS \"Usuário vê próprios resgates\" ON public.redemptions;
DROP POLICY IF EXISTS \"Usuário cria próprio resgate\" ON public.redemptions;
CREATE POLICY \"Usuário vê próprios resgates\" ON public.redemptions FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.partner_members m WHERE m.user_id = auth.uid() AND m.partner_id = redemptions.partner_id) OR public.has_role(auth.uid(), 'abcr') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY \"Usuário cria próprio resgate\" ON public.redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);"

echo "→ RPC functions (from migration file)"
python3 -c "
import json, os, urllib.request, pathlib
q = pathlib.Path('/workspace/supabase/migrations/20260618200000_partners_rewards_qr.sql').read_text()
q = q[q.find('CREATE OR REPLACE FUNCTION public.gerar_codigo_resgate'):]
req = urllib.request.Request(
  'https://api.supabase.com/v1/projects/muotvbxyfhjxmlipprlz/database/query',
  data=json.dumps({'query': q}).encode(),
  headers={'Authorization': f'Bearer {os.environ[\"SUPABASE_ACCESS_TOKEN\"]}', 'Content-Type': 'application/json'},
  method='POST',
)
urllib.request.urlopen(req, timeout=120)
print('  OK')
"

echo "Concluído."
