"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { Button } from "@/components/ui";

export default function ConfiguracoesPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/me/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loopsale-dados-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Tem certeza? Todos os dados da conta serão excluídos permanentemente.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/me/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = "/login";
      } else {
        alert(data.error ?? "Erro ao excluir conta.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--loop-text)] mb-6">
        Configurações
      </h1>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">Conta</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Dados da conta e preferências.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[var(--loop-text-muted)]">
            Edição de perfil, notificações e membros da conta em breve.
          </p>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Privacidade e dados (LGPD)
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Exporte ou exclua seus dados conforme a Lei Geral de Proteção de Dados.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exportando…" : "Exportar meus dados"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="text-[var(--loop-error)] hover:bg-red-50"
          >
            {deleting ? "Excluindo…" : "Excluir conta e dados"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
