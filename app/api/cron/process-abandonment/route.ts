import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron/auth";
import { processAbandonmentForAccount } from "@/lib/webhooks/process-event";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountsCol = await getCollection("accounts");
  const allAccounts = await accountsCol.find({}).project({ _id: 1 }).toArray();
  for (const acc of allAccounts) {
    await processAbandonmentForAccount(acc._id.toString());
  }

  return NextResponse.json({ ok: true, processed: allAccounts.length });
}

export async function POST(request: Request) {
  return GET(request);
}
