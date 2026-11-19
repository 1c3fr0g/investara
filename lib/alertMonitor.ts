import { deliverAlertPush } from "./alertPush";
import { applyAlertSnapshot, hasMonitoredAlerts } from "./db";
import { getUniverse } from "./market";

export async function runAlertCycle() {
  try {
    if (!await hasMonitoredAlerts()) return;
    const snapshot = await getUniverse();
    await applyAlertSnapshot(snapshot.items, snapshot.updatedAt);
  } finally {
    await deliverAlertPush();
  }
}

const monitor = globalThis as typeof globalThis & { investaraAlertTimer?: ReturnType<typeof setTimeout> };

export function startAlertMonitor() {
  if (monitor.investaraAlertTimer || process.env.ALERT_MONITOR_ENABLED === "0") return;
  const schedule = (wait: number) => {
    monitor.investaraAlertTimer = setTimeout(async () => {
      try {
        await runAlertCycle();
      } catch {
        console.warn("Pemindaian atau pengiriman alert Investara gagal.");
      } finally {
        schedule(60_000);
      }
    }, wait);
    monitor.investaraAlertTimer.unref();
  };
  schedule(3_000);
}
