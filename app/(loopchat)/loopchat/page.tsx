import { redirect } from "next/navigation";
import { chatContext } from "@/lib/loopchat/access";
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
    return (
      <div className="p-6">
        <LoopChatLocked isAdmin={ctx.role === "admin"} />
      </div>
    );
  }

  return (
    <LoopChatClient
      whatsappConectado={!!ctx.account?.whatsapp?.accessToken}
      numeroConta={ctx.account?.whatsapp?.displayNumber ?? null}
    />
  );
}
