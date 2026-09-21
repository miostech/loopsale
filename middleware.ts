import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Auth das áreas privadas + subdomínio dedicado do LoopChat.
 * Em chat.<domínio>, a raiz "/" cai direto no LoopChat (app dedicado).
 */
export default withAuth(
  function middleware(req) {
    const host = req.headers.get("host") || "";
    if (host.startsWith("chat.")) {
      const path = req.nextUrl.pathname;
      if (path === "/" || path === "") {
        const url = req.nextUrl.clone();
        url.pathname = "/loopchat";
        return NextResponse.rewrite(url);
      }
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ req, token }) => {
        const host = req.headers.get("host") || "";
        const path = req.nextUrl.pathname;
        // No subdomínio do chat, tudo (que passa pelo matcher) exige login.
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

export const config = {
  matcher: ["/dashboard/:path*", "/loopchat/:path*", "/loopchat", "/"],
};
