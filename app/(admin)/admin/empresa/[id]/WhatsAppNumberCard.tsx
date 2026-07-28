"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

export function WhatsAppNumberCard({
  companyId,
  initialPhoneNumberId,
  initialDisplayNumber,
}: {
  companyId: string;
  initialPhoneNumberId: string;
  initialDisplayNumber: string;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [displayNumber, setDisplayNumber] = useState(initialDisplayNumber);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const connected = !!initialPhoneNumberId;

  async function save() {
    setMsg({});
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/empresa/${companyId}/whatsapp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, displayNumber }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ err: data.error ?? "Erro ao salvar." });
      else setMsg({ ok: "Número salvo." });
    } catch {
      setMsg({ err: "Erro de rede." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">
            WhatsApp (número do cliente)
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Phone Number ID desta empresa dentro da WABA central da LoopSale.
          </p>
        </div>
        <Badge variant={connected ? "success" : "default"}>
          {connected ? "Número atribuído" : "Sem número"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone Number ID"
            placeholder="ex: 123456789012345"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
          <Input
            label="Número exibido (informativo)"
            placeholder="+55 11 99999-8888"
            value={displayNumber}
            onChange={(e) => setDisplayNumber(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="cta" size="sm" disabled={saving} onClick={save}>
            {saving ? "Salvando…" : "Salvar número"}
          </Button>
          {msg.ok && (
            <span className="text-sm text-[var(--loop-success)]">{msg.ok}</span>
          )}
          {msg.err && (
            <span className="text-sm text-[var(--loop-error)]">{msg.err}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
