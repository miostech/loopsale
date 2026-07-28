"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";

export default function RegistroPage() {
  const [name, setName] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [platform, setPlatform] = useState<"kiwify" | "hotmart" | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!empresa.trim()) {
      setError("Informe o nome da sua empresa.");
      return;
    }
    if (!platform) {
      setError("Escolha a plataforma que você usa (Kiwify ou Hotmart).");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, empresa, platform }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Erro ao cadastrar.");
      return;
    }
    // Cadastro OK: já faz login e entra direto no dashboard.
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (login?.ok) {
      window.location.href = "/dashboard";
    } else {
      // Conta criada, mas o login automático falhou: cai no login manual.
      router.push("/login");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--loop-bg-alt)]">
      <Link
        href="/"
        aria-label="Voltar para a página inicial"
        className="mb-8 inline-block"
      >
        <LoopSaleLogo />
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-[var(--loop-text)]">
            Criar conta
          </h1>
          <p className="text-sm text-[var(--loop-text-muted)] mt-1">
            Comece a recuperar vendas com a LoopSale
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-[var(--loop-error)]">{error}</p>
            )}
            <Input
              label="Seu nome"
              name="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Nome da empresa"
              name="empresa"
              type="text"
              placeholder="Ex: Minha Loja Digital"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Qual plataforma você usa?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(["kiwify", "hotmart"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    aria-pressed={platform === p}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium capitalize transition ${
                      platform === p
                        ? "border-[var(--loop-primary)] bg-[var(--loop-primary-muted)] text-[var(--loop-primary)]"
                        : "border-[var(--loop-border)] text-[var(--loop-text-muted)] hover:border-[var(--loop-primary)]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
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
              {loading ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </form>
          <p className="text-center text-sm text-[var(--loop-text-muted)]">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-[var(--loop-primary)] hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
