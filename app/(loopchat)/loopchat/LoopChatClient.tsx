"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input } from "@/components/ui";

interface Conversa {
  contact: string;
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

type Filtro = "todas" | "nao-respondidas" | "janela";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas as conversas" },
  { id: "nao-respondidas", label: "Não respondidas" },
  { id: "janela", label: "Dentro das 24h" },
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
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
  const [janelaAberta, setJanelaAberta] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const loadConversas = useCallback(async () => {
    const res = await fetch("/api/loopchat/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversas(data.conversas ?? []);
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
  }, [loadConversas]);

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
    return {
      todas: c.length,
      "nao-respondidas": c.filter((x) => x.ultimaDirecao === "in").length,
      janela: c.filter((x) => x.janelaAberta).length,
    } as Record<Filtro, number>;
  }, [conversas]);

  const visiveis = useMemo(() => {
    let c = conversas ?? [];
    if (filtro === "nao-respondidas") c = c.filter((x) => x.ultimaDirecao === "in");
    if (filtro === "janela") c = c.filter((x) => x.janelaAberta);
    const q = busca.trim().toLowerCase();
    if (q) {
      c = c.filter(
        (x) => (x.nome ?? "").toLowerCase().includes(q) || x.contact.includes(q)
      );
    }
    return c;
  }, [conversas, filtro, busca]);

  const conversaAtiva =
    (conversas ?? []).find((c) => c.contact === ativo) ?? null;
  const nomeAtivo = ficha?.lead?.nome ?? conversaAtiva?.nome ?? null;

  async function enviar() {
    if (!ativo || !texto.trim()) return;
    setErro("");
    setEnviando(true);
    try {
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
        <nav className="flex-1 space-y-0.5 p-2">
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
                        <span className="truncate font-medium text-[var(--loop-text)]">
                          {c.nome ?? telefone(c.contact)}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--loop-text-muted)]">
                          {horaCurta(c.ultimaEm)}
                        </span>
                      </span>
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
              <Badge variant={janelaAberta ? "success" : "default"}>
                {janelaAberta ? "Janela 24h aberta" : "Janela fechada"}
              </Badge>
              <button
                type="button"
                onClick={() => setPainelAberto((v) => !v)}
                className="hidden rounded-lg border border-[var(--loop-border)] px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] xl:block"
              >
                {painelAberto ? "Ocultar contato" : "Ver contato"}
              </button>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {mensagens.map((m) => {
                    const meu = m.direction === "out";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${meu ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            meu
                              ? "bg-[var(--loop-primary-muted)] text-[var(--loop-text)]"
                              : "border border-[var(--loop-border)] bg-[var(--loop-bg)] text-[var(--loop-text)]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">
                            {m.body ??
                              (m.templateName
                                ? `[template: ${m.templateName}]`
                                : `[${m.type ?? "mensagem"}]`)}
                          </p>
                          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[var(--loop-text-muted)]">
                            <span>{horaCompleta(m.createdAt)}</span>
                            {meu && m.status && (
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
                  {!janelaAberta && (
                    <p className="mb-2 text-xs text-[var(--loop-text-muted)]">
                      A janela de 24h fechou. Para retomar, é preciso um template
                      aprovado pela Meta.
                    </p>
                  )}
                  <textarea
                    rows={3}
                    placeholder="Shift + Enter para nova linha. Enter envia."
                    value={texto}
                    disabled={!janelaAberta || enviando}
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
                      variant="cta"
                      size="sm"
                      disabled={!janelaAberta || enviando || !texto.trim()}
                      onClick={enviar}
                    >
                      {enviando ? "Enviando…" : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Painel do contato */}
              {painelAberto && (
                <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-[var(--loop-border)] bg-[var(--loop-bg)] p-4 xl:block">
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
