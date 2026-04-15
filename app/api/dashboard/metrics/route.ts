import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDashboardMetrics,
  getDashboardDailyMetrics,
} from "@/lib/dashboard/metrics";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const periodDays = Math.min(
    90,
    Math.max(1, Number(url.searchParams.get("days")) || 30)
  );
  const includeDaily = url.searchParams.get("daily") === "true";

  const metrics = await getDashboardMetrics(session.user.accountId, periodDays);
  const body: Record<string, unknown> = { ...metrics };
  if (includeDaily) {
    body.daily = await getDashboardDailyMetrics(
      session.user.accountId,
      periodDays
    );
  }
  return NextResponse.json(body);
}
