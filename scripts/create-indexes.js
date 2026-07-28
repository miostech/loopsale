/**
 * Cria índices por accountId (isolamento multi-tenant + performance).
 * Uso: MONGODB_URI="..." MONGODB_DB=loopsale node scripts/create-indexes.js
 * Idempotente: rodar de novo não duplica nada.
 */
const { MongoClient } = require("mongodb");

const URI = process.env.MONGODB_URI;
const DB = process.env.MONGODB_DB || "loopsale";

// [coleção, [ { chave }, ... ]]
const INDEXES = [
  ["leads", [{ accountId: 1, createdAt: -1 }, { accountId: 1, status: 1 }]],
  ["abandoned_checkouts", [
    { accountId: 1, recoveredAt: -1 },
    { accountId: 1, status: 1 },
    { accountId: 1, createdAt: -1 },
  ]],
  ["checkout_events", [
    { accountId: 1, createdAt: -1 },
    { accountId: 1, platformCheckoutId: 1 },
  ]],
  ["commissions", [{ accountId: 1, createdAt: -1 }]],
  ["message_templates", [{ accountId: 1 }]],
  ["campaigns", [{ accountId: 1 }]],
  ["campaign_steps", [{ accountId: 1 }]],
  ["campaign_variants", [{ accountId: 1 }]],
  ["scheduled_campaign_messages", [{ accountId: 1 }, { status: 1, runAt: 1 }]],
  ["recovery_flows", [{ accountId: 1 }]],
  ["recovery_flow_steps", [{ accountId: 1 }]],
  ["scheduled_recovery_messages", [{ accountId: 1 }, { status: 1, runAt: 1 }]],
  ["lead_segments", [{ accountId: 1 }]],
  ["products", [{ accountId: 1 }]],
  ["integrations", [{ accountId: 1 }]],
  ["demo_requests", [{ createdAt: -1 }, { status: 1 }]],
];

(async () => {
  if (!URI) throw new Error("MONGODB_URI não definido.");
  const c = new MongoClient(URI);
  await c.connect();
  const db = c.db(DB);
  for (const [name, keys] of INDEXES) {
    for (const key of keys) {
      const res = await db.collection(name).createIndex(key);
      console.log(`  ${name}: ${JSON.stringify(key)} -> ${res}`);
    }
  }
  await c.close();
  console.log("OK — índices criados/garantidos.");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
