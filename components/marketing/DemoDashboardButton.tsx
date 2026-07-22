"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

/**
 * Botão que cria o usuário demo (se não existir) e faz login direto no dashboard.
 * Só funciona em desenvolvimento.
 */
export function DemoDashboardButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const ensure = await fetch("/api/auth/ensure-demo-user");
      if (!ensure.ok) {
        window.location.href = "/login";
        return;
      }
      const { email, password } = await ensure.json();
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (res?.ok) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/login";
      }
    } catch {
      window.location.href = "/login";
    }
    setLoading(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? "Entrando…" : "Ver dashboard"}
    </Button>
  );
}
