import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoadHeroLogo } from "@/components/RoadHeroLogo";
import { authErrorMessage } from "@/lib/auth-errors";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — RoadHero" },
      { name: "description", content: "Acesse sua conta de Guardião ou crie uma nova em 30 segundos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/app", replace: true });
    });

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

  async function handleGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app`,
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
            Sua próxima viagem<br /> pode salvar vidas.
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Milhares de Guardiões já fazem das rodovias do Brasil um lugar mais seguro. Junte-se a eles.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© RoadHero</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="mb-8 lg:hidden"><RoadHeroLogo /></div>
          <h1 className="font-display text-3xl font-bold">Bem-vindo, Guardião</h1>
          <p className="mt-1 text-muted-foreground">Entre ou crie sua conta para começar.</p>

          <Button onClick={handleGoogle} disabled={googleLoading} variant="outline" className="mt-6 w-full gap-2">
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continuar com Google
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Se o Google não funcionar, use e-mail e senha abaixo.
          </p>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou e-mail <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) return toast.error(authErrorMessage(error));
    toast.success("Bem-vindo de volta!");
    nav({ to: "/app", replace: true });
  }

  async function reset() {
    if (!email) return toast.error("Informe seu e-mail acima primeiro");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth" });
    if (error) return toast.error(authErrorMessage(error));
    toast.success("Enviamos um link de recuperação");
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
      <button type="button" onClick={reset} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
        Esqueci minha senha
      </button>
    </form>
  );
}

function SignupForm() {
  const nav = useNavigate();
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
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { nome, cidade },
      },
    });
    setLoading(false);
    if (error) return toast.error(authErrorMessage(error));

    if (data.session) {
      toast.success("Conta criada com sucesso!");
      nav({ to: "/app", replace: true });
      return;
    }

    toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="email2">E-mail</Label>
        <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="senha2">Senha</Label>
        <Input id="senha2" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
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
