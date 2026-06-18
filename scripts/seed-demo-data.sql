-- Seed demo: concessionárias, pedágios, rotas e alertas para demonstração nacional

-- Renomear concessionária existente
UPDATE public.concessionarias SET
  nome = 'Concebra — BR-060 Planaltina',
  sigla = 'CONCEBRA',
  rodovia = 'BR-060',
  uf = 'DF',
  extensao_km = 45.5,
  cor = '#005A9C'
WHERE id = 'ed2c9b68-4ee7-40e3-b2bd-17df30762db7';

-- Novas concessionárias
INSERT INTO public.concessionarias (id, nome, sigla, rodovia, uf, extensao_km, cor) VALUES
  ('a1000001-0001-4000-8000-000000000001', 'AutoBan — BR-050 Sul de Minas', 'AUTOBAN', 'BR-050', 'MG', 156.0, '#1D4ED8'),
  ('a1000001-0001-4000-8000-000000000002', 'Arteris Fluminense — BR-101', 'ARTERIS', 'BR-101', 'RJ', 498.0, '#059669'),
  ('a1000001-0001-4000-8000-000000000003', 'CCR ViaOeste — BR-116', 'VIAOESTE', 'BR-116', 'SP', 315.0, '#7C3AED'),
  ('a1000001-0001-4000-8000-000000000004', 'EcoRodovias — BR-381 Fernão Dias', 'ECO381', 'BR-381', 'MG', 562.0, '#DC2626'),
  ('a1000001-0001-4000-8000-000000000005', 'Entrevias — BR-153 Goiás', 'ENTREVIAS', 'BR-153', 'GO', 437.0, '#EA580C'),
  ('a1000001-0001-4000-8000-000000000006', 'Rota das Bandeiras — SP-330', 'RB330', 'SP-330', 'SP', 443.0, '#0891B2'),
  ('a1000001-0001-4000-8000-000000000007', 'CCR RioSP — BR-101 Litoral Sul', 'RIOSP', 'BR-101', 'SP', 320.0, '#BE185D')
ON CONFLICT (id) DO NOTHING;

-- Rotas (polilinhas aproximadas das vias pedagiadas)
INSERT INTO public.concessionaria_rotas (concessionaria_id, nome, coordinates, buffer_metros) VALUES
  ('a1000001-0001-4000-8000-000000000001', 'Trecho Sul de Minas',
   '[[-22.52,-46.63],[-22.35,-46.58],[-22.18,-46.52],[-22.02,-46.48],[-21.85,-46.42]]'::jsonb, 2500),
  ('a1000001-0001-4000-8000-000000000002', 'Rio-Santos Fluminense',
   '[[-22.98,-43.21],[-22.88,-43.05],[-22.75,-42.85],[-22.62,-42.65],[-22.48,-42.42],[-22.35,-42.18]]'::jsonb, 3000),
  ('a1000001-0001-4000-8000-000000000003', 'BR-116 Interior Paulista',
   '[[-23.55,-46.95],[-23.38,-46.88],[-23.22,-46.82],[-23.05,-46.75],[-22.88,-46.68]]'::jsonb, 2500),
  ('a1000001-0001-4000-8000-000000000004', 'Fernão Dias MG',
   '[[-20.05,-44.08],[-19.95,-44.02],[-19.85,-43.96],[-19.75,-43.90],[-19.65,-43.85]]'::jsonb, 2800),
  ('a1000001-0001-4000-8000-000000000005', 'BR-153 Centro-Oeste',
   '[[-16.72,-49.28],[-16.55,-49.10],[-16.38,-48.92],[-16.20,-48.75],[-16.02,-48.58]]'::jsonb, 2500),
  ('a1000001-0001-4000-8000-000000000006', 'SP-330 Anhanguera-Bandeirantes',
   '[[-23.25,-47.05],[-23.10,-46.92],[-22.95,-46.78],[-22.78,-46.62],[-22.62,-46.48]]'::jsonb, 2500),
  ('a1000001-0001-4000-8000-000000000007', 'BR-101 Litoral Sul SP',
   '[[-24.02,-46.42],[-23.85,-46.35],[-23.68,-46.28],[-23.52,-46.22],[-23.35,-46.15]]'::jsonb, 2800)
ON CONFLICT DO NOTHING;

-- Pedágios
INSERT INTO public.concessionaria_pedagios (concessionaria_id, nome, km, latitude, longitude, preco_carro_centavos, raio_metros) VALUES
  ('ed2c9b68-4ee7-40e3-b2bd-17df30762db7', 'Pedágio Planaltina', 'km 12', -15.861, -48.082, 1250, 2000),
  ('ed2c9b68-4ee7-40e3-b2bd-17df30762db7', 'Pedágio Brazlândia', 'km 28', -15.835, -48.055, 980, 1800),
  ('a1000001-0001-4000-8000-000000000001', 'Pedágio Pouso Alegre', 'km 45', -22.25, -46.55, 1890, 2000),
  ('a1000001-0001-4000-8000-000000000001', 'Pedágio Poços de Caldas', 'km 98', -21.90, -46.45, 2150, 2000),
  ('a1000001-0001-4000-8000-000000000002', 'Pedágio Niterói', 'km 62', -22.88, -43.10, 3200, 2500),
  ('a1000001-0001-4000-8000-000000000002', 'Pedágio Cabo Frio', 'km 185', -22.55, -42.42, 2850, 2200),
  ('a1000001-0001-4000-8000-000000000003', 'Pedágio Campinas', 'km 78', -23.22, -46.85, 2450, 2000),
  ('a1000001-0001-4000-8000-000000000003', 'Pedágio Jundiaí', 'km 142', -22.95, -46.72, 1980, 2000),
  ('a1000001-0001-4000-8000-000000000004', 'Pedágio Betim', 'km 210', -19.88, -43.98, 2750, 2200),
  ('a1000001-0001-4000-8000-000000000004', 'Pedágio Contagem', 'km 380', -19.72, -43.88, 3100, 2200),
  ('a1000001-0001-4000-8000-000000000005', 'Pedágio Anápolis', 'km 95', -16.45, -49.05, 1650, 2000),
  ('a1000001-0001-4000-8000-000000000005', 'Pedágio Goiânia Sul', 'km 210', -16.18, -48.78, 1420, 2000),
  ('a1000001-0001-4000-8000-000000000006', 'Pedágio Campinas SP-330', 'km 55', -23.08, -46.90, 2280, 2000),
  ('a1000001-0001-4000-8000-000000000006', 'Pedágio Limeira', 'km 168', -22.85, -46.58, 1890, 2000),
  ('a1000001-0001-4000-8000-000000000007', 'Pedágio Bertioga', 'km 42', -23.85, -46.32, 3500, 2500),
  ('a1000001-0001-4000-8000-000000000007', 'Pedágio Peruíbe', 'km 128', -23.52, -46.20, 2650, 2200);
