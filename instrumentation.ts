export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.VERCEL !== "1" &&
    process.env.ALERT_MONITOR_ENABLED !== "0") {
    const { startAlertMonitor } = await import("./lib/alertMonitor");
    startAlertMonitor();
  }
}
