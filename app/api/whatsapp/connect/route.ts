import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import {
  exchangeCode,
  subscribeAppToWaba,
  getPhoneNumbers,
} from "@/lib/whatsapp/cloud";

type SessionUser = { accountId?: string };

/**
 * Finaliza o Embedded Signup: recebe o code + WABA + número do cliente,
 * troca o code por token, assina o app aos webhooks e salva na conta.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  const wabaId = typeof body.wabaId === "string" ? body.wabaId : "";
  let phoneNumberId =
    typeof body.phoneNumberId === "string" ? body.phoneNumberId : "";
  if (!code || !wabaId) {
    return NextResponse.json(
      { error: "Faltou o code ou a WABA do Embedded Signup." },
      { status: 400 }
    );
  }

  try {
    const token = await exchangeCode(code);

    // Assina o app da LoopSale aos eventos da WABA (best-effort).
    try {
      await subscribeAppToWaba(wabaId, token);
    } catch (e) {
      console.warn("whatsapp connect: subscribe falhou:", e);
    }

    // Descobre número/display se não veio.
    let displayNumber = "";
    try {
      const numbers = await getPhoneNumbers(wabaId, token);
      const chosen =
        numbers.find((n) => n.id === phoneNumberId) ?? numbers[0] ?? null;
      if (chosen) {
        phoneNumberId = phoneNumberId || chosen.id;
        displayNumber = chosen.displayPhoneNumber;
      }
    } catch (e) {
      console.warn("whatsapp connect: getPhoneNumbers falhou:", e);
    }

    const accountsCol = await getCollection("accounts");
    const accOid = await routeObjectId(su.accountId);
    if (accOid) {
      await accountsCol.updateOne(
        { _id: accOid },
        {
          $set: {
            "whatsapp.wabaId": wabaId,
            "whatsapp.phoneNumberId": phoneNumberId || null,
            "whatsapp.displayNumber": displayNumber || null,
            "whatsapp.accessToken": token,
            "whatsapp.connectedAt": new Date(),
            updatedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json({
      ok: true,
      wabaId,
      phoneNumberId,
      displayNumber,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao conectar WhatsApp.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
