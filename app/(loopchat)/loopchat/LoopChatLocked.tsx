"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { CHAT_ADDON } from "@/lib/billing/plans";

function brl(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function LoopChatLocked({
  isAdmin,
  motivo = "free",
  cota = null,
  usadas = 0,
}: {
  isAdmin: boolean;
  /** "over" = estourou a cota do plano; "free" = plano sem chat grátis. */
  motivo?: "over" | "free";
  cota?: number | null;
  usadas?: number;
}) {
  const router = useRouter();
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");

  // TEMPORÁRIO: libera sem pagar para testar a área de mensagens. Quando o
  // preço existir no Stripe, volta a abrir o EmbeddedCheckoutModal com
  // payload { addon: "chat", embedded: true }.
  async function ativar() {
    setErro("");
    setAtivando(true);
    try {
      const res = await fetch("/api/loopchat/ativar-teste", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível ativar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de rede ao ativar.");
    } finally {
      setAtivando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">LoopChat</h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          {CHAT_ADDON.description}
        </p>
      </div>

      {motivo === "over" && cota !== null && (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--loop-error)_35%,var(--loop-border))] bg-[color-mix(in_srgb,var(--loop-error)_6%,transparent)] p-4 text-sm">
          <p className="font-medium text-[var(--loop-text)]">
            Você passou do limite de conversas grátis deste mês
          </p>
          <p className="mt-1 text-[var(--loop-text-muted)]">
            Seu plano inclui {cota.toLocaleString("pt-BR")} conversas/mês no
            LoopChat e você já usou {usadas.toLocaleString("pt-BR")}. Para
            continuar respondendo, contrate o LoopChat abaixo. No próximo mês a
            cota do plano zera e o chat volta a liberar sozinho.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Ative o LoopChat
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1.5 text-sm text-[var(--loop-text)]">
            {CHAT_ADDON.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>

          <div className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-4 text-sm">
            <p className="text-[var(--loop-text)]">
              {brl(CHAT_ADDON.priceMonthly)}/mês
            </p>
            <p className="mt-2 text-[var(--loop-text-muted)]">
              As mensagens continuam sendo cobradas pela Meta na sua conta.
            </p>
          </div>

          {isAdmin ? (
            <>
              <Button
                variant="cta"
                size="sm"
                disabled={ativando}
                onClick={ativar}
              >
                {ativando ? "Ativando…" : "Contratar LoopChat"}
              </Button>
              <p className="text-xs text-[var(--loop-text-muted)]">
                Modo de teste: libera sem cobrança enquanto o preço não está no
                Stripe.
              </p>
              {erro && (
                <p className="text-sm text-[var(--loop-error)]">{erro}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--loop-text-muted)]">
              Peça ao administrador da conta para contratar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
