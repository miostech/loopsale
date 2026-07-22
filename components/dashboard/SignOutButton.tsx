"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";

/** Logout robusto: encerra a sessão e navega para /login no host atual
 *  (sem depender do NEXTAUTH_URL para o redirect). */
export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-center"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign("/login");
      }}
    >
      Sair
    </Button>
  );
}
