import { Link, useRouter } from "@tanstack/react-router";
import { RoadHeroLogo } from "./RoadHeroLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Map, Trophy, Gift, Leaf, Sparkles, Layout, PlusCircle, Menu, Navigation, Car } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReportRateLimit } from "@/hooks/useReportRateLimit";
import { toast } from "sonner";

const NAV = [
  { to: "/app", label: "Mapa", icon: Navigation },
  { to: "/painel", label: "Painel", icon: Layout },
  { to: "/veiculos", label: "Veículos", icon: Car },
  { to: "/mapa", label: "Ocorrências", icon: Map },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/recompensas", label: "Recompensas", icon: Gift },
  { to: "/impacto", label: "Impacto", icon: Leaf },
  { to: "/guardiao", label: "Guardião IA", icon: Sparkles },
];

export function AppHeader() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const rateLimit = useReportRateLimit();

  function handleReportarClick(e: React.MouseEvent) {
    if (!rateLimit.allowed) {
      e.preventDefault();
      toast.error(rateLimit.message);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/app"><RoadHeroLogo /></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface hover:text-foreground"
              activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-surface text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/reportar"
            className="hidden sm:block"
            onClick={handleReportarClick}
          >
            <Button className="gap-2" disabled={!rateLimit.allowed}>
              <PlusCircle className="h-4 w-4" /> Reportar
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-border/60 px-4 py-3 lg:hidden">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
          <Link
            to="/reportar"
            onClick={(e) => {
              setOpen(false);
              handleReportarClick(e);
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold sm:hidden ${
              rateLimit.allowed
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground pointer-events-none opacity-60"
            }`}
          >
            <PlusCircle className="h-4 w-4" /> Reportar
          </Link>
        </nav>
      )}
    </header>
  );
}
