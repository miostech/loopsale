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
interface Canal {
  phoneNumberId: string;
  name: string;
  displayNumber: string | null;
}
interface Conversa {
  contact: string;
  phoneNumberId: string | null;
  status: string;
  snoozedUntil: string | null;
  assigneeId: string | null;
  assigneeNome: string | null;
  labels: string[];
  priority: string | null;
  botPaused: boolean;
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
  mediaId?: string | null;
  mimeType?: string | null;
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
interface TemplateWA {
  name: string;
  language: string;
  body: string;
  variableCount: number;
}
interface LeadBusca {
  id: string;
  nome: string | null;
  telefone: string | null;
}
interface RespostaRapida {
  id: string;
  shortcut: string;
  title: string | null;
  content: string;
}

type Filtro =
  | "abertas"
  | "aguardando-humano"
  | "minhas"
  | "nao-atribuidas"
  | "nao-respondidas"
  | "janela"
  | "pendentes"
  | "adiadas"
  | "resolvidas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "abertas", label: "Abertas" },
  { id: "aguardando-humano", label: "Aguardando humano" },
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

/** Deixa URLs do texto clicáveis (ex: link do Google Maps em localização). */
function linkificar(texto: string) {
  return texto.split(/(https?:\/\/[^\s]+)/g).map((parte, i) =>
    /^https?:\/\//.test(parte) ? (
      <a
        key={i}
        href={parte}
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {parte}
      </a>
    ) : (
      parte
    )
  );
}

