/**
 * Cria um usuário de teste. Execute: yarn db:seed (ou npx tsx scripts/seed.ts)
 * Requer MONGODB_URI ou DATABASE_URL (connection string do MongoDB) no .env.
 *
 * Credenciais: teste@loopsale.com / teste123
 */
import { getDb, getCollection, isDatabaseDisabled } from "../lib/db";
import { hashPassword } from "../lib/auth-server";
import type { Account, User } from "../lib/db/types";

const TEST_EMAIL = "teste@loopsale.com";
const TEST_PASSWORD = "teste123";
const TEST_NAME = "Usuário Teste";

async function seed() {
  if (isDatabaseDisabled()) {
    console.error("Desative DATABASE_DISABLED no .env para rodar o seed.");
    process.exit(1);
  }
  await getDb();
  const usersCol = await getCollection("users");
  const existing = await usersCol.findOne({ email: TEST_EMAIL });
  if (existing) {
    console.log("Usuário de teste já existe. Use:");
    console.log("  E-mail:", TEST_EMAIL);
    console.log("  Senha:", TEST_PASSWORD);
    process.exit(0);
    return;
  }

  const accountsCol = await getCollection("accounts");
  const now = new Date();
  const accountDoc: Account = {
    name: "Conta Teste",
    slug: "teste-" + Date.now(),
    createdAt: now,
    updatedAt: now,
  };
  const accountResult = await accountsCol.insertOne(accountDoc as Account & { _id?: unknown });
  const accountId = accountResult.insertedId.toString();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const userDoc: User = {
    accountId,
    email: TEST_EMAIL,
    name: TEST_NAME,
    passwordHash,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  };
  await usersCol.insertOne(userDoc as User & { _id?: unknown });

  console.log("Usuário de teste criado com sucesso.");
  console.log("");
  console.log("  E-mail:", TEST_EMAIL);
  console.log("  Senha:", TEST_PASSWORD);
  console.log("");
  console.log("Acesse /login para entrar.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
