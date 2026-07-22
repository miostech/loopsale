import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const APPLY = process.argv.includes("--apply");
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "loopsale");
const leadsCol = db.collection("leads");
const cartsCol = db.collection("abandoned_checkouts");

// Regra: "purchased" (Comprou/recuperado) só vale se existe carrinho rastreado
// (abandono/recusa) para o cliente. Sem carrinho = venda direta = "paid".
const purchased = await leadsCol.find({ status: "purchased" }).toArray();
let toPaid = 0;
const changes = [];
for (const lead of purchased) {
  const or = [];
  if (lead.email) or.push({ customerEmail: lead.email });
  if (lead.phone) or.push({ customerPhone: lead.phone });
  const cart = or.length ? await cartsCol.findOne({ accountId: lead.accountId, $or: or }) : null;
  if (!cart) {
    toPaid++;
    changes.push({ email: lead.email, source: lead.source });
    if (APPLY) {
      const set = { status: "paid", updatedAt: new Date() };
      if (lead.source === "checkout") set.source = "approved";
      await leadsCol.updateOne({ _id: lead._id }, { $set: set });
    }
  }
}
console.log(`Leads "purchased": ${purchased.length}`);
console.log(`Sem carrinho rastreado (viram "paid"): ${toPaid}`);
for (const c of changes.slice(0, 20))
  console.log(`  ${c.email}  (source ${c.source}${c.source === "checkout" ? " → approved" : ""})`);
if (changes.length > 20) console.log(`  ... +${changes.length - 20}`);
console.log(APPLY ? "\nAPLICADO." : "\n(dry-run — rode com --apply para aplicar)");
await client.close();
