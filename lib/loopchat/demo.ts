import type { ChatContext } from "@/lib/loopchat/access";

/** true quando a sessão é da conta de demonstração (demo@loopsale.com.br). */
export function isDemoContext(ctx: ChatContext | null): boolean {
  return !!ctx?.account?.isDemo;
}

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

type DemoConversa = {
  contact: string;
  nome: string;
  status: "open" | "pending" | "snoozed" | "resolved";
  minhas?: boolean;
  naoAtribuida?: boolean;
  labels: string[];
  priority: string | null;
  ultimoTexto: string;
  ultimaDirecao: "in" | "out";
  haMs: number;
  janelaAberta: boolean;
  naoLidas: number;
  total: number;
  snoozeMs?: number;
};

/**
 * Conversas fixas do modo demo. Ficam iguais a cada carregamento — servem só
 * para a pessoa ver como o LoopChat funciona, sem nenhum dado real.
 */
const CONVERSAS: DemoConversa[] = [
  {
    contact: "5511998877001",
    nome: "Ana Beatriz",
    status: "open",
    labels: ["carrinho"],
    priority: "high",
    ultimoTexto: "Oi! Ainda dá pra garantir aquele desconto?",
    ultimaDirecao: "in",
    haMs: 8 * MIN,
    janelaAberta: true,
    naoLidas: 2,
    total: 6,
  },
  {
    contact: "5511998877002",
    nome: "Carlos Mendes",
    status: "open",
    minhas: true,
    labels: ["vip"],
    priority: "urgent",
    ultimoTexto: "Perfeito, pode emitir a segunda via então.",
    ultimaDirecao: "in",
    haMs: 35 * MIN,
    janelaAberta: true,
    naoLidas: 1,
    total: 12,
  },
  {
    contact: "5511998877003",
    nome: "Juliana Prado",
    status: "open",
    naoAtribuida: true,
    labels: [],
    priority: null,
    ultimoTexto: "Enviamos o link de pagamento atualizado 👍",
    ultimaDirecao: "out",
    haMs: 2 * HORA,
    janelaAberta: true,
    naoLidas: 0,
    total: 4,
  },
  {
    contact: "5511998877004",
    nome: "Rafael Souza",
    status: "pending",
    labels: ["carrinho", "suporte"],
    priority: "medium",
    ultimoTexto: "Vou verificar com o financeiro e te retorno.",
    ultimaDirecao: "out",
    haMs: 5 * HORA,
    janelaAberta: false,
    naoLidas: 0,
    total: 9,
  },
  {
    contact: "5511998877005",
    nome: "Marina Lopes",
    status: "snoozed",
    labels: ["vip"],
    priority: null,
    ultimoTexto: "Me lembra amanhã de manhã, por favor.",
    ultimaDirecao: "in",
    haMs: 26 * HORA,
    janelaAberta: false,
    naoLidas: 0,
    total: 7,
    snoozeMs: 14 * HORA,
  },
  {
    contact: "5511998877006",
    nome: "Pedro Henrique",
    status: "resolved",
    minhas: true,
    labels: [],
    priority: null,
    ultimoTexto: "Show, muito obrigado pela ajuda! 🙌",
    ultimaDirecao: "in",
    haMs: 2 * DIA,
    janelaAberta: false,
    naoLidas: 0,
    total: 15,
  },
];

