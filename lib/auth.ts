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
        if (!credentials?.email || !credentials?.password) return null;

        if (isDatabaseDisabled()) {
          if (
            String(credentials.email) === DEMO_EMAIL &&
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
          return null;
        }

        const users = await getCollection("users");
        const user = await users.findOne({ email: String(credentials.email) });
        if (!user || !(await bcrypt.compare(String(credentials.password), (user as User).passwordHash)))
          return null;
        const mapped = mapDoc(user as User & { _id: unknown });
        if (!mapped) return null;
        return {
          id: mapped.id,
          email: mapped.email,
          name: mapped.name,
          accountId: mapped.accountId,
          role: mapped.role,
        };
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
