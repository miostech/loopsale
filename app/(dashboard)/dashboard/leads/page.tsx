"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { Badge } from "@/components/ui";

interface Lead {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  source: string;
  updatedAt: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setLeads([]));
  }, [search]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--loop-text)] mb-6">
        Leads
      </h1>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Base de leads
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Histórico de interações, status e segmentações. Total: {total}
          </p>
          <input
            type="search"
            placeholder="Buscar por email, telefone ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 w-full max-w-md rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)]"
          />
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-[var(--loop-text-muted)]">
              Nenhum lead ainda. Os leads aparecerão aqui após eventos de
              checkout e mensagens enviadas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                    <th className="pb-2 pr-4">Email / Telefone</th>
                    <th className="pb-2 pr-4">Nome</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Origem</th>
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-[var(--loop-border)]"
                    >
                      <td className="py-3 pr-4">
                        {lead.email ?? lead.phone ?? "—"}
                      </td>
                      <td className="py-3 pr-4">{lead.name ?? "—"}</td>
                      <td className="py-3 pr-4">
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
                      </td>
                      <td className="py-3 pr-4">{lead.source}</td>
                      <td className="py-3">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="text-[var(--loop-primary)] hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