/** Preview do corpo do template: troca {{1}}, {{2}}... pelo que foi digitado. */
function preencherPreview(body: string, variables: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_all, n) => {
    const v = variables[Number(n) - 1];
    return v && v.trim() ? v : `{{${n}}}`;
  });
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
  numeroConta,
}: {
  whatsappConectado: boolean;
  numeroConta?: string | null;
}) {
  const [conversas, setConversas] = useState<Conversa[] | null>(null);
  // Canais (caixas) da conta e o canal selecionado na sidebar (null = todas).
  const [canais, setCanais] = useState<Canal[]>([]);
  const [canalSel, setCanalSel] = useState<string | null>(null);
  // Admin da LoopSale: vê as caixas de todas as empresas e marca quais ver.
  const [isAdmin, setIsAdmin] = useState(false);
  const [canaisMarcados, setCanaisMarcados] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [resolvendo, setResolvendo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [usuarioAtual, setUsuarioAtual] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const [criandoEtiqueta, setCriandoEtiqueta] = useState(false);
  const [nomeNovaEtiqueta, setNomeNovaEtiqueta] = useState("");
  // Etiqueta aguardando confirmação de exclusão (confirmação inline, não usa
  // window.confirm — que o navegador pode bloquear silenciosamente).
  const [etiquetaApagar, setEtiquetaApagar] = useState<string | null>(null);
  const [apagandoEtiqueta, setApagandoEtiqueta] = useState(false);
  const [erroEtiqueta, setErroEtiqueta] = useState("");
  // Compositor de nova conversa (envio de template).
  const [novaConversa, setNovaConversa] = useState(false);
  // Canal (caixa) de onde a nova conversa vai sair.
  const [ncCanal, setNcCanal] = useState<string | null>(null);
  const [ncTelefone, setNcTelefone] = useState("");
  const [ncNome, setNcNome] = useState("");
  const [ncBuscaContato, setNcBuscaContato] = useState("");
  const [ncLeads, setNcLeads] = useState<LeadBusca[]>([]);
  const [ncTemplates, setNcTemplates] = useState<TemplateWA[] | null>(null);
  const [ncBuscaModelo, setNcBuscaModelo] = useState("");
  const [ncTemplate, setNcTemplate] = useState<TemplateWA | null>(null);
  const [ncVars, setNcVars] = useState<string[]>([]);
  const [ncEnviando, setNcEnviando] = useState(false);
  const [ncErro, setNcErro] = useState("");
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState<string | null>(null);
  // Canal (caixa) da conversa aberta — as mensagens e ações usam ele.
  const [ativoCanal, setAtivoCanal] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
  // No celular o painel de contato abre como camada em tela cheia (a coluna
  // lateral não cabe); começa fechado pra não cobrir a conversa ao entrar.
  const [verContato, setVerContato] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [janelaAberta, setJanelaAberta] = useState(true);
  const [texto, setTexto] = useState("");
  const [modoNota, setModoNota] = useState(false);
  // Respostas rápidas (/atalho). Lista da conta + navegação do autocomplete.
  const [respostas, setRespostas] = useState<RespostaRapida[]>([]);
  const [respostaIdx, setRespostaIdx] = useState(0);
  const [gerenciarRespostas, setGerenciarRespostas] = useState(false);
  // Formulário do gerenciador de respostas rápidas.
  const [crEditId, setCrEditId] = useState<string | null>(null);
  const [crShortcut, setCrShortcut] = useState("");
  const [crTitle, setCrTitle] = useState("");
  const [crContent, setCrContent] = useState("");
  const [crErro, setCrErro] = useState("");
  const [crSalvando, setCrSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviandoMidia, setEnviandoMidia] = useState(false);
  // Anexo escolhido (📎, arrastar ou colar), aguardando confirmação de envio.
  const [anexo, setAnexo] = useState<File | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  // Última mensagem já vista — evita rolar a tela a cada polling.
  const ultimaMsgRef = useRef<string | null>(null);

  const loadConversas = useCallback(async () => {
    // Admin: carrega as conversas das caixas marcadas (várias empresas).
    const qs = canaisMarcados.length
      ? `?channels=${canaisMarcados.map(encodeURIComponent).join(",")}`
      : "";
    const res = await fetch(`/api/loopchat/conversations${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversas(data.conversas ?? []);
    setUsuarioAtual(data.usuarioAtual ?? null);
    setEtiquetas(data.etiquetas ?? []);
    setCanais(data.canais ?? []);
    setIsAdmin(!!data.isAdmin);
  }, [canaisMarcados]);

  const loadMembros = useCallback(async () => {
    const res = await fetch("/api/account/members");
    if (!res.ok) return;
    setMembros(await res.json());
  }, []);

  const loadRespostas = useCallback(async () => {
    const res = await fetch("/api/loopchat/canned");
    if (!res.ok) return;
    const data = await res.json();
    setRespostas(data.respostas ?? []);
  }, []);

  const loadMensagens = useCallback(
    async (contact: string, channel?: string | null) => {
      const qs = new URLSearchParams({ contact });
      if (channel) qs.set("channel", channel);
      const res = await fetch(`/api/loopchat/messages?${qs.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setMensagens(data.mensagens ?? []);
      setJanelaAberta(!!data.janelaAberta);
    },
    []
  );

  const loadFicha = useCallback(async (contact: string, channel?: string | null) => {
    setFicha(null);
    const qs = new URLSearchParams({ contact });
    if (channel) qs.set("channel", channel);
    const res = await fetch(`/api/loopchat/contact?${qs.toString()}`);
    if (!res.ok) return;
    setFicha(await res.json());
  }, []);

  useEffect(() => {
    loadConversas();
    loadMembros();
    loadRespostas();
  }, [loadConversas, loadMembros, loadRespostas]);

  useEffect(() => {
    if (!ativo) return;
    loadMensagens(ativo, ativoCanal);
    loadFicha(ativo, ativoCanal);
  }, [ativo, ativoCanal, loadMensagens, loadFicha]);

  // Trocar de conversa descarta um anexo ainda não enviado (era da outra).
  useEffect(() => {
    setAnexo(null);
    setAnexoUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
    setArrastando(false);
  }, [ativo, ativoCanal]);

  // Atualização automática (quase tempo real): repolla a lista e a conversa
  // aberta a cada poucos segundos, sem incomodar quando a aba está oculta.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadConversas();
      if (ativo) loadMensagens(ativo, ativoCanal);
    }, 6000);
    return () => clearInterval(id);
  }, [ativo, ativoCanal, loadConversas, loadMensagens]);

  // No PWA do iOS os timers congelam quando o app vai pro segundo plano — ao
  // voltar, o setInterval pode não disparar sem um reload. Então, sempre que o
  // app volta ao foco (visível de novo, ganha foco, ou restaura da bfcache),
  // atualiza na hora em vez de esperar o próximo tick.
  useEffect(() => {
    const atualizarAgora = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadConversas();
      if (ativo) loadMensagens(ativo, ativoCanal);
    };
    const aoVisivel = () => {
      if (!document.hidden) atualizarAgora();
    };
    document.addEventListener("visibilitychange", aoVisivel);
    window.addEventListener("focus", atualizarAgora);
    window.addEventListener("pageshow", atualizarAgora);
    return () => {
      document.removeEventListener("visibilitychange", aoVisivel);
      window.removeEventListener("focus", atualizarAgora);
      window.removeEventListener("pageshow", atualizarAgora);
    };
  }, [ativo, ativoCanal, loadConversas, loadMensagens]);

  // Rola pro fim só quando a última mensagem muda (mensagem nova) — assim o
  // polling não fica puxando a tela pra baixo enquanto você lê o histórico.
  useEffect(() => {
    const ultimaId = mensagens[mensagens.length - 1]?.id ?? null;
    if (ultimaId !== ultimaMsgRef.current) {
      ultimaMsgRef.current = ultimaId;
      fimRef.current?.scrollIntoView({ block: "end" });
    }
  }, [mensagens]);

  // Busca leads pelo nome/telefone enquanto digita no "Para" da nova conversa.
  useEffect(() => {
    const q = ncBuscaContato.trim();
    if (!novaConversa || q.length < 2) {
      setNcLeads([]);
      return;
    }
    let ativo = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(q)}&status=all&limit=6`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!ativo) return;
        const leads = (data.leads ?? [])
          .filter((l: { phone?: string | null }) => l.phone)
          .map((l: { id: string; name?: string | null; phone?: string | null }) => ({
            id: l.id,
            nome: l.name ?? null,
            telefone: l.phone ?? null,
          }));
        setNcLeads(leads);
      } catch {
        /* silencioso */
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [ncBuscaContato, novaConversa]);

  const contagens = useMemo(() => {
    // Só a caixa selecionada (null = todas).
    const c = (conversas ?? []).filter(
      (x) => !canalSel || x.phoneNumberId === canalSel
    );
    // "Abertas" é só o que exige ação agora: pendente, adiada e resolvida têm
    // board próprio.
    const abertas = c.filter((x) => x.status === "open");
    return {
      abertas: abertas.length,
      "aguardando-humano": abertas.filter((x) => x.botPaused).length,
      minhas: abertas.filter((x) => x.assigneeId === usuarioAtual).length,
      "nao-atribuidas": abertas.filter((x) => !x.assigneeId).length,
      "nao-respondidas": abertas.filter((x) => x.ultimaDirecao === "in").length,
      janela: abertas.filter((x) => x.janelaAberta).length,
      pendentes: c.filter((x) => x.status === "pending").length,
      adiadas: c.filter((x) => x.status === "snoozed").length,
      resolvidas: c.filter((x) => x.status === "resolved").length,
    } as Record<Filtro, number>;
  }, [conversas, usuarioAtual, canalSel]);

  const visiveis = useMemo(() => {
    let c = (conversas ?? []).filter(
      (x) => !canalSel || x.phoneNumberId === canalSel
    );
    // Cada status tem seu board: quem não está aberta some dos filtros do dia
    // a dia e só aparece no filtro do próprio status.
    const statusDoFiltro = FILTRO_STATUS[filtro];
    c = statusDoFiltro
      ? c.filter((x) => x.status === statusDoFiltro)
      : c.filter((x) => x.status === "open");
    if (etiquetaFiltro) c = c.filter((x) => x.labels?.includes(etiquetaFiltro));
    if (filtro === "aguardando-humano") c = c.filter((x) => x.botPaused);
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
  }, [conversas, filtro, busca, usuarioAtual, etiquetaFiltro, canalSel]);

  const conversaAtiva =
    (conversas ?? []).find(
      (c) => c.contact === ativo && c.phoneNumberId === ativoCanal
    ) ?? null;
  const nomeAtivo = ficha?.lead?.nome ?? conversaAtiva?.nome ?? null;

  // Autocomplete de respostas rápidas: dispara quando o texto é só "/atalho"
  // (sem espaço), no modo de resposta. Ex.: "/reemb" filtra "/reembolso".
  const slashQuery = useMemo(() => {
    const m = /^\/([a-z0-9-]*)$/i.exec(texto);
    return m ? m[1].toLowerCase() : null;
  }, [texto]);
  const respostasFiltradas = useMemo(() => {
    if (slashQuery === null) return [];
    return respostas
      .filter(
        (r) =>
          r.shortcut.includes(slashQuery) ||
          (r.title ?? "").toLowerCase().includes(slashQuery)
      )
      .slice(0, 6);
  }, [slashQuery, respostas]);
  const menuRespostasAberto = respostasFiltradas.length > 0;

  function inserirResposta(r: RespostaRapida) {
    setTexto(r.content);
    setRespostaIdx(0);
  }

  // Volta o destaque pro topo sempre que o filtro do "/atalho" muda.
  useEffect(() => {
    setRespostaIdx(0);
  }, [slashQuery]);

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
        body: JSON.stringify({ contact: ativo, channel: ativoCanal, action, prazo }),
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
      body: JSON.stringify({
        contact: ativo,
        channel: ativoCanal,
        action: "priorizar",
        priority,
      }),
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
      body: JSON.stringify({
        contact: ativo,
        channel: ativoCanal,
        action: "etiquetar",
        labels,
      }),
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

  // Cria etiqueta pela sidebar: como etiqueta só existe colada numa conversa,
  // aplica a nova na conversa aberta (o botão fica travado sem conversa).
  function criarEtiquetaSidebar() {
    const nova = nomeNovaEtiqueta.trim().toLowerCase();
    if (!nova || !conversaAtiva) return;
    setNomeNovaEtiqueta("");
    setCriandoEtiqueta(false);
    if (conversaAtiva.labels.includes(nova)) return;
    salvarEtiquetas([...conversaAtiva.labels, nova]);
  }

  async function apagarEtiqueta(nome: string) {
    setErroEtiqueta("");
    setApagandoEtiqueta(true);
    try {
      const res = await fetch(
        `/api/loopchat/labels?nome=${encodeURIComponent(nome)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErroEtiqueta(data.error ?? "Não foi possível apagar a etiqueta.");
        return;
      }
      if (etiquetaFiltro === nome) setEtiquetaFiltro(null);
      setEtiquetaApagar(null);
      await loadConversas();
    } catch {
      setErroEtiqueta("Erro de rede ao apagar a etiqueta.");
    } finally {
      setApagandoEtiqueta(false);
    }
  }

  function abrirNovaConversa() {
    setNovaConversa(true);
    // Canal padrão: o selecionado na sidebar, senão a primeira caixa.
    const canalInicial = canalSel ?? canais[0]?.phoneNumberId ?? null;
    setNcCanal(canalInicial);
    setNcTelefone("");
    setNcNome("");
    setNcBuscaContato("");
    setNcLeads([]);
    setNcBuscaModelo("");
    setNcTemplate(null);
    setNcVars([]);
    setNcErro("");
    carregarTemplates(canalInicial);
  }

  async function carregarTemplates(channel?: string | null) {
    setNcTemplates(null);
    try {
      const qs = channel ? `?channel=${encodeURIComponent(channel)}` : "";
      const res = await fetch(`/api/loopchat/templates${qs}`);
      const data = await res.json().catch(() => ({}));
      setNcTemplates(Array.isArray(data.templates) ? data.templates : []);
      if (!res.ok && data.error) setNcErro(data.error);
    } catch {
      setNcTemplates([]);
    }
  }

  // Trocar a caixa da nova conversa recarrega os modelos daquela WABA.
  function trocarCanalNovaConversa(channel: string) {
    setNcCanal(channel);
    setNcTemplate(null);
    setNcVars([]);
    setNcBuscaModelo("");
    carregarTemplates(channel);
  }

  function selecionarLead(lead: LeadBusca) {
    setNcTelefone(lead.telefone ?? "");
    setNcNome(lead.nome ?? "");
    setNcBuscaContato("");
    setNcLeads([]);
  }

  function selecionarTemplate(tpl: TemplateWA) {
    setNcTemplate(tpl);
    setNcVars(Array.from({ length: tpl.variableCount }, () => ""));
  }

  async function enviarNovaConversa() {
    setNcErro("");
    // Contato = lead selecionado (ncTelefone) ou o que foi digitado no campo.
    const telefone = (ncTelefone.trim() || ncBuscaContato.trim());
    if (telefone.replace(/\D/g, "").length < 8) {
      setNcErro("Informe um número de telefone válido (com DDI e DDD).");
      return;
    }
    if (!ncTemplate) {
      setNcErro("Escolha um modelo.");
      return;
    }
    if (ncVars.some((v) => !v.trim())) {
      setNcErro("Preencha todas as variáveis do modelo.");
      return;
    }
    setNcEnviando(true);
    try {
      const res = await fetch("/api/loopchat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: telefone,
          channel: ncCanal,
          templateName: ncTemplate.name,
          language: ncTemplate.language,
          variables: ncVars,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNcErro(data.error ?? "Não foi possível enviar.");
        return;
      }
      setNovaConversa(false);
      await loadConversas();
      if (data.contact) {
        setAtivo(data.contact);
        setAtivoCanal(data.channel ?? ncCanal ?? null);
      }
    } catch {
      setNcErro("Erro de rede ao enviar.");
    } finally {
      setNcEnviando(false);
    }
  }

  async function atribuir(assigneeId: string | null) {
    if (!ativo) return;
    setErro("");
    const res = await fetch("/api/loopchat/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact: ativo,
        channel: ativoCanal,
        action: "atribuir",
        assigneeId,
      }),
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
          channel: ativoCanal,
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
          body: JSON.stringify({ contact: ativo, channel: ativoCanal, body: texto }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(data.error ?? "Não foi possível salvar a nota.");
          return;
        }
        setTexto("");
        await loadMensagens(ativo, ativoCanal);
        return;
      }

      const res = await fetch("/api/loopchat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: ativo, channel: ativoCanal, body: texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível enviar.");
        return;
      }
      setTexto("");
      await loadMensagens(ativo, ativoCanal);
      await loadConversas();
    } catch {
      setErro("Erro de rede ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  // Seleciona um arquivo (📎, arrastar ou colar) para pré-visualizar antes de
  // enviar. Imagem ganha um preview via object URL (revogado ao limpar).
  function escolherAnexo(file: File) {
    setErro("");
    setAnexo(file);
    setAnexoUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
  }

  function limparAnexo() {
    setAnexoUrl((antigo) => {
      if (antigo) URL.revokeObjectURL(antigo);
      return null;
    });
    setAnexo(null);
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  async function enviarAnexo() {
    if (!ativo || !anexo) return;
    setErro("");
    setEnviandoMidia(true);
    try {
      const fd = new FormData();
      fd.append("contact", ativo);
      if (ativoCanal) fd.append("channel", ativoCanal);
      // O texto do compositor vira legenda (imagem/vídeo/documento).
      if (texto.trim()) fd.append("caption", texto.trim());
      fd.append("file", anexo);
      const res = await fetch("/api/loopchat/send-media", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível enviar o anexo.");
        return;
      }
      setTexto("");
      limparAnexo();
      await loadMensagens(ativo, ativoCanal);
      await loadConversas();
    } catch {
      setErro("Erro de rede ao enviar o anexo.");
    } finally {
      setEnviandoMidia(false);
    }
  }

  // ---- Respostas rápidas: gerenciador (criar/editar/excluir) ----
  function limparFormResposta() {
    setCrEditId(null);
    setCrShortcut("");
    setCrTitle("");
    setCrContent("");
    setCrErro("");
  }

  function editarResposta(r: RespostaRapida) {
    setCrEditId(r.id);
    setCrShortcut(r.shortcut);
    setCrTitle(r.title ?? "");
    setCrContent(r.content);
    setCrErro("");
  }

  async function salvarResposta() {
    setCrErro("");
    if (!crShortcut.trim() || !crContent.trim()) {
      setCrErro("Preencha o atalho e a mensagem.");
      return;
    }
    setCrSalvando(true);
    try {
      const res = await fetch("/api/loopchat/canned", {
        method: crEditId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crEditId,
          shortcut: crShortcut,
          title: crTitle,
          content: crContent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCrErro(data.error ?? "Não foi possível salvar.");
        return;
      }
      limparFormResposta();
      await loadRespostas();
    } catch {
      setCrErro("Erro de rede ao salvar.");
    } finally {
      setCrSalvando(false);
    }
  }

  async function excluirResposta(id: string) {
    setCrErro("");
    try {
      const res = await fetch(`/api/loopchat/canned?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCrErro(data.error ?? "Não foi possível excluir.");
        return;
      }
      if (crEditId === id) limparFormResposta();
      await loadRespostas();
    } catch {
      setCrErro("Erro de rede ao excluir.");
    }
  }

  return (
    <div className="flex h-full overflow-x-hidden">
      {/* Coluna 1: filtros */}
      <aside
        className={`shrink-0 flex-col border-r border-[var(--loop-border)] bg-[var(--loop-bg)] ${
          sidebarAberta ? "hidden w-56 lg:flex" : "hidden"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-[var(--loop-border)] px-4 py-4">
          <div>
            <h1 className="font-semibold text-[var(--loop-text)]">Conversas</h1>
            <p className="text-xs text-[var(--loop-text-muted)]">
              {isAdmin ? "Todas as empresas (admin)" : "Do seu número do WhatsApp"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarAberta(false)}
            aria-label="Recolher barra lateral"
            title="Recolher barra lateral"
            className="mt-0.5 shrink-0 rounded-md p-1 text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)] hover:text-[var(--loop-text)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9-3 3 3 3" />
            </svg>
          </button>
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

          {/* Admin: marca quais caixas (empresas) quer ver na lista. */}
          {isAdmin && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 px-3 pb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--loop-text-muted)]">
                  Caixas das empresas
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setCanaisMarcados((prev) =>
                      prev.length === canais.length
                        ? []
                        : canais.map((k) => k.phoneNumberId)
                    )
                  }
                  className="shrink-0 text-[11px] font-medium text-[var(--loop-primary)] hover:underline"
                >
                  {canaisMarcados.length === canais.length && canais.length
                    ? "Limpar"
                    : "Todas"}
                </button>
              </div>
              {canais.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--loop-text-muted)]">
                  Nenhuma empresa com número cadastrado.
                </p>
              ) : (
                <div className="max-h-72 space-y-0.5 overflow-y-auto">
                  {canais.map((k) => {
                    const marcado = canaisMarcados.includes(k.phoneNumberId);
                    return (
                      <label
                        key={k.phoneNumberId}
                        className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--loop-bg-alt)]"
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setCanaisMarcados((prev) =>
                              prev.includes(k.phoneNumberId)
                                ? prev.filter((x) => x !== k.phoneNumberId)
                                : [...prev, k.phoneNumberId]
                            )
                          }
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[var(--loop-text)]">
                            {k.name}
                          </span>
                          {k.displayNumber && (
                            <span className="block truncate text-[11px] text-[var(--loop-text-muted)]">
                              {k.displayNumber}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {!canaisMarcados.length && (
                <p className="px-3 pt-1 text-[11px] text-[var(--loop-text-muted)]">
                  Marque as caixas para ver as conversas.
                </p>
              )}
            </div>
          )}

          {/* Canais (caixas): filtra a lista por número. Só com +1 número. */}
          {!isAdmin && canais.length > 1 && (
            <div className="mt-4">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--loop-text-muted)]">
                Canais
              </p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setCanalSel(null)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                    canalSel === null
                      ? "bg-[var(--loop-primary-muted)] font-medium text-[var(--loop-primary)]"
                      : "text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)]"
                  }`}
                >
                  Todas as caixas
                </button>
                {canais.map((k) => (
                  <button
                    key={k.phoneNumberId}
                    type="button"
                    onClick={() => setCanalSel(k.phoneNumberId)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      canalSel === k.phoneNumberId
                        ? "bg-[var(--loop-primary-muted)] font-medium text-[var(--loop-primary)]"
                        : "text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)]"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      className="shrink-0"
                    >
                      <path d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.1-1.34A10 10 0 1 0 12 2Zm5.8 14.13c-.24.68-1.4 1.3-1.94 1.34-.5.05-1.13.07-1.82-.11-.42-.11-.96-.3-1.65-.6-2.9-1.25-4.8-4.17-4.94-4.36-.15-.19-1.19-1.58-1.19-3.02 0-1.44.75-2.14 1.02-2.44.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.24.6.83 2.04.9 2.19.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.32.38-.45.51-.15.15-.31.31-.13.61.18.3.79 1.3 1.7 2.11 1.17 1.04 2.16 1.36 2.46 1.51.3.15.48.13.66-.08.18-.21.76-.89.96-1.19.2-.3.4-.25.67-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.34.07.12.07.71-.17 1.39Z" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate">{k.name}</span>
                    {k.displayNumber && (
                      <span className="shrink-0 text-[11px] text-[var(--loop-text-muted)]">
                        {k.displayNumber}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--loop-text-muted)]">
                Etiquetas
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!conversaAtiva) return;
                  setCriandoEtiqueta((v) => !v);
                  setNomeNovaEtiqueta("");
                }}
                disabled={!conversaAtiva}
                title={
                  conversaAtiva
                    ? "Criar nova etiqueta na conversa aberta"
                    : "Abra uma conversa para criar uma etiqueta"
                }
                className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--loop-primary)] hover:bg-[var(--loop-primary-muted)] disabled:cursor-not-allowed disabled:text-[var(--loop-text-muted)] disabled:opacity-60 disabled:hover:bg-transparent"
              >
                + Nova
              </button>
            </div>

            {criandoEtiqueta && conversaAtiva && (
              <div className="mb-1 flex gap-1 px-3">
                <input
                  autoFocus
                  list="etiquetas-existentes"
                  value={nomeNovaEtiqueta}
                  placeholder="Nome da etiqueta"
                  onChange={(e) => setNomeNovaEtiqueta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criarEtiquetaSidebar();
                    }
                    if (e.key === "Escape") {
                      setCriandoEtiqueta(false);
                      setNomeNovaEtiqueta("");
                    }
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-xs text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                />
                <button
                  type="button"
                  onClick={criarEtiquetaSidebar}
                  disabled={!nomeNovaEtiqueta.trim()}
                  className="rounded-lg border border-[var(--loop-border)] px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}

            {etiquetas.length > 0 ? (
              <div className="space-y-0.5">
                {etiquetas.map((e) => (
                  <div key={e.nome}>
                    <div
                      className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                        etiquetaFiltro === e.nome
                          ? "bg-[var(--loop-bg-alt)]"
                          : "hover:bg-[var(--loop-bg-alt)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setEtiquetaFiltro(
                            etiquetaFiltro === e.nome ? null : e.nome
                          )
                        }
                        className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                          etiquetaFiltro === e.nome
                            ? "font-medium text-[var(--loop-text)]"
                            : "text-[var(--loop-text-muted)]"
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
                      <button
                        type="button"
                        onClick={() => {
                          setErroEtiqueta("");
                          setEtiquetaApagar(
                            etiquetaApagar === e.nome ? null : e.nome
                          );
                        }}
                        aria-label={`Apagar etiqueta ${e.nome}`}
                        title="Apagar etiqueta de todas as conversas"
                        className={`shrink-0 rounded-md p-1 transition-opacity hover:text-[var(--loop-error)] focus:opacity-100 group-hover:opacity-100 ${
                          etiquetaApagar === e.nome
                            ? "text-[var(--loop-error)] opacity-100"
                            : "text-[var(--loop-text-muted)] opacity-0"
                        }`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                    {etiquetaApagar === e.nome && (
                      <div className="mx-1 mb-1 mt-0.5 rounded-lg border border-[color-mix(in_srgb,var(--loop-error)_35%,var(--loop-border))] bg-[color-mix(in_srgb,var(--loop-error)_6%,transparent)] p-2">
                        <p className="text-xs text-[var(--loop-text)]">
                          Apagar <b>{e.nome}</b> de {e.total}{" "}
                          {e.total === 1 ? "conversa" : "conversas"}?
                        </p>
                        {erroEtiqueta && (
                          <p className="mt-1 text-xs text-[var(--loop-error)]">
                            {erroEtiqueta}
                          </p>
                        )}
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEtiquetaApagar(null)}
                            disabled={apagandoEtiqueta}
                            className="rounded-md px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => apagarEtiqueta(e.nome)}
                            disabled={apagandoEtiqueta}
                            className="rounded-md bg-[var(--loop-error)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {apagandoEtiqueta ? "Apagando…" : "Apagar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-3 py-1 text-xs text-[var(--loop-text-muted)]">
                Nenhuma etiqueta ainda.
              </p>
            )}
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {!sidebarAberta && (
                <button
                  type="button"
                  onClick={() => setSidebarAberta(true)}
                  aria-label="Abrir barra lateral"
                  title="Abrir filtros e etiquetas"
                  className="hidden shrink-0 rounded-md p-1 text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)] hover:text-[var(--loop-text)] lg:inline-flex"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18" />
                    <path d="m12 9 3 3-3 3" />
                  </svg>
                </button>
              )}
              <h2 className="font-semibold text-[var(--loop-text)]">Conversas</h2>
              <Badge variant="default">{visiveis.length}</Badge>
            </div>
            <button
              type="button"
              onClick={abrirNovaConversa}
              disabled={!whatsappConectado}
              title={
                whatsappConectado
                  ? "Nova conversa por template"
                  : "Conecte um WhatsApp para iniciar conversas"
              }
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--loop-primary)] px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nova
            </button>
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
                <li key={`${c.phoneNumberId ?? ""}|${c.contact}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setAtivo(c.contact);
                      setAtivoCanal(c.phoneNumberId);
                    }}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--loop-bg-alt)] ${
                      ativo === c.contact && ativoCanal === c.phoneNumberId
                        ? "bg-[var(--loop-bg-alt)]"
                        : ""
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
                      {/* De qual caixa/empresa é — no admin sempre; senão ao ver "Todas". */}
                      {(isAdmin || (!canalSel && canais.length > 1)) && (
                        <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border border-[var(--loop-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--loop-text-muted)]">
                          {canais.find((k) => k.phoneNumberId === c.phoneNumberId)
                            ?.name ?? "Canal"}
                        </span>
                      )}
                      {c.botPaused && (
                        <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--loop-warning)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--loop-warning)]">
                          Aguardando humano
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
        className={`relative min-w-0 flex-1 flex-col bg-[var(--loop-bg-alt)] ${
          ativo ? "flex" : "hidden md:flex"
        }`}
        onDragOver={(e) => {
          // Arrastar um arquivo pra dentro da conversa vira anexo.
          if (!ativo || modoNota) return;
          if (Array.from(e.dataTransfer.types).includes("Files")) {
            e.preventDefault();
            setArrastando(true);
          }
        }}
        onDragLeave={(e) => {
          // Só some quando sai de fato da coluna (não ao passar por um filho).
          if (e.currentTarget === e.target) setArrastando(false);
        }}
        onDrop={(e) => {
          if (!ativo || modoNota) return;
          const arq = Array.from(e.dataTransfer.files);
          if (arq.length) {
            e.preventDefault();
            escolherAnexo(arq[0]);
          }
          setArrastando(false);
        }}
      >
        {/* Overlay de "solte aqui" enquanto arrasta um arquivo. */}
        {arrastando && ativo && !modoNota && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_srgb,var(--loop-primary)_12%,transparent)]">
            <div className="rounded-xl border-2 border-dashed border-[var(--loop-primary)] bg-[var(--loop-bg)] px-6 py-4 text-sm font-medium text-[var(--loop-primary)]">
              Solte o arquivo para anexar
            </div>
          </div>
        )}
        {!ativo ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--loop-text-muted)]">
            Escolha uma conversa.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-4 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setVerContato(false);
                  setAtivo(null);
                }}
                className="text-sm text-[var(--loop-text-muted)] md:hidden"
                aria-label="Voltar para a lista"
              >
                ←
              </button>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--loop-primary-muted)] text-xs font-semibold text-[var(--loop-primary)]">
                {iniciais(nomeAtivo, ativo)}
              </span>
              <button
                type="button"
                onClick={() => setVerContato(true)}
                className="min-w-0 flex-1 text-left"
                title="Ver dados do contato"
              >
                <p className="truncate font-medium text-[var(--loop-text)]">
                  {nomeAtivo ?? telefone(ativo)}
                </p>
                <p className="truncate text-xs text-[var(--loop-text-muted)]">
                  WhatsApp · {telefone(ativo)}
                </p>
              </button>
              {/* Badges informativos: escondidos no celular pra caber a linha */}
              <div className="hidden items-center gap-2 md:flex">
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
              </div>
              <div className="relative flex shrink-0 items-center">
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
                          className={`max-w-[85%] overflow-hidden break-words md:max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
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
                          {m.mediaId ? (
                            <div className="space-y-1">
                              {m.type === "image" || m.type === "sticker" ? (
                                <a
                                  href={`/api/loopchat/media/${m.mediaId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/loopchat/media/${m.mediaId}`}
                                    alt={m.body ?? "imagem"}
                                    className="max-h-64 max-w-full rounded-lg"
                                  />
                                </a>
                              ) : m.type === "video" ? (
                                <video
                                  controls
                                  src={`/api/loopchat/media/${m.mediaId}`}
                                  className="max-h-64 max-w-full rounded-lg"
                                />
                              ) : m.type === "audio" ? (
                                <audio
                                  controls
                                  src={`/api/loopchat/media/${m.mediaId}`}
                                  className="w-full"
                                />
                              ) : (
                                <a
                                  href={`/api/loopchat/media/${m.mediaId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--loop-primary)] underline"
                                >
                                  Baixar {m.type ?? "arquivo"}
                                </a>
                              )}
                              {m.body && (
                                <p className="whitespace-pre-wrap">
                                  {linkificar(m.body)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">
                              {m.body != null
                                ? linkificar(m.body)
                                : m.templateName
                                  ? `[template: ${m.templateName}]`
                                  : `[${m.type ?? "mensagem"}]`}
                            </p>
                          )}
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
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <div className="flex gap-1">
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
                    <button
                      type="button"
                      onClick={() => setGerenciarRespostas(true)}
                      title="Digite / no campo para usar uma resposta rápida"
                      className="rounded-lg px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                    >
                      ⚡ Respostas rápidas
                    </button>
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
                  {/* Pré-visualização do anexo antes de enviar. */}
                  {anexo && !modoNota && (
                    <div className="mb-2 flex items-center gap-3 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-2">
                      {anexoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={anexoUrl}
                          alt={anexo.name}
                          className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--loop-bg)] text-2xl">
                          📄
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--loop-text)]">
                          {anexo.name}
                        </p>
                        <p className="text-xs text-[var(--loop-text-muted)]">
                          {(anexo.size / 1024 / 1024).toFixed(2)} MB · adicione
                          uma legenda (opcional) e envie
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={limparAnexo}
                        aria-label="Remover anexo"
                        className="shrink-0 rounded-md px-2 py-1 text-[var(--loop-text-muted)] hover:text-[var(--loop-error)]"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    {/* Autocomplete de "/atalho": abre acima do campo. */}
                    {menuRespostasAberto && (
                      <div className="absolute bottom-full left-0 right-0 z-10 mb-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] shadow-lg">
                        <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--loop-text-muted)]">
                          Respostas rápidas · ↑↓ e Enter
                        </p>
                        {respostasFiltradas.map((r, i) => (
                          <button
                            key={r.id}
                            type="button"
                            // onMouseDown pra não tirar o foco do campo antes do clique.
                            onMouseDown={(e) => {
                              e.preventDefault();
                              inserirResposta(r);
                            }}
                            className={`block w-full border-t border-[var(--loop-border)] px-3 py-2 text-left first:border-t-0 ${
                              i === respostaIdx ? "bg-[var(--loop-bg-alt)]" : ""
                            }`}
                          >
                            <span className="text-sm font-medium text-[var(--loop-primary)]">
                              /{r.shortcut}
                            </span>
                            {r.title && (
                              <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                                {r.title}
                              </span>
                            )}
                            <span className="mt-0.5 block truncate text-xs text-[var(--loop-text-muted)]">
                              {r.content}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      rows={3}
                      placeholder={
                        modoNota
                          ? "Escreva uma nota para a equipe…"
                          : "Shift + Enter para nova linha. Enter envia. Digite / para respostas rápidas."
                      }
                      value={texto}
                      disabled={(!janelaAberta && !modoNota) || enviando}
                      onChange={(e) => setTexto(e.target.value)}
                      onPaste={(e) => {
                        // Colar um print/arquivo vira anexo (não cola no texto).
                        if (modoNota) return;
                        const arq = Array.from(e.clipboardData.files);
                        if (arq.length) {
                          e.preventDefault();
                          escolherAnexo(arq[0]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (menuRespostasAberto) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setRespostaIdx((i) =>
                              Math.min(i + 1, respostasFiltradas.length - 1)
                            );
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setRespostaIdx((i) => Math.max(i - 1, 0));
                            return;
                          }
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            inserirResposta(
                              respostasFiltradas[respostaIdx] ??
                                respostasFiltradas[0]
                            );
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setTexto("");
                            return;
                          }
                        }
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (anexo) enviarAnexo();
                          else enviar();
                        }
                      }}
                      className="w-full resize-none rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-base md:text-sm text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)] disabled:opacity-60"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* Anexar arquivo — só ao responder (vai pro cliente). */}
                      {!modoNota && (
                        <>
                          <input
                            ref={arquivoRef}
                            type="file"
                            accept="image/*,video/*,audio/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) escolherAnexo(f);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => arquivoRef.current?.click()}
                            disabled={!janelaAberta || enviando || enviandoMidia}
                            title="Anexar imagem, vídeo, áudio ou PDF"
                            className="shrink-0 rounded-lg border border-[var(--loop-border)] px-2 py-1.5 text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] disabled:opacity-50"
                          >
                            {enviandoMidia ? "Enviando…" : "📎"}
                          </button>
                        </>
                      )}
                      <span className="truncate text-xs text-[var(--loop-text-muted)]">
                        {erro ? (
                          <span className="text-[var(--loop-error)]">{erro}</span>
                        ) : (
                          `${texto.length} caractere${texto.length === 1 ? "" : "s"}`
                        )}
                      </span>
                    </div>
                    <Button
                      variant={modoNota ? "secondary" : "cta"}
                      size="sm"
                      disabled={
                        anexo
                          ? !janelaAberta || enviandoMidia
                          : (!janelaAberta && !modoNota) || enviando || !texto.trim()
                      }
                      onClick={anexo ? enviarAnexo : enviar}
                    >
                      {anexo
                        ? enviandoMidia
                          ? "Enviando…"
                          : "Enviar anexo"
                        : enviando
                          ? "Salvando…"
                          : modoNota
                            ? "Salvar nota"
                            : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Painel do contato: coluna lateral no desktop; no celular abre
                  como camada em tela cheia (verContato). */}
              {(painelAberto || verContato) && (
                <aside
                  className={`overflow-y-auto border-[var(--loop-border)] bg-[var(--loop-bg)] p-4 ${
                    verContato
                      ? "fixed inset-0 z-40 block"
                      : "hidden"
                  } ${
                    painelAberto
                      ? "lg:static lg:z-auto lg:block lg:w-72 lg:shrink-0 lg:border-l"
                      : "lg:hidden"
                  }`}
                >
                  {/* Cabeçalho só do celular: fechar a camada */}
                  <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex items-center justify-between border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-4 py-3 lg:hidden">
                    <span className="text-sm font-semibold text-[var(--loop-text)]">
                      Dados do contato
                    </span>
                    <button
                      type="button"
                      onClick={() => setVerContato(false)}
                      aria-label="Fechar"
                      className="rounded-lg border border-[var(--loop-border)] px-3 py-1 text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                    >
                      Fechar
                    </button>
                  </div>
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

      {novaConversa && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
          onClick={() => !ncEnviando && setNovaConversa(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--loop-border)] bg-[var(--loop-bg)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--loop-border)] px-4 py-3">
              <h3 className="font-semibold text-[var(--loop-text)]">
                Nova conversa
              </h3>
              <button
                type="button"
                onClick={() => setNovaConversa(false)}
                aria-label="Fechar"
                className="text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 text-sm">
              {/* De qual caixa (canal) enviar — só com +1 número. */}
              {canais.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                    Enviar pela caixa
                  </label>
                  <select
                    value={ncCanal ?? ""}
                    onChange={(e) => trocarCanalNovaConversa(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                  >
                    {canais.map((k) => (
                      <option key={k.phoneNumberId} value={k.phoneNumberId}>
                        {k.name}
                        {k.displayNumber ? ` · ${k.displayNumber}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Para: contato */}
              <div>
                <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                  Para
                </label>
                {ncNome || ncTelefone ? (
                  <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-3 py-2">
                    <span className="min-w-0 truncate text-[var(--loop-text)]">
                      {ncNome ? `${ncNome} · ` : ""}
                      {ncTelefone}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNcTelefone("");
                        setNcNome("");
                      }}
                      className="shrink-0 text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                      aria-label="Trocar contato"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <input
                      autoFocus
                      value={ncBuscaContato}
                      placeholder="Nome ou número com DDI (ex: 5511999998888)"
                      onChange={(e) => setNcBuscaContato(e.target.value)}
                      className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                    />
                    {ncLeads.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] shadow-lg">
                        {ncLeads.map((l) => (
                          <li key={l.id}>
                            <button
                              type="button"
                              onClick={() => selecionarLead(l)}
                              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--loop-bg-alt)]"
                            >
                              <span className="text-[var(--loop-text)]">
                                {l.nome ?? "Sem nome"}
                              </span>
                              <span className="text-xs text-[var(--loop-text-muted)]">
                                {l.telefone}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Via: número da conta */}
              <div>
                <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                  Via
                </label>
                <div className="mt-1 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-3 py-2 text-[var(--loop-text)]">
                  WhatsApp{numeroConta ? ` · ${numeroConta}` : ""}
                </div>
              </div>

              {/* Modelo */}
              <div>
                <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                  Modelo
                </label>
                {ncTemplate ? (
                  <div className="mt-1 rounded-lg border border-[var(--loop-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--loop-text)]">
                        {ncTemplate.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNcTemplate(null);
                          setNcVars([]);
                        }}
                        className="text-xs text-[var(--loop-primary)]"
                      >
                        Trocar
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--loop-text-muted)]">
                      {preencherPreview(ncTemplate.body, ncVars)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-1">
                    <input
                      value={ncBuscaModelo}
                      placeholder="Pesquisar modelos"
                      onChange={(e) => setNcBuscaModelo(e.target.value)}
                      className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                    />
                    <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--loop-border)]">
                      {ncTemplates === null ? (
                        <p className="p-3 text-xs text-[var(--loop-text-muted)]">
                          Carregando modelos…
                        </p>
                      ) : ncTemplates.length === 0 ? (
                        <p className="p-3 text-xs text-[var(--loop-text-muted)]">
                          Nenhum modelo aprovado. Crie e aprove templates na Meta.
                        </p>
                      ) : (
                        ncTemplates
                          .filter((t) =>
                            t.name
                              .toLowerCase()
                              .includes(ncBuscaModelo.trim().toLowerCase())
                          )
                          .map((t) => (
                            <button
                              key={`${t.name}-${t.language}`}
                              type="button"
                              onClick={() => selecionarTemplate(t)}
                              className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--loop-border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--loop-bg-alt)]"
                            >
                              <span className="font-medium text-[var(--loop-text)]">
                                {t.name}
                              </span>
                              <span className="line-clamp-2 text-xs text-[var(--loop-text-muted)]">
                                {t.body}
                              </span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Variáveis do modelo */}
              {ncTemplate && ncTemplate.variableCount > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                    Variáveis
                  </label>
                  {ncVars.map((v, i) => (
                    <input
                      key={i}
                      value={v}
                      placeholder={`Variável {{${i + 1}}}`}
                      onChange={(e) => {
                        const novo = [...ncVars];
                        novo[i] = e.target.value;
                        setNcVars(novo);
                      }}
                      className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                    />
                  ))}
                </div>
              )}

              {ncErro && (
                <p className="rounded-lg border border-[color-mix(in_srgb,var(--loop-error)_35%,var(--loop-border))] bg-[color-mix(in_srgb,var(--loop-error)_6%,transparent)] p-2 text-xs text-[var(--loop-text)]">
                  {ncErro}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--loop-border)] px-4 py-3">
              <Button
                variant="ghost"
                onClick={() => setNovaConversa(false)}
                disabled={ncEnviando}
              >
                Descartar
              </Button>
              <Button
                onClick={enviarNovaConversa}
                disabled={
                  ncEnviando ||
                  !ncTemplate ||
                  (!ncTelefone.trim() &&
                    ncBuscaContato.replace(/\D/g, "").length < 8)
                }
              >
                {ncEnviando ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gerenciador de respostas rápidas */}
      {gerenciarRespostas && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          onClick={() => setGerenciarRespostas(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[var(--loop-border)] bg-[var(--loop-bg)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--loop-border)] px-4 py-3">
              <div>
                <h3 className="font-semibold text-[var(--loop-text)]">
                  Respostas rápidas
                </h3>
                <p className="text-xs text-[var(--loop-text-muted)]">
                  No campo de resposta, digite <code>/atalho</code> para inserir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGerenciarRespostas(false)}
                aria-label="Fechar"
                className="text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4 text-sm">
              {/* Formulário criar/editar */}
              <div className="space-y-2 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                      Atalho (sem a barra)
                    </label>
                    <div className="mt-1 flex items-center rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2">
                      <span className="text-[var(--loop-text-muted)]">/</span>
                      <input
                        value={crShortcut}
                        onChange={(e) => setCrShortcut(e.target.value)}
                        placeholder="reembolso"
                        className="w-full bg-transparent px-1 py-2 text-[var(--loop-text)] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                      Título (opcional)
                    </label>
                    <input
                      value={crTitle}
                      onChange={(e) => setCrTitle(e.target.value)}
                      placeholder="Política de reembolso"
                      className="mt-1 w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--loop-text-muted)]">
                    Mensagem
                  </label>
                  <textarea
                    rows={4}
                    value={crContent}
                    onChange={(e) => setCrContent(e.target.value)}
                    placeholder="Oi! Sobre o reembolso: você tem até 7 dias…"
                    className="mt-1 w-full resize-none rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] outline-none focus:border-[var(--loop-primary)]"
                  />
                </div>
                {crErro && (
                  <p className="text-xs text-[var(--loop-error)]">{crErro}</p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="cta"
                    size="sm"
                    disabled={crSalvando}
                    onClick={salvarResposta}
                  >
                    {crSalvando
                      ? "Salvando…"
                      : crEditId
                        ? "Salvar alteração"
                        : "Adicionar"}
                  </Button>
                  {crEditId && (
                    <button
                      type="button"
                      onClick={limparFormResposta}
                      className="text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
              </div>

              {/* Lista */}
              {respostas.length === 0 ? (
                <p className="text-[var(--loop-text-muted)]">
                  Nenhuma resposta rápida ainda. Crie a primeira acima.
                </p>
              ) : (
                <div className="divide-y divide-[var(--loop-border)] rounded-lg border border-[var(--loop-border)]">
                  {respostas.map((r) => (
                    <div key={r.id} className="flex items-start gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--loop-primary)]">
                          /{r.shortcut}
                          {r.title && (
                            <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                              {r.title}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-[var(--loop-text-muted)]">
                          {r.content}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editarResposta(r)}
                        className="shrink-0 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirResposta(r.id)}
                        className="shrink-0 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-error)]"
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
