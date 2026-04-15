"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { Badge } from "@/components/ui";

interface TimelineItem {
  type: string;
  date: string;
  data?: { product?: string; amount?: string; platform?: string; recoveredAt?: string };
}

interface LeadDetail {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  source: string;
  timeline: TimelineItem[];
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [lead, setLead] = useState<LeadDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/leads/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setLead)
      .catch(() => setLead(null));
  }, [id]);

  if (!lead) {
    return (
      <div>
        <Link href="/dashboard/leads" className="text-[var(--loop-primary)] hover:underline mb-4 inline-block">
          ← Voltar aos leads
        </Link>
        <p className="text-[var(--loop-text-muted)]">Lead não encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/leads" className="text-[var(--loop-primary)] hover:underline mb-4 inline-block">
        ← Voltar aos leads
      </Link>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--loop-text)]">
                {lead.name ?? lead.email ?? lead.phone ?? "Lead"}
              </h1>
              <p className="text-sm text-[var(--loop-text-muted)] mt-1">
                {lead.email ?? "—"} {lead.phone ? ` • ${lead.phone}` : ""}
              </p>
            </div>
            <Badge
              variant={
                lead.status === "purchased"
                  ? "success"
                  : lead.status === "hot"
                    ? "cta"
                    : "default"
              }
            >
              {lead.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Histórico de interações
          </h2>
        </CardHeader>
        <CardContent>
          {lead.timeline.length === 0 ? (
            <p className="text-[var(--loop-text-muted)]">
              Nenhum evento registrado.
            </p>
          ) : (
            <ul className="space-y-3">
              {lead.timeline.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 border-l-2 border-[var(--loop-border)] pl-4 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--loop-text)] capitalize">
                      {item.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-[var(--loop-text-muted)]">
                      {new Date(item.date).toLocaleString("pt-BR")}
                    </p>
                    {item.data?.product && (
                      <p className="text-sm text-[var(--loop-text-muted)] mt-1">
                        Produto: {item.data.product}
                        {item.data.amount && ` • R$ ${item.data.amount}`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
