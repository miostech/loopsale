import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import type { Account, User } from "@/lib/db/types";

const DEMO_EMAIL = "demo@loopsale.com";
const DEMO_PASSWORD = "demo123";
const DEMO_NAME = "Usuário Demo";

export async function GET() {
  function credentials() {
    return NextResponse.json({
      ok: true,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
  }

  try {
    if (isDatabaseDisabled()) {
      return credentials();
    }
    const usersCol = await getCollection("users");
    const existing = await usersCol.findOne({ email: DEMO_EMAIL });
    if (existing) {
      return credentials();
    }

    const accountsCol = await getCollection("accounts");
    const now = new Date();
    const accountDoc: Account = {
      name: "Conta Demo",
      slug: "demo-" + Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    const accountResult = await accountsCol.insertOne(accountDoc as Account & { _id?: unknown });
    const accountId = accountResult.insertedId.toString();
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const userDoc: User = {
      accountId,
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    };
    await usersCol.insertOne(userDoc as User & { _id?: unknown });
    return credentials();
  } catch (err) {
    console.error("ensure-demo-user:", err);
    return credentials();
  }
}
