import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RoadHeroLogo } from "@/components/RoadHeroLogo";
import heroImg from "@/assets/hero-highway.jpg";
import {
  ShieldCheck,
  MapPin,
  Sparkles,
  Trophy,
  Leaf,
  Building2,
  AlertTriangle,
  Users,
  Bot,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { CATEGORIAS_LIST } from "@/lib/categorias";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoadHero — Milhões de olhos protegendo nossas rodovias" },
      { name: "description", content: "Transforme-se em um Guardião das rodovias. Reporte ocorrências, ganhe pontos, resgate recompensas e ajude a salvar vidas com tecnologia e IA." },
      { property: "og:title", content: "RoadHero — Segurança viária colaborativa" },
      { property: "og:description", content: "Motoristas, caminhoneiros e passageiros como sensores humanos da segurança nas rodovias do Brasil." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <RoadHeroLogo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#problema" className="hover:text-foreground">Problema</a>
            <a href="#solucao" className="hover:text-foreground">Solução</a>
            <a href="#como" className="hover:text-foreground">Como funciona</a>
            <a href="#gamificacao" className="hover:text-foreground">Gamificação</a>
            <a href="#concessionarias" className="hover:text-foreground">Concessionárias</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/auth"><Button size="sm">Quero ser um Guardião</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-grid-dim opacity-30" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Inteligência coletiva + IA generativa
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Milhões de olhos<br /> protegendo <span className="text-gradient">nossas rodovias.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Transformamos motoristas em agentes ativos da segurança viária através de tecnologia, gamificação e inteligência coletiva.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Quero ser um Guardião <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#concessionarias">
                <Button size="lg" variant="outline">Sou Concessionária</Button>
              </a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[
                { v: "+8K", l: "Reportes/mês" },
                { v: "97%", l: "Precisão IA" },
                { v: "12s", l: "Tempo médio" },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="font-display text-2xl font-bold text-primary">{s.v}</dt>
                  <dd className="text-xs text-muted-foreground">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-3xl" aria-hidden />
            <img
              src={heroImg}
              alt="Rodovia brasileira com motoristas conectados em rede de segurança"
              width={1920}
              height={1080}
              className="relative rounded-3xl border border-border/50 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Problema */}
      <section id="problema" className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-warning">O Problema</span>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">A cada hora, vidas se perdem em rodovias.</h2>
            <p className="mt-4 text-muted-foreground">
              Animais na pista, veículos parados em pontos cegos, acidentes sem socorro rápido, neblina densa, tentativas de assalto. Concessionárias dependem de câmeras e patrulhas — mas <strong className="text-foreground">a maior fonte de dados do trânsito sempre esteve dirigindo</strong>.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { i: AlertTriangle, t: "Resposta lenta", d: "Ocorrências críticas demoram para chegar ao centro de controle." },
              { i: Users, t: "Dados subutilizados", d: "Milhões de motoristas veem riscos diariamente sem canal para reportar." },
              { i: MapPin, t: "Zonas cegas", d: "Trechos sem câmeras ficam invisíveis até o próximo acidente." },
              { i: Bot, t: "Ruído operacional", d: "Sem IA, é impossível priorizar entre milhares de chamados." },
            ].map((b) => {
              const Icon = b.i;
              return (
                <div key={b.t} className="rounded-2xl border bg-card p-5">
                  <Icon className="h-6 w-6 text-warning" />
                  <h3 className="mt-3 font-semibold">{b.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solução */}
      <section id="solucao" className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">A Solução</span>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Uma rede viva de Guardiões da estrada.</h2>
          <p className="mt-4 text-muted-foreground">
            RoadHero conecta motoristas, caminhoneiros e passageiros em um ecossistema colaborativo. Cada reporte é validado por IA, classificado por gravidade e entregue em tempo real às concessionárias.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            { i: ShieldCheck, t: "Reporte em 10s", d: "Categoria, foto e GPS automáticos. Áudio opcional." },
            { i: Sparkles, t: "Validação Inteligente", d: "IA analisa imagem e texto, classifica gravidade e gera score de confiabilidade." },
            { i: Trophy, t: "Gamificação real", d: "Pontos, níveis e recompensas em postos, restaurantes, lojas e serviços parceiros." },
          ].map((b) => {
            const Icon = b.i;
            return (
              <div key={b.t} className="rounded-2xl border bg-card p-6 transition hover:border-primary/40 hover:bg-surface">
                <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary glow-primary">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{b.t}</h3>
                <p className="mt-2 text-muted-foreground">{b.d}</p>
              </div>
            );
          })}
        </div>

        {/* Categorias */}
        <div className="mt-16 rounded-3xl border bg-surface/40 p-8">
          <h3 className="font-display text-xl font-bold">O que você pode reportar</h3>
          <p className="text-sm text-muted-foreground">Apenas situações que impactam diretamente a segurança viária.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIAS_LIST.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.key} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${c.cor} 20%, transparent)` }}>
                    <Icon className="h-4 w-4" style={{ color: c.cor }} />
                  </div>
                  <span className="text-sm font-medium">{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como" className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Como funciona</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Avistou algo", d: "Animal, acidente, objeto, neblina, suspeita…" },
              { n: "02", t: "Reporta em 10s", d: "Toque, foto, GPS automático. Pronto." },
              { n: "03", t: "IA valida", d: "Classifica gravidade e calcula score de confiabilidade." },
              { n: "04", t: "Ganha pontos", d: "Sobe de nível e resgata recompensas reais." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border bg-card p-6">
                <span className="font-display text-3xl font-bold text-primary/70">{s.n}</span>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gamificação */}
      <section id="gamificacao" className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">Gamificação</span>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Cada reporte te aproxima do próximo nível.</h2>
            <p className="mt-4 text-muted-foreground">
              Inspirado em Strava, Waze e Duolingo. Suba de Bronze a Diamante, desbloqueie benefícios e veja seu impacto crescer.
            </p>
            <ul className="mt-6 space-y-3">
              {["Desconto em combustível", "Café grátis na estrada", "Serviços automotivos", "Brindes oficiais RoadHero"].map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { e: "🥉", n: "Bronze", r: "0 — 500 pts" },
              { e: "🥈", n: "Prata", r: "501 — 2.000 pts" },
              { e: "🥇", n: "Ouro", r: "2.001 — 5.000 pts" },
              { e: "💎", n: "Diamante", r: "5.001+ pts" },
            ].map((l) => (
              <div key={l.n} className="rounded-2xl border bg-card p-6 text-center transition hover:border-primary/40">
                <div className="text-4xl">{l.e}</div>
                <h3 className="mt-2 font-display text-xl font-bold">Guardião {l.n}</h3>
                <p className="text-xs text-muted-foreground">{l.r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESG */}
      <section className="border-y border-border/60 bg-surface/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">ESG</span>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Seu impacto vai muito além do trânsito.</h2>
            <p className="mt-4 text-muted-foreground">
              Cada Guardião contribui para um ecossistema rodoviário mais seguro, sustentável e humano. Veja em tempo real quantas vidas e árvores você ajudou a proteger.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: "12.4K", l: "Animais protegidos" },
              { v: "8.2K", l: "Árvores plantadas" },
              { v: "1.9K", l: "Vítimas socorridas" },
              { v: "320", l: "Escolas atendidas" },
            ].map((m) => (
              <div key={m.l} className="rounded-2xl border bg-card p-6">
                <Leaf className="h-5 w-5 text-primary" />
                <p className="mt-3 font-display text-3xl font-bold">{m.v}</p>
                <p className="text-xs text-muted-foreground">{m.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Concessionárias */}
      <section id="concessionarias" className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">Para Concessionárias</span>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Milhares de sensores humanos. Zero infraestrutura.</h2>
            <p className="mt-4 text-muted-foreground">
              Dashboard em tempo real com métricas por categoria, região e gravidade. Reduza tempo de resposta, aumente a percepção de segurança e demonstre valor à ANTT e à ABCR.
            </p>
            <Link to="/auth" className="mt-6 inline-block">
              <Button size="lg" variant="outline" className="gap-2">
                <Building2 className="h-4 w-4" /> Acessar painel
              </Button>
            </Link>
          </div>
          <div className="rounded-3xl border bg-card p-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { v: "↓ 38%", l: "Tempo de resposta" },
                { v: "↑ 4.2x", l: "Cobertura territorial" },
                { v: "97%", l: "Precisão por IA" },
                { v: "R$ 0", l: "Custo de sensoriamento" },
              ].map((m) => (
                <div key={m.l} className="rounded-xl bg-surface p-4">
                  <p className="font-display text-2xl font-bold text-primary">{m.v}</p>
                  <p className="text-xs text-muted-foreground">{m.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-10" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
          <h2 className="font-display text-4xl font-bold sm:text-5xl">Pronto para salvar vidas na próxima viagem?</h2>
          <p className="mt-4 text-lg text-muted-foreground">Junte-se a milhares de Guardiões que já tornam as rodovias do Brasil mais seguras.</p>
          <Link to="/auth" className="mt-8 inline-block">
            <Button size="lg" className="gap-2 text-base">
              Quero ser um Guardião <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-surface/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <RoadHeroLogo />
          <p>© {new Date().getFullYear()} RoadHero · Segurança viária colaborativa</p>
        </div>
      </footer>
    </div>
  );
}