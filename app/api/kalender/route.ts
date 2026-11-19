import { NextResponse, type NextRequest } from "next/server";
import { getUniverse } from "@/lib/market";
import type { KalenderItem } from "@/lib/types";

const DAY = 864e5;

export async function GET(request: NextRequest) {
  const days = Math.min(365, Math.max(7, Math.floor(Number(request.nextUrl.searchParams.get("hari"))) || 90));
  try {
    const { items, updatedAt } = await getUniverse();
    const now = Date.now();
    const out: KalenderItem[] = [];
    for (const i of items) {
      if (i.ex_akan !== null && i.ex_akan >= now - DAY) {
        out.push({ kode: i.kode, nama: i.nama, harga: i.harga, yield_pct: i.yield_pct, jenis: "pasti", ex: i.ex_akan, bayar: i.bayar_akan });
      } else if (i.ex_lalu !== null && i.ex_lalu >= now - 30 * DAY) {
        out.push({ kode: i.kode, nama: i.nama, harga: i.harga, yield_pct: i.yield_pct, jenis: "lalu", ex: i.ex_lalu, bayar: i.bayar_lalu });
      }
      // Perkiraan: pola tahun lalu diulang. Hanya untuk emiten yang masih membayar dividen.
      if (i.ex_lalu !== null && (i.yield_pct ?? 0) > 0) {
        const ex = i.ex_lalu + 365 * DAY;
        if (ex >= now && ex <= now + days * DAY && !(i.ex_akan !== null && i.ex_akan >= now - DAY)) {
          out.push({
            kode: i.kode,
            nama: i.nama,
            harga: i.harga,
            yield_pct: i.yield_pct,
            jenis: "perkiraan",
            ex,
            bayar: i.bayar_lalu !== null ? i.bayar_lalu + 365 * DAY : null,
          });
        }
      }
    }
    out.sort((a, b) => a.ex - b.ex);
    return NextResponse.json({ items: out.filter((x) => x.ex <= now + days * DAY), updatedAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data" }, { status: 502 });
  }
}
