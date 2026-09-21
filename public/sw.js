/* Service worker do LoopChat (PWA + push). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

// Handler de fetch mínimo (passthrough) — ajuda no critério de instalabilidade.
self.addEventListener("fetch", () => {});

// Notificação push: mostra o aviso com o preview da mensagem.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "LoopChat";
  const options = {
    body: data.body || "Nova mensagem",
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
    tag: data.tag || "loopchat",
    renotify: true,
    data: { url: data.url || "/loopchat" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clique na notificação: foca uma janela do LoopChat aberta ou abre uma nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/loopchat";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes("/loopchat") && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
