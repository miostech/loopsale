"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface Me {
  name: string | null;
  email: string;
  role: string;
  account: { name: string; slug: string };
  demo?: boolean;
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isSelf?: boolean;
}

function Feedback({ ok, err }: { ok?: string; err?: string }) {
  if (ok)
    return <p className="text-sm text-[var(--loop-success)]">{ok}</p>;
  if (err) return <p className="text-sm text-[var(--loop-error)]">{err}</p>;
  return null;
}

export default function ConfiguracoesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Perfil
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok?: string; err?: string }>({});

  // Senha
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<{ ok?: string; err?: string }>({});

  // Conta
  const [accName, setAccName] = useState("");
  const [savingAcc, setSavingAcc] = useState(false);
  const [accMsg, setAccMsg] = useState<{ ok?: string; err?: string }>({});

  // Novo membro
  const [mName, setMName] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPass, setMPass] = useState("");
  const [mRole, setMRole] = useState("member");
  const [addingMember, setAddingMember] = useState(false);
  const [memberMsg, setMemberMsg] = useState<{ ok?: string; err?: string }>({});

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, memRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/account/members"),
      ]);
      const meData = (await meRes.json()) as Me;
      const memData = await memRes.json();
      setMe(meData);
      setName(meData.name ?? "");
      setAccName(meData.account?.name ?? "");
      setMembers(Array.isArray(memData) ? memData : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = me?.role === "admin";
  const roleLabel = (r: string) => (r === "admin" ? "Administrador" : "Membro");

  async function saveName() {
    setNameMsg({});
    setSavingName(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) setNameMsg({ err: data.error ?? "Erro ao salvar." });
      else setNameMsg({ ok: "Nome atualizado." });
    } catch {
      setNameMsg({ err: "Erro de rede." });
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    setPassMsg({});
    setSavingPass(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) setPassMsg({ err: data.error ?? "Erro ao trocar a senha." });
      else {
        setPassMsg({ ok: "Senha alterada." });
        setCurPass("");
        setNewPass("");
      }
    } catch {
      setPassMsg({ err: "Erro de rede." });
    } finally {
      setSavingPass(false);
    }
  }

  async function saveAccount() {
    setAccMsg({});
    setSavingAcc(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: accName }),
      });
      const data = await res.json();
      if (!res.ok) setAccMsg({ err: data.error ?? "Erro ao salvar." });
      else setAccMsg({ ok: "Conta atualizada." });
    } catch {
      setAccMsg({ err: "Erro de rede." });
    } finally {
      setSavingAcc(false);
    }
  }

  async function addMember() {
    setMemberMsg({});
    setAddingMember(true);
    try {
      const res = await fetch("/api/account/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mName,
          email: mEmail,
          password: mPass,
          role: mRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) setMemberMsg({ err: data.error ?? "Erro ao adicionar." });
      else {
        setMemberMsg({ ok: "Membro adicionado." });
        setMName("");
        setMEmail("");
        setMPass("");
        setMRole("member");
        await load();
      }
    } catch {
      setMemberMsg({ err: "Erro de rede." });
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remover ${m.email} da conta?`)) return;
    const res = await fetch(`/api/account/members/${m.id}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      setMemberMsg({ err: data.error ?? "Erro ao remover." });
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/me/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loopsale-dados-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (
      !confirm(
        "Tem certeza? Todos os dados da conta serão excluídos permanentemente."
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch("/api/me/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (res.ok) window.location.href = "/login";
      else alert(data.error ?? "Erro ao excluir conta.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Configurações
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Perfil, conta, equipe e privacidade.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : (
        <>
          {me?.demo && (
            <Card>
              <CardContent className="py-3 text-sm text-[var(--loop-warning)]">
                Modo demo (DATABASE_DISABLED): edições estão desativadas.
              </CardContent>
            </Card>
          )}

          {/* Planos e assinatura */}
          <Link href="/dashboard/configuracoes/planos" className="block">
            <Card className="transition hover:border-[var(--loop-primary)]">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold text-[var(--loop-text)]">
                    Planos e assinatura
                  </p>
                  <p className="text-sm text-[var(--loop-text-muted)]">
                    Contrate um plano, gerencie o pagamento e veja faturas.
                  </p>
                </div>
                <span className="text-[var(--loop-primary)]">→</span>
              </CardContent>
            </Card>
          </Link>

          {/* Perfil */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">Perfil</h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Seus dados de acesso.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input label="Email" value={me?.email ?? ""} disabled />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="cta"
                  size="sm"
                  disabled={savingName || me?.demo}
                  onClick={saveName}
                >
                  {savingName ? "Salvando…" : "Salvar nome"}
                </Button>
                <Feedback ok={nameMsg.ok} err={nameMsg.err} />
              </div>
            </CardContent>
          </Card>

          {/* Senha */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">Senha</h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Troque sua senha de acesso.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                  value={curPass}
                  onChange={(e) => setCurPass(e.target.value)}
                />
                <Input
                  label="Nova senha"
                  type="password"
                  autoComplete="new-password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="cta"
                  size="sm"
                  disabled={savingPass || me?.demo}
                  onClick={savePassword}
                >
                  {savingPass ? "Alterando…" : "Alterar senha"}
                </Button>
                <Feedback ok={passMsg.ok} err={passMsg.err} />
              </div>
            </CardContent>
          </Card>

          {/* Conta */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Dados da conta
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Nome do negócio. {isAdmin ? "" : "Somente administradores editam."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nome da conta"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  disabled={!isAdmin || me?.demo}
                />
                <Input
                  label="Identificador (slug)"
                  value={me?.account?.slug ?? ""}
                  disabled
                />
              </div>
              {isAdmin && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="cta"
                    size="sm"
                    disabled={savingAcc || me?.demo}
                    onClick={saveAccount}
                  >
                    {savingAcc ? "Salvando…" : "Salvar conta"}
                  </Button>
                  <Feedback ok={accMsg.ok} err={accMsg.err} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Membros */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Membros da equipe
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Quem tem acesso a esta conta.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y divide-[var(--loop-border)]">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[var(--loop-text)]">
                        {m.name || m.email}
                        {m.isSelf && (
                          <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                            (você)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--loop-text-muted)]">
                        {m.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={m.role === "admin" ? "cta" : "default"}>
                        {roleLabel(m.role)}
                      </Badge>
                      {isAdmin && !m.isSelf && !me?.demo && (
                        <button
                          type="button"
                          onClick={() => removeMember(m)}
                          className="text-sm text-[var(--loop-error)] hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isAdmin && !me?.demo && (
                <div className="rounded-lg border border-[var(--loop-border)] p-4">
                  <p className="mb-3 text-sm font-medium text-[var(--loop-text)]">
                    Adicionar membro
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Nome"
                      value={mName}
                      onChange={(e) => setMName(e.target.value)}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={mEmail}
                      onChange={(e) => setMEmail(e.target.value)}
                    />
                    <Input
                      label="Senha inicial"
                      type="password"
                      autoComplete="new-password"
                      value={mPass}
                      onChange={(e) => setMPass(e.target.value)}
                    />
                    <div className="w-full">
                      <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                        Papel
                      </label>
                      <select
                        value={mRole}
                        onChange={(e) => setMRole(e.target.value)}
                        className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                      >
                        <option value="member">Membro</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      variant="cta"
                      size="sm"
                      disabled={addingMember}
                      onClick={addMember}
                    >
                      {addingMember ? "Adicionando…" : "Adicionar membro"}
                    </Button>
                    <Feedback ok={memberMsg.ok} err={memberMsg.err} />
                  </div>
                </div>
              )}
              {!isAdmin && (
                <Feedback err={memberMsg.err} />
              )}
            </CardContent>
          </Card>

          {/* LGPD */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Privacidade e dados (LGPD)
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Exporte ou exclua seus dados conforme a Lei Geral de Proteção de
                Dados.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button
                variant="secondary"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exportando…" : "Exportar meus dados"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleDeleteAccount}
                disabled={deleting || !isAdmin}
                className="text-[var(--loop-error)] hover:bg-red-50"
              >
                {deleting ? "Excluindo…" : "Excluir conta e dados"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
