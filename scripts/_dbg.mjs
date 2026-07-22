import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "loopsale");
const EMAIL = "djeinebrustolin16@gmail.com";

const lead = await db.collection("leads").findOne({ email: EMAIL });
console.log("=== LEAD ===");
console.log(JSON.stringify({
  source: lead?.source, status: lead?.status,
  createdAt: lead?.createdAt, updatedAt: lead?.updatedAt,
}, null, 2));

const evs = await db.collection("checkout_events")
  .find({ customerEmail: EMAIL }).sort({ createdAt: 1 }).toArray();
console.log(`\n=== EVENTOS (${evs.length}) ===`);
for (const e of evs) {
  console.log(`${new Date(e.createdAt).toISOString()}  ${e.eventType}  amount=${e.amount ?? "-"} moeda=${e.currency ?? "-"}`);
}
await client.close();
