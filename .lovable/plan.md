## RoadHero — Plano de Construção (MVP para Hackathon)

SaaS de segurança viária colaborativa. Motoristas reportam ocorrências, ganham pontos, sobem de nível e resgatam recompensas. Concessionárias acessam dashboard com métricas e IA de triagem.

### Identidade visual
- Paleta: azul escuro `#0F172A`, verde `#22C55E`, amarelo `#EAB308`, branco
- Inspiração: Waze + Strava + Duolingo (gamificação, badges, progresso)
- Mobile-first, dark mode, tipografia moderna (Inter/Space Grotesk)
- Design system completo em `src/styles.css` com tokens semânticos (oklch), variantes shadcn customizadas, gradientes e sombras temáticas

### Stack
- TanStack Start (React 19 + Vite) — já configurado no template
- Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase gerenciado) para DB, Auth, Storage
- Lovable AI Gateway (Gemini) para Guardião Inteligente e Validação Inteligente
- Leaflet + OpenStreetMap para mapa
- Recharts para gráficos
- PWA (manifest-only, instalável)

### Escopo de ocorrências (apenas estes)
Animais na pista · Veículos parados em local perigoso · Acidentes · Objetos na pista · Incêndios/queimadas · Risco à segurança viária · Clima severo · Suspeita de assalto

Excluídos (não implementar): buracos, pavimentação, iluminação, estrutura, reclamações de concessionária.

### Estrutura de rotas
```
/                     Landing impactante (hero, problema, solução, gamificação, ESG, CTA)
/auth                 Login email + Google + recuperação
/_authenticated/
  app                 Dashboard usuário (pontos, nível, ranking, últimos reportes)
  reportar            Form: categoria, foto, GPS, descrição, áudio
  mapa                Leaflet com filtros e heatmap
  ranking             Top 100 Guardiões
  recompensas         Catálogo + resgate
  impacto             "Meu Impacto" ESG com gráficos
  guardiao            Chat IA (Guardião Inteligente)
  admin               Dashboard concessionária (gated por role)
```

### Banco de dados (Lovable Cloud)
- `profiles` (id→auth.users, nome, cidade, pontos, nivel, created_at)
- `user_roles` (separada, enum `app_role`: user, concessionaria, admin) + função `has_role` SECURITY DEFINER
- `reports` (id, user_id, categoria, descricao, lat, lng, foto_url, audio_url, status, score_ia, gravidade, created_at)
- `rewards` (id, nome, descricao, custo_pontos, ativo)
- `redemptions` (id, user_id, reward_id, created_at)
- Storage buckets: `report-photos`, `report-audios`
- RLS em todas as tabelas; GRANTs explícitos; trigger auto-criação de profile no signup

### Sistema de gamificação
- Bronze 0–500 · Prata 501–2000 · Ouro 2001–5000 · Diamante 5001+
- Badge + barra de progresso + benefícios desbloqueados
- Pontos atribuídos por reporte validado (regra simples: +50 base, bônus por gravidade)

### IA — Validação Inteligente (server function)
- Server fn recebe foto + descrição → chama Lovable AI (Gemini Vision)
- Retorna: gravidade (baixa/média/alta/crítica) + score de confiabilidade 0–1
- Fallback de regras simuladas se gateway falhar (para garantir demo)
- Atualiza `reports.gravidade` e `reports.score_ia`

### IA — Guardião Inteligente (chat)
- Server route streaming `/api/chat` com `useChat`
- System prompt: assistente especializado em segurança viária brasileira
- Markdown rendering nas respostas

### Dashboard concessionária
- Métricas: ocorrências por categoria (pizza), por região (barras), tempo médio resposta (linha), usuários ativos, distribuição de risco
- Exportar CSV
- Gerenciar status de ocorrências e catálogo de recompensas

### PWA
- `manifest.webmanifest` + ícones + theme-color (sem service worker — instalável apenas)

### SEO
- `head()` único por rota (title, description, OG)
- `sitemap.xml` e `robots.txt`
- H1 único, semântica, alt em imagens

### Ordem de execução
1. Ativar Lovable Cloud + migrations (tabelas, roles, RLS, GRANTs, buckets, trigger)
2. Design system (`styles.css` + variantes de botão/card)
3. Landing page + assets gerados (hero, ilustrações)
4. Auth (email + Google via broker Lovable)
5. Layout autenticado + navegação + perfil/pontos
6. Reportar ocorrência (upload foto/áudio, GPS) + server fn IA Validação
7. Mapa Leaflet com filtros + heatmap
8. Ranking + Recompensas + Resgate
9. Página "Meu Impacto" (ESG) com Recharts
10. Guardião Inteligente (chat streaming)
11. Dashboard concessionária (gated por `has_role('concessionaria')`)
12. PWA manifest + sitemap/robots + polish final

### Notas de demo
- Seed inicial: ~5 recompensas, ~20 reportes fictícios espalhados em rodovias-chave (BR-153, BR-101, etc.) para o mapa não nascer vazio
- Promover 1 conta como `concessionaria` via migration para acesso imediato ao admin

Confirme para eu começar pela ativação do Cloud + design system + landing.
