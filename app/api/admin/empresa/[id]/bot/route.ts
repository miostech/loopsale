import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";

type SessionUser = { email?: string | null };

/** Configura o robô de atendimento (IA) da conta. Só super-admin. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível" }, { status: 503 });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const enabled = !!body.enabled;
  const instructions =
    typeof body.instructions === "string" ? body.instructions.trim().slice(0, 8000) : "";
  const knowledge =
    typeof body.knowledge === "string" ? body.knowledge.trim().slice(0, 8000) : "";
  // Automação: minutos p/ auto-resolver (0 = off, teto 1 dia), fechar ao
  // encerrar e aprender com a equipe.
  const autoResolveMinutes = Math.min(
    1440,
    Math.max(0, Math.floor(Number(body.autoResolveMinutes) || 0))
  );
  const closeOnFinish = !!body.closeOnFinish;
  const learnFromTeam = !!body.learnFromTeam;

  // Janela de handoff (horário do atendimento humano).
  const h = (body.handoffHours ?? {}) as {
    enabled?: unknown;
    timezone?: unknown;
    days?: unknown;
    start?: unknown;
    end?: unknown;
  };
  const diasValidos = Array.isArray(h.days)
    ? [...new Set(h.days.map((n) => Math.floor(Number(n))).filter((n) => n >= 0 && n <= 6))]
    : [1, 2, 3, 4, 5];
  const handoffHours = {
    enabled: !!h.enabled,
    timezone:
      typeof h.timezone === "string" && h.timezone.trim()
        ? h.timezone.trim()
        : "Europe/Lisbon",
    days: diasValidos,
    start: Math.min(23, Math.max(0, Math.floor(Number(h.start) || 0))),
    end: Math.min(24, Math.max(1, Math.floor(Number(h.end) || 19))),
  };

  const accountsCol = await getCollection("accounts");
  await accountsCol.updateOne(
    { _id: oid },
    {
      $set: {
        "attendantBot.enabled": enabled,
        "attendantBot.instructions": instructions || null,
        "attendantBot.knowledge": knowledge || null,
        "attendantBot.autoResolveMinutes": autoResolveMinutes || null,
        "attendantBot.closeOnFinish": closeOnFinish,
        "attendantBot.learnFromTeam": learnFromTeam,
        "attendantBot.handoffHours": handoffHours,
        updatedAt: new Date(),
      },
    }
  );
  return NextResponse.json({
    ok: true,
    enabled,
    instructions,
    knowledge,
    autoResolveMinutes,
    closeOnFinish,
    learnFromTeam,
    handoffHours,
  });
}
