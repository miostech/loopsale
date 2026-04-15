import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateRecoveryMessage } from "@/lib/ai/generate-message";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await generateRecoveryMessage({
    productName: body.productName,
    amount: body.amount,
    channel: body.channel ?? "whatsapp",
    tone: body.tone,
  });

  if (result.error && !result.text) {
    return NextResponse.json(
      { error: result.error, text: null },
      { status: 400 }
    );
  }

  return NextResponse.json({ text: result.text, error: result.error });
}
