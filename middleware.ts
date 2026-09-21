import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Auth das áreas privadas + subdomínio dedicado do LoopChat.
 * Em chat.<domínio> a pessoa só acessa o LoopChat: qualquer outra rota volta
 * para /loopchat (a home "/" também). No domínio principal, nada muda.
 */
export default withAuth(
  function middleware(req) {
    const host = req.headers.get("host") || "";
    if (host.startsWith("chat.")) {
      const path = req.nextUrl.pathname;
      // Só o LoopChat e o login passam; o resto cai no chat.
      if (path.startsWith("/loopchat") || path === "/login") {
        return NextResponse.next();
      }
      const url = req.nextUrl.clone();
      url.pathname = "/loopchat";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ req, token }) => {
        const host = req.headers.get("host") || "";
        const path = req.nextUrl.pathname;
        // No subdomínio do chat, tudo exige login.
        if (host.startsWith("chat.")) return !!token;
        // No domínio principal, protege só dashboard e loopchat.
        if (path.startsWith("/dashboard") || path.startsWith("/loopchat")) {
          return !!token;
        }
        return true; // home e demais rotas públicas
      },
    },
  }
);

// Roda em todas as rotas de página (exclui api, assets do _next e arquivos com
// extensão) — assim consegue travar o subdomínio para qualquer rota.
export const config = {
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};
