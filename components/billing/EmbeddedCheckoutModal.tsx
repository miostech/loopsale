"use client";

import { useCallback } from "react";
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
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, embedded: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.clientSecret) {
      throw new Error(data.error ?? "Não foi possível iniciar o checkout.");
    }
    return data.clientSecret as string;
  }, [payload]);

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
          {stripePromise ? (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <p className="p-4 text-sm text-[var(--loop-error)]">
              Chave publicável do Stripe não configurada
              (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
