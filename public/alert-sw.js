self.addEventListener("push", (event) => {
  const { tag } = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification("Alert Investara", {
    body: "Ada pembaruan alert. Buka Investara untuk melihat detailnya.",
    tag,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const alertsUrl = new URL("/alerts", self.location.origin).href;
    const current = pages.find((page) => page.url === alertsUrl);
    if (current) return current.focus();
    return self.clients.openWindow(alertsUrl);
  })());
});
