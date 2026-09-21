"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Registra o service worker (PWA instalável) e cuida das notificações push:
 * inscreve se já tem permissão, ou mostra um botão discreto para ativar.
 */
export function LoopChatPWA() {
  const [precisaAtivar, setPrecisaAtivar] = useState(false);

  const inscrever = useCallback(async (reg: ServiceWorkerRegistration) => {
    if (!("PushManager" in window) || !VAPID) return;
    try {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
        });
      }
      await fetch("/api/loopchat/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
    } catch {
      /* inscrição falhou — segue sem push */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelado = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
          await inscrever(reg);
        } else if (Notification.permission === "default" && !cancelado) {
          setPrecisaAtivar(true);
        }
      } catch {
        /* service worker indisponível */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [inscrever]);

  async function ativar() {
    setPrecisaAtivar(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      await inscrever(reg);
    } catch {
      /* ignore */
    }
  }

  if (!precisaAtivar) return null;
  return (
    <button
      type="button"
      onClick={ativar}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-[var(--loop-primary)] px-4 py-2 text-sm font-medium text-white shadow-lg hover:opacity-90"
    >
      🔔 Ativar notificações de novas mensagens
    </button>
  );
}
