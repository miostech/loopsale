import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { MetaReviewClient } from "./MetaReviewClient";

// Rota própria (fora do /admin), aberta a qualquer usuário logado — não é mais
// restrita ao time LoopSale. O login continua obrigatório.
export default async function MetaReviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const isAdmin = isSuperAdmin(session.user?.email);

  return (
    <div className="min-h-screen bg-[var(--loop-bg-alt)]">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-4 md:px-6">
        <div className="flex items-center gap-3">
          <LoopSaleLogo href="/meta-review" variant="full" />
          <span className="rounded-full bg-[var(--loop-primary-muted)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--loop-primary)]">
            Meta Review
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/admin"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Admin →
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4 md:p-6">
        <MetaReviewClient />
      </main>
    </div>
  );
}
