"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input } from "@/components/ui";

interface Membro {
  id: string;
  name: string | null;
  email: string;
  isSelf?: boolean;
}
interface Etiqueta {
  nome: string;
  total: number;
}
interface Conversa {
  contact: string;
  status: string;
  snoozedUntil: string | null;
  assigneeId: string | null;
  assigneeNome: string | null;
  labels: string[];
  priority: string | null;
  nome: string | null;
  ultimaEm: string;
  ultimoTexto: string | null;
  ultimaDirecao: string;
  janelaAberta: boolean;
  naoLidas: number;
  total: number;
}
interface Mensagem {
  id: string;
  direction: "in" | "out";
  internal?: boolean;
  authorName?: string | null;
  body: string | null;
  type?: string;
  templateName?: string | null;
  status: string | null;
  error: string | null;
  createdAt: string;
}
interface Checkout {
  produto: string;
  valor: string | null;
  moeda: string;
  situacao: string;
  em: string;
}
interface Ficha {
  lead: {
    nome: string | null;
    email: string | null;
    telefone: string | null;
    status: string | null;
    tags: string[];
    desde: string | null;
  } | null;
  checkouts: Checkout[];
}

type Filtro =
  | "abertas"
  | "minhas"
  | "nao-atribuidas"
  | "nao-respondidas"
  | "janela"
  | "pendentes"
  | "adiadas"
  | "resolvidas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "abertas", label: "Abertas" },
  { id: "minhas", label: "Minhas" },
  { id: "nao-atribuidas", label: "Não atribuídas" },
  { id: "nao-respondidas", label: "Não respondidas" },
  { id: "janela", label: "Dentro das 24h" },
  { id: "pendentes", label: "Pendentes" },
  { id: "adiadas", label: "Adiadas" },
  { id: "resolvidas", label: "Resolvidas" },
];

/** Filtros que mostram conversas fora do board de abertas. */
const FILTRO_STATUS: Partial<Record<Filtro, string>> = {
  pendentes: "pending",
  adiadas: "snoozed",
  resolvidas: "resolved",
};

const ADIAMENTOS: { id: string; label: string }[] = [
  { id: "1h", label: "por 1 hora" },
  { id: "24h", label: "até amanhã" },
  { id: "7d", label: "por 1 semana" },
];

/** Status de entrega da Meta em símbolo, como no WhatsApp. */
const TICK: Record<string, string> = {
  accepted: "✓",
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
  failed: "!",
};

const SITUACAO_BADGE: Record<string, "success" | "warning" | "default"> = {
  recuperado: "success",
  pago: "success",
  "em aberto": "warning",
};

