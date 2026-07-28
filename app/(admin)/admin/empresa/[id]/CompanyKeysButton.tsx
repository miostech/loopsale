"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

interface IntegrationView {
  platform: string;
  active: boolean;
  config: Record<string, unknown>;
  webhookUrl: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
  n8n: "Loop API",
};

function KeyRow({ k, v }: { k: string; v: unknown }) {
  const val = v == null || v === "" ? "—" : String(v);
  return (
    <div className="flex gap-2 py-0.5">
      <span className="min-w-32 shrink-0 text-[var(--loop-text-muted)]">{k}</span>
      <code className="break-all text-[var(--loop-text)]">{val}</code>
    </div>
  );
}

export function CompanyKeysButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationView[] | null>(null);
  const [error, setError] = useState("");

  async function openModal() {
    setOpen(true);
    if (integrations) return; // já carregado
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/empresa/${companyId}/keys`);
      if (!res.ok) {
        setError("Não foi possível carregar as chaves.");
        return;
      }
      const data = await res.json();
      setIntegrations(data.integrations ?? []);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openModal}>
        Ver chaves
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="my-8 w-full max-w-lg rounded-xl bg-[var(--loop-bg)] shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--loop-border)] px-4 py-3">
              <span className="font-semibold text-[var(--loop-text)]">
                Chaves de integração
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-xl leading-none text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-4 text-xs">
              {loading ? (
                <p className="text-[var(--loop-text-muted)]">Carregando…</p>
              ) : error ? (
                <p className="text-[var(--loop-error)]">{error}</p>
              ) : !integrations || integrations.length === 0 ? (
                <p className="text-[var(--loop-text-muted)]">
                  Nenhuma integração conectada para esta empresa.
                </p>
              ) : (
                integrations.map((i) => (
                  <div
                    key={i.platform}
                    className="space-y-1 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3"
                  >
                    <p className="font-semibold text-[var(--loop-text)]">
                      {PLATFORM_LABEL[i.platform] ?? i.platform}{" "}
                      {i.active ? "" : "(inativa)"}
                    </p>
                    {Object.entries(i.config).map(([k, v]) => (
                      <KeyRow key={k} k={k} v={v} />
                    ))}
                    {i.webhookUrl && <KeyRow k="webhookUrl" v={i.webhookUrl} />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
