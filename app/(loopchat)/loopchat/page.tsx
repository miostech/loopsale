import { redirect } from "next/navigation";
import { chatContext } from "@/lib/loopchat/access";
import { canSendFor } from "@/lib/whatsapp/cloud";
import { LoopChatClient } from "./LoopChatClient";
import { LoopChatLocked } from "./LoopChatLocked";

/**
 * LoopChat. Quem tem atendimento gerenciado não entra: quem responde é a
 * LoopSale, então a área nem aparece no menu e a rota volta pro dashboard.
 */
export default async function LoopChatPage() {
  const ctx = await chatContext();
  if (!ctx) redirect("/login");
  if (ctx.access === "hidden") redirect("/dashboard");

  if (ctx.access === "locked") {
    // Estourou a cota do plano (Pro/Escala) vs. plano sem chat grátis (Free).
    const estourou =
      ctx.chatQuota !== null &&
      ctx.chatQuota > 0 &&
      ctx.monthlyConversations > ctx.chatQuota;
    return (
      <div className="p-6">
        <LoopChatLocked
          isAdmin={ctx.role === "admin"}
          motivo={estourou ? "over" : "free"}
          cota={ctx.chatQuota}
          usadas={ctx.monthlyConversations}
        />
      </div>
    );
  }

  // Pode enviar = tem token próprio OU está na WABA central (legado). Bater com
  // a regra real de envio evita travar o botão de conta que envia pela central.
  // A conta demo é vitrine: libera o envio (que é simulado no backend).
  const podeEnviar =
    !!ctx.account?.isDemo ||
    canSendFor(
      ctx.account?.whatsapp?.accessToken,
      ctx.account?.whatsapp?.source
    );

  return (
    <LoopChatClient
      whatsappConectado={podeEnviar}
      numeroConta={ctx.account?.whatsapp?.displayNumber ?? null}
    />
  );
}
