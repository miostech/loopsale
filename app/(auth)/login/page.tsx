"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email ou senha inválidos.");
      return;
    }
    if (res?.ok) window.location.href = callbackUrl;
  }

  const DEMO_EMAIL = "demo@loopsale.com";
  const DEMO_PASSWORD = "demo123";

  async function handleDemoLogin() {
    setError("");
    setLoading(true);
    try {
      const ensure = await fetch("/api/auth/ensure-demo-user");
      let email = DEMO_EMAIL;
      let password = DEMO_PASSWORD;
      if (ensure.ok) {
        const data = await ensure.json().catch(() => ({}));
        if (data.email) email = data.email;
        if (data.password) password = data.password;
      }
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (res?.error) {
        setError(
          ensure.ok
            ? "Erro ao entrar no demo."
            : "Demo indisponível. Com banco desligado, use DATABASE_DISABLED=true e o botão demo; com MongoDB, verifique a conexão."
        );
        setLoading(false);
        return;
      }
      if (res?.ok) window.location.href = "/dashboard";
    } catch {
      setError("Erro ao entrar no demo.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--loop-bg-alt)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-[var(--loop-text)]">Entrar</h1>
          <p className="text-sm text-[var(--loop-text-muted)] mt-1">
            Acesse sua conta LoopSale
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-[var(--loop-error)]">{error}</p>
            )}
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="cta"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Entrando…" : "Entrar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={handleDemoLogin}
            >
              Ir direto para o dashboard (demo)
            </Button>
          </form>
          <p className="text-center text-sm text-[var(--loop-text-muted)]">
            Não tem conta?{" "}
            <Link
              href="/login/registro"
              className="text-[var(--loop-primary)] hover:underline"
            >
              Cadastre-se
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--loop-bg-alt)]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <p className="text-[var(--loop-text-muted)]">Carregando…</p>
          </CardContent>
        </Card>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
