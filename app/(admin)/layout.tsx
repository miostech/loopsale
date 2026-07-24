import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // Área exclusiva do dono da LoopSale — quem não é super-admin volta pro app.
  if (!isSuperAdmin(session.user?.email)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[var(--loop-bg-alt)]">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-4 md:px-6">
        <div className="flex items-center gap-3">
          <LoopSaleLogo href="/admin" variant="full" />
          <span className="rounded-full bg-[var(--loop-primary-muted)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--loop-primary)]">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
          >
            Ir para o app →
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
