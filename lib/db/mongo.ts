import type { Db } from "mongodb";
import { isDatabaseDisabled } from "./config";

let client: import("mongodb").MongoClient | null = null;
let cachedDb: Db | null = null;

function uri(): string {
  return (
    process.env.MONGODB_URI ??
    process.env.DATABASE_URL ??
    "mongodb://localhost:27017"
  );
}

function dbName(): string {
  return process.env.MONGODB_DB ?? "loopsale";
}

export async function connectDb(): Promise<Db> {
  if (isDatabaseDisabled()) {
    throw new Error(
      "MongoDB desativado: remova DATABASE_DISABLED do .env para conectar."
    );
  }
  if (cachedDb) return cachedDb;
  const { MongoClient } = await import("mongodb");
  if (!client) {
    client = new MongoClient(uri());
  }
  await client.connect();
  cachedDb = client.db(dbName());
  return cachedDb;
}

export async function getDb(): Promise<Db> {
  if (isDatabaseDisabled()) {
    throw new Error(
      "getDb() não está disponível com DATABASE_DISABLED. Use getCollection()."
    );
  }
  if (cachedDb) return cachedDb;
  return connectDb();
}
