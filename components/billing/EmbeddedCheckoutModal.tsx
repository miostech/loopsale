"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk ? loadStripe(pk) : null;

interface Props {
  /** Corpo enviado ao /api/billing/checkout, ex: { plan: "pro" } ou { addon: "support" }. */
  payload: Record<string, unknown>;
  title?: string;
  onClose: () => void;
}

export function EmbeddedCheckoutModal({ payload, title, onClose }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Serializado para não refazer o efeito a cada render do pai.
  const payloadKey = JSON.stringify(payload);

  // O secret é buscado aqui, e não pelo fetchClientSecret do Stripe: se a
  // criação da sessão falha, o Stripe troca a causa real por um genérico
  // "Something went wrong" e o motivo se perde.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...JSON.parse(payloadKey), embedded: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.clientSecret) {
          throw new Error(
            data.error ?? `Não foi possível iniciar o checkout (HTTP ${res.status}).`
          );
        }
        if (!cancelled) setClientSecret(data.clientSecret as string);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Erro de rede ao iniciar o checkout."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payloadKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-8 w-full max-w-xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--loop-border)] px-4 py-3">
          <span className="font-semibold text-[var(--loop-text)]">
            {title ?? "Finalizar assinatura"}
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
        <div className="p-2">
          {!stripePromise ? (
            <p className="p-4 text-sm text-[var(--loop-error)]">
              Chave publicável do Stripe não configurada
              (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
            </p>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm font-medium text-[var(--loop-error)]">
                Não foi possível abrir o checkout.
              </p>
              <p className="mt-1 text-sm text-[var(--loop-text-muted)]">{error}</p>
            </div>
          ) : !clientSecret ? (
            <p className="p-4 text-sm text-[var(--loop-text-muted)]">
              Carregando checkout…
            </p>
          ) : (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </div>
    </div>
  );
}