function horaCurta(iso: string): string {
  const d = new Date(iso);
  const mesmoDia = d.toDateString() === new Date().toDateString();
  return mesmoDia
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function horaCompleta(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** +55 11 90000-0000 a partir dos dígitos E.164 que a Meta devolve. */
function telefone(d: string): string {
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+${d}`;
}

/** Prioridade: rótulo, cor e peso de ordenação (menor = mais urgente). */
const PRIORIDADES: Record<
  string,
  { label: string; cor: string; peso: number }
> = {
  urgent: { label: "Urgente", cor: "#dc2626", peso: 0 },
  high: { label: "Alta", cor: "#ea580c", peso: 1 },
  medium: { label: "Média", cor: "#ca8a04", peso: 2 },
  low: { label: "Baixa", cor: "#64748b", peso: 3 },
};

function pesoPrioridade(p: string | null): number {
  return p ? PRIORIDADES[p]?.peso ?? 4 : 4;
}

/**
 * Cor da etiqueta derivada do nome: a mesma etiqueta fica sempre da mesma cor,
 * sem precisar de catálogo nem de escolher cor na hora de criar.
 */
const CORES_ETIQUETA = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
];

function corDaEtiqueta(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES_ETIQUETA[h % CORES_ETIQUETA.length];
}

function iniciais(nome: string | null, contato: string): string {
  if (nome) {
    const p = nome.trim().split(/\s+/);
    return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
  }
  return contato.slice(-2);
}

export function LoopChatClient({
  whatsappConectado,
}: {
  whatsappConectado: boolean;
}) {
  const [conversas, setConversas] = useState<Conversa[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [resolvendo, setResolvendo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [usuarioAtual, setUsuarioAtual] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
  const [janelaAberta, setJanelaAberta] = useState(true);
  const [texto, setTexto] = useState("");
  const [modoNota, setModoNota] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const loadConversas = useCallback(async () => {
    const res = await fetch("/api/loopchat/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversas(data.conversas ?? []);
    setUsuarioAtual(data.usuarioAtual ?? null);
    setEtiquetas(data.etiquetas ?? []);
  }, []);

  const loadMembros = useCallback(async () => {
    const res = await fetch("/api/account/members");
    if (!res.ok) return;
    setMembros(await res.json());
  }, []);

  const loadMensagens = useCallback(async (contact: string) => {
    const res = await fetch(
      `/api/loopchat/messages?contact=${encodeURIComponent(contact)}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setMensagens(data.mensagens ?? []);
    setJanelaAberta(!!data.janelaAberta);
  }, []);

  const loadFicha = useCallback(async (contact: string) => {
    setFicha(null);
    const res = await fetch(
      `/api/loopchat/contact?contact=${encodeURIComponent(contact)}`
    );
    if (!res.ok) return;
    setFicha(await res.json());
  }, []);

  useEffect(() => {
    loadConversas();
    loadMembros();
  }, [loadConversas, loadMembros]);

  useEffect(() => {
    if (!ativo) return;
    loadMensagens(ativo);
    loadFicha(ativo);
  }, [ativo, loadMensagens, loadFicha]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  const contagens = useMemo(() => {
    const c = conversas ?? [];
    // "Abertas" é só o que exige ação agora: pendente, adiada e resolvida têm
    // board próprio.
    const abertas = c.filter((x) => x.status === "open");
    return {
      abertas: abertas.length,
      minhas: abertas.filter((x) => x.assigneeId === usuarioAtual).length,
      "nao-atribuidas": abertas.filter((x) => !x.assigneeId).length,
      "nao-respondidas": abertas.filter((x) => x.ultimaDirecao === "in").length,
      janela: abertas.filter((x) => x.janelaAberta).length,
      pendentes: c.filter((x) => x.status === "pending").length,
      adiadas: c.filter((x) => x.status === "snoozed").length,
      resolvidas: c.filter((x) => x.status === "resolved").length,
    } as Record<Filtro, number>;
  }, [conversas, usuarioAtual]);

  const visiveis = useMemo(() => {
    let c = conversas ?? [];
    // Cada status tem seu board: quem não está aberta some dos filtros do dia
    // a dia e só aparece no filtro do próprio status.
    const statusDoFiltro = FILTRO_STATUS[filtro];
    c = statusDoFiltro
      ? c.filter((x) => x.status === statusDoFiltro)
      : c.filter((x) => x.status === "open");
    if (etiquetaFiltro) c = c.filter((x) => x.labels?.includes(etiquetaFiltro));
    if (filtro === "minhas") c = c.filter((x) => x.assigneeId === usuarioAtual);
    if (filtro === "nao-atribuidas") c = c.filter((x) => !x.assigneeId);
    if (filtro === "nao-respondidas") c = c.filter((x) => x.ultimaDirecao === "in");
    if (filtro === "janela") c = c.filter((x) => x.janelaAberta);
    const q = busca.trim().toLowerCase();
    if (q) {
      c = c.filter(
        (x) => (x.nome ?? "").toLowerCase().includes(q) || x.contact.includes(q)
      );
    }
    // Prioridade primeiro, depois a mais recente. Sem isso a prioridade seria
    // só um enfeite: continuaria enterrada no fim da lista.
    return [...c].sort((a, b) => {
      const d = pesoPrioridade(a.priority) - pesoPrioridade(b.priority);
      if (d !== 0) return d;
      return new Date(b.ultimaEm).getTime() - new Date(a.ultimaEm).getTime();
    });
  }, [conversas, filtro, busca, usuarioAtual, etiquetaFiltro]);

  const conversaAtiva =
    (conversas ?? []).find((c) => c.contact === ativo) ?? null;
  const nomeAtivo = ficha?.lead?.nome ?? conversaAtiva?.nome ?? null;

  async function mudarStatus(
    action: "pendente" | "adiar",
    prazo?: string
  ) {
    if (!ativo) return;
    setErro("");
    setMenuAberto(false);
    setResolvendo(true);
    try {
      const res = await fetch("/api/loopchat/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: ativo, action, prazo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível atualizar a conversa.");
        return;
      }
      await loadConversas();
      // Sai do board atual: fecha a thread para não ficar órfã.
      setAtivo(null);
    } finally {
      setResolvendo(false);
    }
  }

  async function definirPrioridade(priority: string | null) {
    if (!ativo) return;
    setErro("");
    const res = await fetch("/api/loopchat/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: ativo, action: "priorizar", priority }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error ?? "Não foi possível definir a prioridade.");
      return;
    }
    await loadConversas();
  }

  async function salvarEtiquetas(labels: string[]) {
    if (!ativo) return;
    setErro("");
    const res = await fetch("/api/loopchat/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: ativo, action: "etiquetar", labels }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error ?? "Não foi possível salvar as etiquetas.");
      return;
    }
    await loadConversas();
  }

  function adicionarEtiqueta() {
    const nova = novaEtiqueta.trim().toLowerCase();
    if (!nova || !conversaAtiva) return;
    if (conversaAtiva.labels.includes(nova)) {
      setNovaEtiqueta("");
      return;
    }
    setNovaEtiqueta("");
    salvarEtiquetas([...conversaAtiva.labels, nova]);
  }

  async function atribuir(assigneeId: string | null) {
    if (!ativo) return;
    setErro("");
    const res = await fetch("/api/loopchat/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: ativo, action: "atribuir", assigneeId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(data.error ?? "Não foi possível atribuir.");
      return;
    }
    await loadConversas();
  }

  async function alternarResolucao() {
    if (!ativo) return;
    const resolver = conversaAtiva?.status !== "resolved";
    setErro("");
    setResolvendo(true);
    try {
      const res = await fetch("/api/loopchat/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: ativo,
          action: resolver ? "resolver" : "reabrir",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível atualizar a conversa.");
        return;
      }
      await loadConversas();
      // Muda de board: fecha a thread para não ficar órfã na lista atual.
      setAtivo(null);
    } finally {
      setResolvendo(false);
    }
  }

  async function enviar() {
    if (!ativo || !texto.trim()) return;
    setErro("");
    setEnviando(true);
    try {
      // Nota interna não passa pela Meta: rota própria, sem janela de 24h.
      if (modoNota) {
        const res = await fetch("/api/loopchat/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact: ativo, body: texto }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(data.error ?? "Não foi possível salvar a nota.");
          return;
        }
        setTexto("");
        await loadMensagens(ativo);
        return;
      }

      const res = await fetch("/api/loopchat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: ativo, body: texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível enviar.");
        return;
      }
      setTexto("");
      await loadMensagens(ativo);
      await loadConversas();
    } catch {
      setErro("Erro de rede ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Coluna 1: filtros */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--loop-border)] bg-[var(--loop-bg)] lg:flex">
        <div className="border-b border-[var(--loop-border)] px-4 py-4">
          <h1 className="font-semibold text-[var(--loop-text)]">Conversas</h1>
          <p className="text-xs text-[var(--loop-text-muted)]">
            Do seu número do WhatsApp
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-0.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                filtro === f.id
                  ? "bg-[var(--loop-primary-muted)] font-medium text-[var(--loop-primary)]"
                  : "text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)]"
              }`}
            >
              <span>{f.label}</span>
              <span className="text-xs">{contagens[f.id] ?? 0}</span>
            </button>
          ))}
          </div>

          {etiquetas.length > 0 && (
            <div className="mt-4">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--loop-text-muted)]">
                Etiquetas
              </p>
              <div className="space-y-0.5">
                {etiquetas.map((e) => (
                  <button
                    key={e.nome}
                    type="button"
                    onClick={() =>
                      setEtiquetaFiltro(
                        etiquetaFiltro === e.nome ? null : e.nome
                      )
                    }
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      etiquetaFiltro === e.nome
                        ? "bg-[var(--loop-bg-alt)] font-medium text-[var(--loop-text)]"
                        : "text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: corDaEtiqueta(e.nome) }}
                      />
                      <span className="truncate">{e.nome}</span>
                    </span>
                    <span className="text-xs">{e.total}</span>
                  </button>
                ))}
              </div>
              {etiquetaFiltro && (
                <button
                  type="button"
                  onClick={() => setEtiquetaFiltro(null)}
                  className="mt-1 px-3 text-xs text-[var(--loop-primary)]"
                >
                  Limpar etiqueta
                </button>
              )}
            </div>
          )}
        </nav>
        {!whatsappConectado && (
          <p className="m-2 rounded-lg border border-[color-mix(in_srgb,var(--loop-error)_35%,var(--loop-border))] bg-[color-mix(in_srgb,var(--loop-error)_6%,transparent)] p-3 text-xs text-[var(--loop-text)]">
            Nenhum WhatsApp conectado. Conecte em Integrações para receber
            mensagens.
          </p>
        )}
      </aside>

      {/* Coluna 2: lista */}
      <section
        className={`w-full shrink-0 flex-col border-r border-[var(--loop-border)] bg-[var(--loop-bg)] md:flex md:w-80 ${
          ativo ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="space-y-3 border-b border-[var(--loop-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[var(--loop-text)]">Conversas</h2>
            <Badge variant="default">{visiveis.length}</Badge>
          </div>
          <Input
            placeholder="Buscar por nome ou número"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversas === null ? (
            <p className="p-4 text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : visiveis.length === 0 ? (
            <p className="p-4 text-sm text-[var(--loop-text-muted)]">
              {conversas.length === 0
                ? "Nenhuma conversa ainda. Elas aparecem quando um cliente responder suas mensagens."
                : "Nada nesse filtro."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--loop-border)]">
              {visiveis.map((c) => (
                <li key={c.contact}>
                  <button
                    type="button"
                    onClick={() => setAtivo(c.contact)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--loop-bg-alt)] ${
                      ativo === c.contact ? "bg-[var(--loop-bg-alt)]" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--loop-primary-muted)] text-xs font-semibold text-[var(--loop-primary)]">
                      {iniciais(c.nome, c.contact)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {c.priority && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: PRIORIDADES[c.priority]?.cor,
                              }}
                              title={`Prioridade ${PRIORIDADES[c.priority]?.label}`}
                            />
                          )}
                          <span className="truncate font-medium text-[var(--loop-text)]">
                            {c.nome ?? telefone(c.contact)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-[var(--loop-text-muted)]">
                          {horaCurta(c.ultimaEm)}
                        </span>
                      </span>
                      {c.labels?.length > 0 && (
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {c.labels.map((l) => (
                            <span
                              key={l}
                              className="inline-flex items-center gap-1 text-[11px] text-[var(--loop-text-muted)]"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: corDaEtiqueta(l) }}
                              />
                              {l}
                            </span>
                          ))}
                        </span>
                      )}
                      {c.assigneeNome && (
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--loop-primary)]">
                          {c.assigneeId === usuarioAtual
                            ? "Atribuída a você"
                            : `Atribuída a ${c.assigneeNome}`}
                        </span>
                      )}
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-[var(--loop-text-muted)]">
                          {c.ultimaDirecao === "out" ? "Você: " : ""}
                          {c.ultimoTexto ?? "—"}
                        </span>
                        {c.naoLidas > 0 && (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--loop-primary)] px-1.5 text-xs font-semibold text-white">
                            {c.naoLidas}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Coluna 3: thread */}
      <section
        className={`min-w-0 flex-1 flex-col bg-[var(--loop-bg-alt)] ${
          ativo ? "flex" : "hidden md:flex"
        }`}
      >
        {!ativo ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--loop-text-muted)]">
            Escolha uma conversa.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-4 py-2.5">
              <button
                type="button"
                onClick={() => setAtivo(null)}
                className="text-sm text-[var(--loop-text-muted)] md:hidden"
                aria-label="Voltar para a lista"
              >
                ←
              </button>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--loop-primary-muted)] text-xs font-semibold text-[var(--loop-primary)]">
                {iniciais(nomeAtivo, ativo)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--loop-text)]">
                  {nomeAtivo ?? telefone(ativo)}
                </p>
                <p className="truncate text-xs text-[var(--loop-text-muted)]">
                  WhatsApp · {telefone(ativo)}
                </p>
              </div>
              {conversaAtiva?.status === "pending" && (
                <Badge variant="warning">Pendente</Badge>
              )}
              {conversaAtiva?.status === "snoozed" && (
                <Badge variant="warning">
                  Adiada até{" "}
                  {conversaAtiva.snoozedUntil
                    ? horaCompleta(conversaAtiva.snoozedUntil)
                    : "—"}
                </Badge>
              )}
              {conversaAtiva?.priority && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                  style={{
                    backgroundColor: PRIORIDADES[conversaAtiva.priority]?.cor,
                  }}
                >
                  {PRIORIDADES[conversaAtiva.priority]?.label}
                </span>
              )}
              <Badge variant={janelaAberta ? "success" : "default"}>
                {janelaAberta ? "Janela 24h aberta" : "Janela fechada"}
              </Badge>
              <div className="relative flex items-center">
                <Button
                  variant={
                    conversaAtiva?.status === "open" ? "cta" : "secondary"
                  }
                  size="sm"
                  disabled={resolvendo}
                  onClick={alternarResolucao}
                >
                  {resolvendo
                    ? "Salvando…"
                    : conversaAtiva?.status === "open"
                      ? "Resolver"
                      : "Reabrir"}
                </Button>
                {conversaAtiva?.status === "open" && (
                  <button
                    type="button"
                    aria-label="Mais ações da conversa"
                    onClick={() => setMenuAberto((v) => !v)}
                    className="ml-1 rounded-lg border border-[var(--loop-border)] px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                  >
                    ▾
                  </button>
                )}
                {menuAberto && (
                  <div className="absolute right-0 top-9 z-10 w-52 rounded-xl border border-[var(--loop-border)] bg-[var(--loop-bg)] py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => mudarStatus("pendente")}
                      className="block w-full px-3 py-2 text-left text-sm text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
                    >
                      Deixar pendente
                    </button>
                    <p className="px-3 pt-2 text-xs uppercase tracking-wide text-[var(--loop-text-muted)]">
                      Adiar
                    </p>
                    {ADIAMENTOS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => mudarStatus("adiar", a.id)}
                        className="block w-full px-3 py-2 text-left text-sm text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPainelAberto((v) => !v)}
                className="hidden rounded-lg border border-[var(--loop-border)] px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] lg:block"
              >
                {painelAberto ? "Ocultar contato" : "Ver contato"}
              </button>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {mensagens.map((m) => {
                    const meu = m.direction === "out";
                    const nota = !!m.internal;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${
                          nota ? "justify-center" : meu ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            nota
                              ? "border border-dashed border-[#f59e0b] bg-[#fffbeb] text-[#78350f]"
                              : meu
                                ? "bg-[var(--loop-primary-muted)] text-[var(--loop-text)]"
                                : "border border-[var(--loop-border)] bg-[var(--loop-bg)] text-[var(--loop-text)]"
                          }`}
                        >
                          {nota && (
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
                              Nota interna
                              {m.authorName ? ` · ${m.authorName}` : ""}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap">
                            {m.body ??
                              (m.templateName
                                ? `[template: ${m.templateName}]`
                                : `[${m.type ?? "mensagem"}]`)}
                          </p>
                          <p
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              nota ? "opacity-70" : "text-[var(--loop-text-muted)]"
                            }`}
                          >
                            <span>{horaCompleta(m.createdAt)}</span>
                            {meu && !nota && m.status && (
                              <span
                                className={
                                  m.status === "read"
                                    ? "text-[var(--loop-primary)]"
                                    : m.status === "failed"
                                      ? "text-[var(--loop-error)]"
                                      : ""
                                }
                                title={m.status}
                              >
                                {TICK[m.status] ?? m.status}
                              </span>
                            )}
                          </p>
                          {m.error && (
                            <p className="mt-1 text-[10px] text-[var(--loop-error)]">
                              {m.error}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fimRef} />
                </div>

                <div className="border-t border-[var(--loop-border)] bg-[var(--loop-bg)] p-3">
                  <div className="mb-2 flex gap-1">
                    {[
                      { id: false, label: "Responder" },
                      { id: true, label: "Nota interna" },
                    ].map((t) => (
                      <button
                        key={String(t.id)}
                        type="button"
                        onClick={() => setModoNota(t.id)}
                        className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                          modoNota === t.id
                            ? "bg-[var(--loop-bg-alt)] font-medium text-[var(--loop-text)]"
                            : "text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {modoNota ? (
                    <p className="mb-2 text-xs text-[var(--loop-text-muted)]">
                      Só a sua equipe vê. O cliente não recebe nada.
                    </p>
                  ) : (
                    !janelaAberta && (
                      <p className="mb-2 text-xs text-[var(--loop-text-muted)]">
                        A janela de 24h fechou. Para retomar, é preciso um
                        template aprovado pela Meta.
                      </p>
                    )
                  )}
                  <textarea
                    rows={3}
                    placeholder={
                      modoNota
                        ? "Escreva uma nota para a equipe…"
                        : "Shift + Enter para nova linha. Enter envia."
                    }
                    value={texto}
                    disabled={(!janelaAberta && !modoNota) || enviando}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviar();
                      }
                    }}
                    className="w-full resize-none rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)] disabled:opacity-60"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--loop-text-muted)]">
                      {erro ? (
                        <span className="text-[var(--loop-error)]">{erro}</span>
                      ) : (
                        `${texto.length} caractere${texto.length === 1 ? "" : "s"}`
                      )}
                    </span>
                    <Button
                      variant={modoNota ? "secondary" : "cta"}
                      size="sm"
                      disabled={
                        (!janelaAberta && !modoNota) || enviando || !texto.trim()
                      }
                      onClick={enviar}
                    >
                      {enviando
                        ? "Salvando…"
                        : modoNota
                          ? "Salvar nota"
                          : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Painel do contato */}
              {painelAberto && (
                <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-[var(--loop-border)] bg-[var(--loop-bg)] p-4 lg:block">
                  <div className="flex flex-col items-center text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--loop-primary-muted)] text-base font-semibold text-[var(--loop-primary)]">
                      {iniciais(nomeAtivo, ativo)}
                    </span>
                    <p className="mt-2 font-semibold text-[var(--loop-text)]">
                      {nomeAtivo ?? telefone(ativo)}
                    </p>
                    <p className="text-xs text-[var(--loop-text-muted)]">
                      {telefone(ativo)}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--loop-text)]">
                      Ações da conversa
                    </p>

                    <div>
                      <label
                        htmlFor="responsavel"
                        className="text-xs uppercase tracking-wide text-[var(--loop-text-muted)]"
                      >
                        Responsável
                      </label>
                      <select
                        id="responsavel"
                        value={conversaAtiva?.assigneeId ?? ""}
                        onChange={(e) => atribuir(e.target.value || null)}
                        className="mt-1 w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1.5 text-sm text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                      >
                        <option value="">Sem responsável</option>
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.email}
                            {m.isSelf ? " (você)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="prioridade"
                        className="text-xs uppercase tracking-wide text-[var(--loop-text-muted)]"
                      >
                        Prioridade
                      </label>
                      <select
                        id="prioridade"
                        value={conversaAtiva?.priority ?? ""}
                        onChange={(e) =>
                          definirPrioridade(e.target.value || null)
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1.5 text-sm text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                      >
                        <option value="">Nenhuma</option>
                        {Object.entries(PRIORIDADES).map(([id, p]) => (
                          <option key={id} value={id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--loop-text-muted)]">
                        Etiquetas da conversa
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {conversaAtiva?.labels?.length ? (
                          conversaAtiva.labels.map((l) => (
                            <span
                              key={l}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{ backgroundColor: corDaEtiqueta(l) }}
                            >
                              {l}
                              <button
                                type="button"
                                aria-label={`Remover etiqueta ${l}`}
                                onClick={() =>
                                  salvarEtiquetas(
                                    conversaAtiva.labels.filter((x) => x !== l)
                                  )
                                }
                                className="leading-none opacity-80 hover:opacity-100"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-[var(--loop-text-muted)]">
                            Nenhuma etiqueta.
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <input
                          list="etiquetas-existentes"
                          value={novaEtiqueta}
                          placeholder="Adicionar etiqueta"
                          onChange={(e) => setNovaEtiqueta(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              adicionarEtiqueta();
                            }
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-xs text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                        />
                        <datalist id="etiquetas-existentes">
                          {etiquetas.map((e) => (
                            <option key={e.nome} value={e.nome} />
                          ))}
                        </datalist>
                        <button
                          type="button"
                          onClick={adicionarEtiqueta}
                          disabled={!novaEtiqueta.trim()}
                          className="rounded-lg border border-[var(--loop-border)] px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--loop-text-muted)]">
                        Contato
                      </p>
                      {ficha === null ? (
                        <p className="mt-1 text-[var(--loop-text-muted)]">
                          Carregando…
                        </p>
                      ) : ficha.lead ? (
                        <div className="mt-1 space-y-1">
                          <p className="break-all text-[var(--loop-text)]">
                            {ficha.lead.email ?? "Sem e-mail"}
                          </p>
                          {ficha.lead.status && (
                            <Badge variant="default">{ficha.lead.status}</Badge>
                          )}
                          {ficha.lead.desde && (
                            <p className="text-xs text-[var(--loop-text-muted)]">
                              Na base desde {dataBR(ficha.lead.desde)}
                            </p>
                          )}
                          {ficha.lead.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {ficha.lead.tags.map((t) => (
                                <Badge key={t} variant="default">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-[var(--loop-text-muted)]">
                          Este número não está na sua base de leads.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--loop-text-muted)]">
                        Checkouts
                      </p>
                      {!ficha?.checkouts?.length ? (
                        <p className="mt-1 text-[var(--loop-text-muted)]">
                          Nenhum checkout deste contato.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-2">
                          {ficha.checkouts.map((c, i) => (
                            <li
                              key={`${c.produto}-${i}`}
                              className="rounded-lg border border-[var(--loop-border)] p-2"
                            >
                              <p className="truncate text-[var(--loop-text)]">
                                {c.produto}
                              </p>
                              <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-[var(--loop-text-muted)]">
                                <span>
                                  {c.valor ? `${c.moeda} ${c.valor}` : "—"} ·{" "}
                                  {dataBR(c.em)}
                                </span>
                                <Badge
                                  variant={SITUACAO_BADGE[c.situacao] ?? "default"}
                                >
                                  {c.situacao}
                                </Badge>
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
