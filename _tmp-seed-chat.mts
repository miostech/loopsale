export {};
import { MongoClient } from "mongodb";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const ACC = "6a687ca3b7435b7b0f094138"; // Loja Demonstração
const SEED = "demo-loopchat"; // marcador para conseguir apagar tudo depois
const PNID = "seed-phone-number-id";

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const db = client.db(env.MONGODB_DB || "loopsale");

// Limpa execuções anteriores deste seed (idempotente).
for (const c of ["whatsapp_messages", "leads", "abandoned_checkouts"]) {
  const r = await db.collection(c).deleteMany({ seed: SEED });
  if (r.deletedCount) console.log(`limpou ${r.deletedCount} de ${c}`);
}

const min = (n: number) => n * 60 * 1000;
const hr = (n: number) => n * 60 * min(1);
const agora = Date.now();
const em = (msAtras: number) => new Date(agora - msAtras);

const contatos = [
  {
    contact: "5511987654321",
    nome: "Mariana Alves",
    email: "mariana.alves@email.com",
    status: "hot",
    tags: ["checkout-abandonado", "quente"],
    checkouts: [
      { produto: "Fórmula da Renda Extra", valor: "197.00", recuperado: false, atras: hr(30) },
      { produto: "Combo Marketing Digital", valor: "297.00", recuperado: true, atras: hr(24 * 40) },
    ],
    msgs: [
      { dir: "out", tpl: "recuperacao_checkout_1", body: "Oi Mariana! Vi que você não finalizou a compra do Fórmula da Renda Extra. Posso ajudar?", status: "read", atras: hr(5) },
      { dir: "in", body: "Oi! Vi sim, mas fiquei com uma dúvida", status: "received", atras: hr(4) + min(50) },
      { dir: "in", body: "O curso tem certificado no final?", status: "received", atras: hr(4) + min(48) },
      { dir: "out", body: "Tem sim! Certificado de conclusão liberado assim que você termina os módulos 🎓", status: "read", atras: hr(4) },
      { dir: "in", body: "Perfeito. E o pagamento posso parcelar?", status: "received", atras: min(35) },
      { dir: "in", body: "Consigo em 12x?", status: "received", atras: min(32) },
    ],
  },
  {
    contact: "5521998877665",
    nome: "Rafael Monteiro",
    email: "rafael.monteiro@email.com",
    status: "purchased",
    tags: ["cliente"],
    checkouts: [
      { produto: "Combo Marketing Digital", valor: "297.00", recuperado: true, atras: hr(24 * 3) },
    ],
    msgs: [
      { dir: "out", tpl: "recuperacao_checkout_1", body: "Rafael, seu carrinho do Combo Marketing Digital ainda está aberto. Quer finalizar?", status: "read", atras: hr(24 * 3 + 2) },
      { dir: "in", body: "Vou finalizar agora, obrigado!", status: "received", atras: hr(24 * 3 + 1) },
      { dir: "out", body: "Show! Qualquer coisa é só chamar por aqui 🚀", status: "delivered", atras: hr(24 * 3) },
    ],
  },
  {
    contact: "5531991234567",
    nome: null, // não está na base: mostra o número no lugar do nome
    email: null,
    status: null,
    tags: [],
    checkouts: [],
    msgs: [
      { dir: "in", body: "Boa tarde, vocês ainda estão com a promoção?", status: "received", atras: min(12) },
    ],
  },
];

const msgs = [];
const leads = [];
const checkouts = [];

for (const c of contatos) {
  if (c.nome) {
    leads.push({
      seed: SEED,
      accountId: ACC,
      name: c.nome,
      email: c.email,
      phone: c.contact,
      source: "seed",
      status: c.status,
      tags: c.tags,
      createdAt: em(hr(24 * 60)),
      updatedAt: em(hr(1)),
    });
  }
  for (const ck of c.checkouts) {
    checkouts.push({
      seed: SEED,
      accountId: ACC,
      checkoutEventId: `seed-${Math.random().toString(36).slice(2)}`,
      platform: "kiwify",
      platformCheckoutId: `seed-${Math.random().toString(36).slice(2)}`,
      customerPhone: c.contact,
      customerEmail: c.email,
      productName: ck.produto,
      amount: ck.valor,
      currency: "BRL",
      recoveredAt: ck.recuperado ? em(ck.atras - hr(1)) : null,
      paidAt: null,
      createdAt: em(ck.atras),
      updatedAt: em(ck.atras),
    });
  }
  for (const m of c.msgs) {
    msgs.push({
      seed: SEED,
      accountId: ACC,
      direction: m.dir,
      wamid: `seed-${Math.random().toString(36).slice(2)}`,
      phoneNumberId: PNID,
      contact: c.contact,
      type: m.tpl ? "template" : "text",
      body: m.body,
      templateName: m.tpl ?? null,
      status: m.status,
      createdAt: em(m.atras),
      updatedAt: em(m.atras),
    });
  }
}

if (leads.length) await db.collection("leads").insertMany(leads as never);
if (checkouts.length) await db.collection("abandoned_checkouts").insertMany(checkouts as never);
await db.collection("whatsapp_messages").insertMany(msgs as never);

console.log(`criados: ${msgs.length} mensagens, ${leads.length} leads, ${checkouts.length} checkouts`);
console.log("todos marcados com seed:", SEED);
await client.close();
