# RoadHero

Plataforma colaborativa de segurança viária — TanStack Start + Supabase + Vercel.

**Produção:** https://roadguard-hero.vercel.app

---

## Acesso rápido

| Portal | URL | Destino após login |
|--------|-----|-------------------|
| Guardião (motorista) | [/auth](https://roadguard-hero.vercel.app/auth) → aba **Guardião** | `/app` |
| Concessionária | [/auth](https://roadguard-hero.vercel.app/auth) → aba **Concessionária** | `/concessionaria` |
| Parceiro (recompensas) | [/auth](https://roadguard-hero.vercel.app/auth) → aba **Parceiro** | `/parceiro` |
| ABCR (gestão nacional) | [/auth](https://roadguard-hero.vercel.app/auth) → aba **ABCR** | `/abcr` |

**Senha padrão de todas as contas demo:** `Admin123`

---

## Contas de demonstração

### Guardiões (motoristas)

Use o portal **Guardião** em `/auth`.

| E-mail | Nome | Cidade | Perfil |
|--------|------|--------|--------|
| `guardiao1@roadhero.demo` | Ana Silva | São Paulo | Prata · 1.080 pts |
| `guardiao2@roadhero.demo` | Carlos Mendes | Rio de Janeiro | Prata · 1.740 pts |
| `guardiao3@roadhero.demo` | Marina Costa | Belo Horizonte | Prata · 1.210 pts |

> Pontuação calculada automaticamente a partir dos reportes **validados** (baixa 30 · média 60 · alta 120 · crítica 200 pts).

### Concessionárias (operadores regionais)

Use o portal **Concessionária** em `/auth`. Cada conta vê apenas alertas da sua rodovia (rota + pedágios cadastrados).

| E-mail | Concessionária | Rodovia | UF |
|--------|----------------|---------|-----|
| `concebra@roadhero.demo` | Concebra — BR-060 Planaltina | BR-060 | DF |
| `autoban@roadhero.demo` | AutoBan — BR-050 Sul de Minas | BR-050 | MG |
| `arteris@roadhero.demo` | Arteris Fluminense — BR-101 | BR-101 | RJ |
| `viaoeste@roadhero.demo` | CCR ViaOeste — BR-116 | BR-116 | SP |
| `ecorodovias@roadhero.demo` | EcoRodovias — BR-381 Fernão Dias | BR-381 | MG |
| `entrevias@roadhero.demo` | Entrevias — BR-153 Goiás | BR-153 | GO |
| `bandeiras@roadhero.demo` | Rota das Bandeiras — SP-330 | SP-330 | SP |
| `riosp@roadhero.demo` | CCR RioSP — BR-101 Litoral Sul | BR-101 | SP |

### ABCR (gestão nacional)

Use o portal **ABCR** em `/auth`. Acesso a todos os alertas, concessionárias e insights do país, sem filtro viário.

| E-mail | Nome | Função |
|--------|------|--------|
| `abcr@roadhero.demo` | Gestor Nacional ABCR | Gestão completa do ecossistema |
| `abcr.analista@roadhero.demo` | Analista ABCR | Visão nacional e relatórios |

### Admin técnico

| E-mail | Nome | Acesso |
|--------|------|--------|
| `admin@roadhero.demo` | Administrador RoadHero | ABCR + permissões admin |

### Parceiros (empresas com recompensas)

Use o portal **Parceiro** em `/auth`. Gestores cadastram a empresa e recompensas; funcionários validam QR Codes de resgate.

> **Regra:** não é permitido oferecer desconto em pedágio nem cashback de pedágio. Recompensas válidas: combustível, alimentação, conveniência, serviços, hospedagem e brindes.

| E-mail | Empresa | Papel |
|--------|---------|-------|
| `posto@roadhero.demo` | Posto Estrada Real | Gestor |
| `funcionario.posto@roadhero.demo` / `caixa.posto@roadhero.demo` | Posto Estrada Real | Funcionários |
| `restaurante@roadhero.demo` | Restaurante Via Sul | Gestor |
| `funcionario.restaurante@roadhero.demo` / `cozinha.restaurante@roadhero.demo` | Restaurante Via Sul | Funcionários |
| `conveniencia@roadhero.demo` | Conveniência Rodo Express | Gestor |
| `funcionario.conveniencia@roadhero.demo` | Conveniência Rodo Express | Funcionário |
| `autocenter@roadhero.demo` | Auto Center Rodovia | Gestor |
| `funcionario.autocenter@roadhero.demo` / `borracheiro.autocenter@roadhero.demo` | Auto Center Rodovia | Funcionários |
| `descanso@roadhero.demo` | Rede Descanso & Cia | Gestor |
| `funcionario.descanso@roadhero.demo` | Rede Descanso & Cia | Funcionário |
| `loja@roadhero.demo` | RoadHero Store | Gestor |
| `funcionario.loja@roadhero.demo` | RoadHero Store | Funcionário |

**Fluxo de resgate:** Guardião → `/recompensas` → Resgatar → QR Code → Parceiro escaneia em `/parceiro` → pontos abatidos + toast de confirmação.

---

## Dados demo no banco

O ambiente de produção está populado com:

- **8 concessionárias** com rotas pedagiadas e pedágios
- **6 parceiros** com gestores, funcionários e recompensas (sem pedágio/cashback)
- **~140+ alertas** distribuídos pelo país (últimos 30 dias)
- Status variados: em análise, validado, resolvido, descartado
- Categorias: animal na pista, acidente, clima severo, objeto na pista, etc.

Para repopular localmente ou em outro ambiente:

```bash
# Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente
python3 scripts/seed-demo-accounts.py   # cria contas e vínculos
python3 scripts/seed-demo-data.py       # popula concessionárias e alertas
python3 scripts/seed-demo-partners.py   # parceiros e recompensas
python3 scripts/recalcular-pontos.py    # sincroniza pontos dos perfis com reportes validados
```

### Migrations (Supabase CLI — recomendado)

A Management API (`/database/query`) pode retornar **HTTP 403 error code: 1010** (rate limit Cloudflare) em scripts com muitas chamadas seguidas. Use o CLI com projeto linkado:

```bash
npx supabase db push --linked --yes
```

---

## Desenvolvimento local

### Variáveis de ambiente

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

### Scripts

```bash
npm run dev      # desenvolvimento (porta 8080)
npm run build    # build de produção (Nitro + Vercel)
npm run preview  # preview do build
```

---

## Arquitetura de papéis

| Papel | Rota principal | Escopo |
|-------|----------------|--------|
| `user` | `/app` | Reportar ocorrências, ver próprios pontos |
| `concessionaria` | `/concessionaria` | Alertas da sua região + cadastro de pedágios/rota |
| `partner` | `/parceiro` | Cadastro da empresa, recompensas e validação de QR |
| `abcr` | `/abcr` | Visão nacional, CRUD concessionárias, vínculos |
| `admin` | `/abcr` | Mesmo que ABCR + permissões administrativas |

---

## Login com Google

Contas Google (OAuth) também funcionam. O redirecionamento após login segue o papel atribuído em `user_roles`.
