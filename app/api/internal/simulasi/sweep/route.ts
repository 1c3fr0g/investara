import { timingSafeEqual } from "node:crypto";
import { runOfflinePaperSweep } from "@/lib/paperOfflineMonitor";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (!secret) return Response.json({ error: "Pantauan terjadwal belum aktif." }, { status: 503, headers });

  const expected = Buffer.from(`Bearer ${secret}`);
  const presented = Buffer.from(request.headers.get("authorization") ?? "");
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return Response.json({ error: "Tidak diizinkan." }, { status: 401, headers });
  }

  try {
    const result = await runOfflinePaperSweep();
    const status = result.failed > 0 && result.failed === result.checked ? 502 : 200;
    return Response.json(result, { status, headers });
  } catch {
    console.warn("Pemindaian posisi simulasi terjadwal gagal.");
    return Response.json({ error: "Pemindaian posisi simulasi gagal." }, { status: 502, headers });
  }
}
