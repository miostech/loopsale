"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";

const PLATAFORMA_OPCOES = [
  { value: "", label: "Selecione" },
  { value: "kiwify", label: "Kiwify" },
  { value: "hotmart", label: "Hotmart" },
  { value: "outro", label: "Outro" },
];

const FATURAMENTO_OPCOES = [
  { value: "", label: "Selecione" },
  { value: "ate-50k", label: "Até R$ 50.000" },
  { value: "50k-250k", label: "De R$ 50k a R$ 250k" },
  { value: "250k-500k", label: "De R$ 250k a R$ 500k" },
  { value: "500k-1mi", label: "De R$ 500k a R$ 1mi" },
  { value: "acima-1mi", label: "Acima de R$ 1mi" },
];

export default function AgendamentoDemoPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome: "",
    email: "",
    contato: "",
    negocio: "",
    plataforma: "",
    faturamento: "",
    clientes: "",
    necessidade: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erro ao enviar. Tente novamente.");
        return;
      }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)] focus:border-[var(--loop-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--loop-primary)]";

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--loop-bg-alt)] flex flex-col">
        <header className="border-b border-[var(--loop-border)] bg-[var(--loop-bg)]">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-6">
            <Link
              href="/"
              className="text-sm font-medium text-[var(--loop-primary)] hover:underline"
            >
              Voltar
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-2xl border border-[var(--loop-border)] bg-[var(--loop-bg)] p-8 text-center">
            <p className="text-4xl mb-4">✓</p>
            <h1 className="text-xl font-bold text-[var(--loop-text)]">
              Demo agendada!
            </h1>
            <p className="mt-3 text-[var(--loop-text-muted)]">
              Entraremos em contato em até 24h úteis para agendar sua
              demonstração.
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button variant="cta">Voltar ao início</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--loop-bg-alt)] flex flex-col">
      <header className="border-b border-[var(--loop-border)] bg-[var(--loop-bg)]">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-6">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--loop-primary)] hover:underline"
          >
            Voltar
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-10 md:py-16">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-bold uppercase tracking-wide text-[var(--loop-text)] md:text-3xl">
            Agendar uma demo
          </h1>
          <p className="mt-4 text-center text-lg font-medium text-[var(--loop-text)]">
            Opa, falta apenas um passo para ver a LoopSale em ação
          </p>
          <p className="mt-2 text-center text-[var(--loop-text-muted)]">
            Complete os campos para liberar o acesso à demonstração da
            plataforma.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <p className="text-sm text-[var(--loop-error)]">{error}</p>
            )}

            <Input
              label="Nome completo"
              name="nome"
              type="text"
              placeholder="Seu nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
            />
            <Input
              label="E-mail"
              name="email"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Contato"
              name="contato"
              type="tel"
              placeholder="(11) 99999-9999"
              value={form.contato}
              onChange={(e) =>
                setForm((f) => ({ ...f, contato: e.target.value }))
              }
            />
            <Input
              label="Seu infoproduto / negócio"
              name="negocio"
              type="text"
              placeholder="Nome do seu produto ou empresa"
              value={form.negocio}
              onChange={(e) =>
                setForm((f) => ({ ...f, negocio: e.target.value }))
              }
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Plataforma
              </label>
              <select
                name="plataforma"
                value={form.plataforma}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plataforma: e.target.value }))
                }
                className={inputClass}
                required
              >
                {PLATAFORMA_OPCOES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Faturamento mensal
              </label>
              <select
                name="faturamento"
                value={form.faturamento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, faturamento: e.target.value }))
                }
                className={inputClass}
                required
              >
                {FATURAMENTO_OPCOES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Clientes / leads cadastrados (aproximado)"
              name="clientes"
              type="text"
              placeholder="Ex: 5.000 ou faixa"
              value={form.clientes}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientes: e.target.value }))
              }
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Necessidade
              </label>
              <textarea
                name="necessidade"
                rows={3}
                placeholder="Conte um pouco do que você precisa: recuperação de checkout, pós-venda, automação..."
                value={form.necessidade}
                onChange={(e) =>
                  setForm((f) => ({ ...f, necessidade: e.target.value }))
                }
                className={inputClass}
              />
            </div>

            <Button
              type="submit"
              variant="cta"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Enviando..." : "Agende a demo"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
