import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginPath } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoadHeroLogo } from "@/components/RoadHeroLogo";
import { authErrorMessage } from "@/lib/auth-errors";
import { toast } from "sonner";
import { ArrowLeft, Building2, Globe2, Loader2, Shield } from "lucide-react";

type Portal = "guardiao" | "concessionaria" | "abcr";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — RoadHero" },
      { name: "description", content: "Acesse como Guardião, Concessionária ou ABCR." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [portal, setPortal] = useState<Portal>("guardiao");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const path = await resolvePostLoginPath();
        nav({ to: path as "/app", replace: true });
      }
    })();

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const authError =
      params.get("error_description") ??
      params.get("error") ??
      hashParams.get("error_description") ??
      hashParams.get("error");
    if (authError) {
      toast.error(decodeURIComponent(authError.replace(/\+/g, " ")));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [nav]);

  async function afterLogin() {
    const path = await resolvePostLoginPath();
    if (portal === "concessionaria" && path !== "/concessionaria" && path !== "/abcr") {
      toast.error("Esta conta não tem perfil de concessionária. Use o portal Guardião ou solicite acesso à ABCR.");
      return;
    }
    if (portal === "abcr" && path !== "/abcr") {
      toast.error("Esta conta não tem perfil ABCR.");
      return;
    }
    if (portal === "guardiao" && (path === "/concessionaria" || path === "/abcr")) {
      nav({ to: path as "/concessionaria", replace: true });
      return;
    }
    nav({ to: (portal === "guardiao" ? "/app" : path) as "/app", replace: true });
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      toast.error(authErrorMessage(error));
      setGoogleLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden gradient-hero lg:flex lg:flex-col lg:justify-between lg:p-12">
        <RoadHeroLogo />
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Segurança viária<br /> em todo o Brasil.
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Guardiões reportam. Concessionárias respondem. A ABCR enxerga o país inteiro.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© RoadHero · ABCR</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="mb-8 lg:hidden"><RoadHeroLogo /></div>

          <Tabs value={portal} onValueChange={(v) => setPortal(v as Portal)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="guardiao" className="gap-1 text-xs sm:text-sm">
                <Shield className="h-3.5 w-3.5" /> Guardião
              </TabsTrigger>
              <TabsTrigger value="concessionaria" className="gap-1 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5" /> Concessionária
              </TabsTrigger>
              <TabsTrigger value="abcr" className="gap-1 text-xs sm:text-sm">
                <Globe2 className="h-3.5 w-3.5" /> ABCR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guardiao" className="mt-4">
              <PortalIntro
                title="Portal do Guardião"
                desc="Reporte ocorrências, ganhe pontos e torne as rodovias mais seguras."
              />
            </TabsContent>
            <TabsContent value="concessionaria" className="mt-4">
              <PortalIntro
                title="Portal da Concessionária"
                desc="Gerencie alertas, pedágios e o trecho da sua via pedagiada."
              />
            </TabsContent>
            <TabsContent value="abcr" className="mt-4">
              <PortalIntro
                title="Portal ABCR"
                desc="Visão nacional, gestão de concessionárias e insights sem limitação viária."
              />
            </TabsContent>
          </Tabs>

          <Button onClick={handleGoogle} disabled={googleLoading} variant="outline" className="mt-4 w-full gap-2">
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continuar com Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou e-mail <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup" disabled={portal !== "guardiao"}>Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm onSuccess={afterLogin} /></TabsContent>
            <TabsContent value="signup"><SignupForm onSuccess={afterLogin} /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function PortalIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) return toast.error(authErrorMessage(error));
    toast.success("Bem-vindo!");
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="senha">Senha</Label>
        <Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin + "/app", data: { nome, cidade } },
    });
    setLoading(false);
    if (error) return toast.error(authErrorMessage(error));
    if (data.session) {
      toast.success("Conta criada!");
      onSuccess();
      return;
    }
    toast.success("Verifique seu e-mail para confirmar o cadastro.");
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="nome">Nome</Label><Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><Label htmlFor="cidade">Cidade</Label><Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
      </div>
      <div><Label htmlFor="email2">E-mail</Label><Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="senha2">Senha</Label><Input id="senha2" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta de Guardião"}
      </Button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12s4.2 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