/** Payload do GET /conversations no modo demo. */
export function demoConversasPayload(usuarioAtual: string | null) {
  const agora = Date.now();
  const uso = new Map<string, number>();
  for (const c of CONVERSAS) {
    for (const l of c.labels) uso.set(l, (uso.get(l) ?? 0) + 1);
  }
  return {
    usuarioAtual,
    etiquetas: [...uso.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    conversas: CONVERSAS.map((c) => ({
      contact: c.contact,
      status: c.status,
      snoozedUntil: c.snoozeMs ? new Date(agora + c.snoozeMs) : null,
      assigneeId: c.minhas ? usuarioAtual : c.naoAtribuida ? null : "demo-colega",
      assigneeNome: c.minhas
        ? "Você"
        : c.naoAtribuida
          ? null
          : "Luiza (equipe)",
      labels: c.labels,
      priority: c.priority,
      nome: c.nome,
      ultimaEm: new Date(agora - c.haMs),
      ultimoTexto: c.ultimoTexto,
      ultimaDirecao: c.ultimaDirecao,
      janelaAberta: c.janelaAberta,
      naoLidas: c.naoLidas,
      total: c.total,
    })),
  };
}

/** Threads fixas por contato, para o GET /messages no modo demo. */
const THREADS: Record<string, { dir: "in" | "out"; body: string; haMs: number; nota?: boolean }[]> = {
  "5511998877001": [
    { dir: "out", body: "Oi Ana! Vi que você começou a compra do Método HPA mas não finalizou. Posso te ajudar?", haMs: 40 * MIN },
    { dir: "in", body: "Oi! É que fiquei com uma dúvida no valor.", haMs: 30 * MIN },
    { dir: "out", body: "Claro! Hoje ele está com 20% de desconto no boleto ou Pix.", haMs: 22 * MIN },
    { dir: "in", body: "Oi! Ainda dá pra garantir aquele desconto?", haMs: 8 * MIN },
  ],
  "5511998877002": [
    { dir: "in", body: "Bom dia, comprei ontem mas não recebi o acesso.", haMs: 3 * HORA },
    { dir: "out", body: "Bom dia, Carlos! Já verifico aqui pra você.", haMs: 2.5 * HORA },
    { dir: "out", body: "Reenviei o acesso para o seu e-mail agora.", haMs: 2 * HORA },
    { dir: "in", body: "Perfeito, pode emitir a segunda via então.", haMs: 35 * MIN },
  ],
  "5511998877003": [
    { dir: "in", body: "O link de pagamento expirou 😕", haMs: 3 * HORA },
    { dir: "out", body: "Sem problema, já te mando um novo.", haMs: 2.2 * HORA },
    { dir: "out", body: "Enviamos o link de pagamento atualizado 👍", haMs: 2 * HORA },
  ],
  "5511998877004": [
    { dir: "in", body: "Consigo parcelar em mais vezes?", haMs: 7 * HORA },
    { dir: "out", body: "Deixa eu confirmar as condições.", haMs: 6 * HORA },
    { dir: "in", body: "Beleza, aguardo!", haMs: 5.5 * HORA },
    { dir: "out", body: "Vou verificar com o financeiro e te retorno.", haMs: 5 * HORA },
  ],
  "5511998877005": [
    { dir: "out", body: "Oi Marina! Tudo bem? Passando pra saber se ficou alguma dúvida.", haMs: 28 * HORA },
    { dir: "in", body: "Me lembra amanhã de manhã, por favor.", haMs: 26 * HORA },
  ],
  "5511998877006": [
    { dir: "in", body: "Não consigo acessar a área de membros.", haMs: 2.2 * DIA },
    { dir: "out", body: "Vou te ajudar! Qual e-mail você usou na compra?", haMs: 2.15 * DIA },
    { dir: "in", body: "pedro@email.com", haMs: 2.1 * DIA },
    { dir: "out", body: "Prontinho, liberei o acesso. Pode testar agora.", haMs: 2.05 * DIA },
    { dir: "in", body: "Show, muito obrigado pela ajuda! 🙌", haMs: 2 * DIA },
  ],
};

/** Templates aprovados fictícios, para o compositor de nova conversa no demo. */
export function demoTemplates() {
  return [
    {
      name: "checkout_abandonado",
      language: "pt_BR",
      body: "Olá {{1}}, tudo bem? Vi que você demonstrou interesse no *{{2}}* mas a compra ainda não foi concluída. Posso te ajudar a finalizar?",
      variableCount: 2,
    },
    {
      name: "boleto_vencendo",
      language: "pt_BR",
      body: "Oi {{1}}! Seu boleto do *{{2}}* vence hoje. Quer que eu gere um novo link de pagamento?",
      variableCount: 2,
    },
    {
      name: "pos_venda",
      language: "pt_BR",
      body: "Olá {{1}}! Já faz alguns dias desde a sua compra. Como está sendo sua experiência? Qualquer dúvida, é só chamar.",
      variableCount: 1,
    },
  ];
}

/** Payload do GET /messages no modo demo para um contato. */
export function demoMensagensPayload(contact: string) {
  const agora = Date.now();
  const conv = CONVERSAS.find((c) => c.contact === contact);
  const thread = THREADS[contact] ?? [];
  return {
    contact,
    janelaAberta: conv?.janelaAberta ?? false,
    mensagens: thread.map((m, i) => ({
      id: `demo-${contact}-${i}`,
      direction: m.dir,
      internal: !!m.nota,
      authorName: m.dir === "out" ? "Você" : null,
      body: m.body,
      type: "text",
      templateName: null,
      status: m.dir === "out" ? "read" : null,
      error: null,
      createdAt: new Date(agora - m.haMs),
    })),
  };
}
