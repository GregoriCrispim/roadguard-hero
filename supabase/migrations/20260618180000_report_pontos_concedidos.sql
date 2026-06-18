-- Rastreia pontos já concedidos por reporte (evita duplicação e permite reconciliação)
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS pontos_concedidos INTEGER NOT NULL DEFAULT 0;
