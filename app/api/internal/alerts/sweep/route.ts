import { timingSafeEqual } from "node:crypto";
import { runAlertCycle } from "@/lib/alertMonitor";

export const maxDuration = 25;

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (!secret || process.env.ALERT_MONITOR_ENABLED === "0") {
    return Response.json({ error: "Pemindaian terjadwal belum aktif." }, { status: 503, headers });
  }

  const expected = Buffer.from("Bearer " + secret);
  const presented = Buffer.from(authorization ?? "");
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401, headers });
  }

  try {
    await runAlertCycle();
    return Response.json({ ok: true }, { headers });
  } catch {
    console.warn("Pemindaian atau pengiriman alert terjadwal gagal.");
    return Response.json({ error: "Pemindaian alert gagal." }, { status: 502, headers });
  }
}
