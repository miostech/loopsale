"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { NUMBER_ADDON } from "@/lib/billing/plans";
import { EmbeddedCheckoutModal } from "@/components/billing/EmbeddedCheckoutModal";

type Etapa = "escolha" | "proprio" | "loop" | "pagamento" | "pedido-enviado";

/** R$ 49,90 — sem isso, 49.9 apareceria como "49.9" para o cliente. */
function brl(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

interface Props {
  /** Dispara o Embedded Signup (FB.login) — só depois do aviso ser aceito. */
  onConectarProprio: () => void;
  onClose: () => void;
}

/**
 * Antes de abrir o Embedded Signup, pergunta de onde vem o número. O aviso de
 * que a linha deixa de funcionar nos apps do WhatsApp é obrigatório: é a
 * reclamação mais cara de resolver depois que o número já migrou.
 */
export function WhatsAppSetupModal({ onConectarProprio, onClose }: Props) {
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [cienteApps, setCienteApps] = useState(false);
  const [erro, setErro] = useState("");

  // O pedido não é criado aqui: quem abre é o webhook do Stripe, quando a
  // assinatura fica ativa. Sem pagamento não existe pedido para provisionar.
  if (etapa === "pagamento") {
    return (
      <EmbeddedCheckoutModal
        payload={{ addon: "number" }}
        title="Ativação do número"
        onClose={() => setEtapa("loop")}
        onComplete={() => setEtapa("pedido-enviado")}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-8 w-full max-w-lg rounded-xl bg-[var(--loop-bg)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--loop-border)] px-5 py-3">
          <span className="font-semibold text-[var(--loop-text)]">
            Conectar WhatsApp
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-xl leading-none text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          {etapa === "escolha" && (
            <>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Qual número você vai usar nas mensagens de recuperação?
              </p>

              <button
                type="button"
                onClick={() => setEtapa("proprio")}
                className="w-full rounded-xl border border-[var(--loop-border)] p-4 text-left transition-colors hover:border-[var(--loop-primary)]"
              >
                <span className="font-semibold text-[var(--loop-text)]">
                  Vou usar um número meu
                </span>
                <span className="mt-1 block text-sm text-[var(--loop-text-muted)]">
                  Você já tem a linha. Conecta agora e começa a enviar.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEtapa("loop")}
                className="w-full rounded-xl border border-[var(--loop-border)] p-4 text-left transition-colors hover:border-[var(--loop-primary)]"
              >
                <span className="font-semibold text-[var(--loop-text)]">
                  Quero um número LoopSale
                </span>
                <span className="mt-1 block text-sm text-[var(--loop-text-muted)]">
                  A gente fornece a linha e cuida da ativação. Serviço adicional.
                </span>
              </button>
            </>
          )}

          {etapa === "proprio" && (
            <>
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--loop-error)_35%,var(--loop-border))] bg-[color-mix(in_srgb,var(--loop-error)_6%,transparent)] p-4">
                <p className="font-semibold text-[var(--loop-text)]">
                  Leia antes de continuar
                </p>
                <p className="mt-2 text-sm text-[var(--loop-text)]">
                  Ao conectar, o número passa a ser da API do WhatsApp. A partir
                  daí, ele <strong>deixa de funcionar no WhatsApp normal e no
                  WhatsApp Business</strong> — você não vai mais conseguir usar
                  esse número naqueles aplicativos, nem no celular.
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-[var(--loop-text-muted)]">
                  <li>
                    • O histórico de conversas dos aplicativos não vem junto.
                  </li>
                  <li>
                    • As conversas passam a acontecer aqui dentro da LoopSale.
                  </li>
                  <li>
                    • Para voltar atrás é preciso remover o número da API, e o
                    processo leva tempo.
                  </li>
                </ul>
                <p className="mt-3 text-sm text-[var(--loop-text)]">
                  Por isso, não use o número que você usa para falar com clientes
                  no dia a dia.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--loop-text)]">
                <input
                  type="checkbox"
                  checked={cienteApps}
                  onChange={(e) => setCienteApps(e.target.checked)}
                  className="mt-0.5"
                />
                Entendi que esse número não vai mais funcionar no WhatsApp normal
                nem no WhatsApp Business.
              </label>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="cta"
                  size="sm"
                  disabled={!cienteApps}
                  onClick={onConectarProprio}
                >
                  Conectar meu número
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEtapa("escolha")}
                >
                  Voltar
                </Button>
              </div>
            </>
          )}

          {etapa === "loop" && (
            <>
              <p className="font-semibold text-[var(--loop-text)]">
                {NUMBER_ADDON.name}
              </p>
              <p className="text-sm text-[var(--loop-text-muted)]">
                {NUMBER_ADDON.description}
              </p>

              <ul className="space-y-1.5 text-sm text-[var(--loop-text)]">
                {NUMBER_ADDON.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>

              <div className="rounded-xl border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-4 text-sm">
                <p className="text-[var(--loop-text)]">
                  Ativação de {brl(NUMBER_ADDON.activationFee)} (uma vez) +{" "}
                  {brl(NUMBER_ADDON.priceMonthly)}/mês.
                </p>
                <p className="mt-2 text-[var(--loop-text-muted)]">
                  {NUMBER_ADDON.scopeNote}
                </p>
              </div>

              <p className="text-sm text-[var(--loop-text-muted)]">
                O número fornecido também é da API: ele não funciona no WhatsApp
                normal nem no WhatsApp Business.
              </p>

              {erro && (
                <p className="text-sm text-[var(--loop-error)]">{erro}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="cta"
                  size="sm"
                  onClick={() => setEtapa("pagamento")}
                >
                  Solicitar número
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEtapa("escolha")}
                >
                  Voltar
                </Button>
              </div>
            </>
          )}

          {etapa === "pedido-enviado" && (
            <>
              <p className="font-semibold text-[var(--loop-text)]">
                Pagamento confirmado
              </p>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Recebemos a ativação. O time da LoopSale vai providenciar a linha
                e entrar em contato com você para concluir a ativação na Meta e
                registrar o número na sua conta do WhatsApp Business.
              </p>
              <Button variant="cta" size="sm" onClick={onClose}>
                Fechar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
