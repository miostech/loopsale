import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getCollection, mapDoc, isDatabaseDisabled } from "@/lib/db";
import type { User } from "@/lib/db/types";

const DEMO_EMAIL = process.env.DEMO_LOGIN_EMAIL ?? "demo@loopsale.com";
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? "demo123";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!process.env.NEXTAUTH_SECRET) {
          console.error(
            "[auth] NEXTAUTH_SECRET não definido — o login vai falhar. Configure a variável no ambiente."
          );
        }

        if (!credentials?.email || !credentials?.password) {
          console.warn("[auth] credenciais ausentes (email/senha vazios).");
          return null;
        }

        const email = String(credentials.email).trim();

        if (isDatabaseDisabled()) {
          if (
            email === DEMO_EMAIL &&
            String(credentials.password) === DEMO_PASSWORD
          ) {
            return {
              id: "000000000000000000000001",
              email: DEMO_EMAIL,
              name: "Modo demo (sem banco)",
              accountId: "000000000000000000000002",
              role: "admin",
            };
          }
          console.warn(
            "[auth] DATABASE_DISABLED ativo: só o login demo funciona e as credenciais não conferem."
          );
          return null;
        }

        try {
          const users = await getCollection("users");
          const user = await users.findOne({ email });
          if (!user) {
            console.warn(`[auth] usuário não encontrado para email="${email}".`);
            return null;
          }
          const passwordOk = await bcrypt.compare(
            String(credentials.password),
            (user as User).passwordHash ?? ""
          );
          if (!passwordOk) {
            console.warn(`[auth] senha incorreta para email="${email}".`);
            return null;
          }
          const mapped = mapDoc(user as User & { _id: unknown });
          if (!mapped) return null;
          return {
            id: mapped.id,
            email: mapped.email,
            name: mapped.name,
            accountId: mapped.accountId,
            role: mapped.role,
          };
        } catch (err) {
          console.error(
            "[auth] erro ao consultar o banco no login (verifique MONGODB_URI e o IP allowlist do Atlas):",
            err
          );
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accountId = (user as { accountId?: string }).accountId ?? "";
        token.role = (user as { role?: string }).role ?? "member";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { accountId?: string }).accountId = token.accountId as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
