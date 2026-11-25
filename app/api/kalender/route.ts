import { NextResponse, type NextRequest } from "next/server";
import { getUniverse } from "@/lib/market";
import type { KalenderItem } from "@/lib/types";
import { marketDay, MARKET_DAY_MS, nextMarketAnniversary } from "@/lib/marketDate";

export async function GET(request: NextRequest) {
  const days = Math.min(365, Math.max(7, Math.floor(Number(request.nextUrl.searchParams.get("hari"))) || 90));
  try {
    const { items, updatedAt } = await getUniverse();
    const today = marketDay(Date.now());
    const end = today + days * MARKET_DAY_MS;
    const out: KalenderItem[] = [];
    for (const i of items) {
      const upcoming = i.ex_akan !== null && marketDay(i.ex_akan) >= today;
      if (upcoming && i.ex_akan !== null && marketDay(i.ex_akan) <= end) {
        out.push({ kode: i.kode, nama: i.nama, harga: i.harga, yield_pct: i.yield_pct, jenis: "pasti", ex: i.ex_akan, bayar: i.bayar_akan });
      }
      const past = [
        { ex: i.ex_lalu, bayar: i.bayar_lalu },
        { ex: i.ex_akan, bayar: i.bayar_akan },
      ].filter((event): event is { ex: number; bayar: number | null } =>
        event.ex !== null && marketDay(event.ex) < today && marketDay(event.ex) >= today - 30 * MARKET_DAY_MS)
        .sort((a, b) => b.ex - a.ex)[0];
      if (past) {
        out.push({ kode: i.kode, nama: i.nama, harga: i.harga, yield_pct: i.yield_pct, jenis: "lalu", ...past });
      }
      // Perkiraan: pola tahun lalu diulang. Hanya untuk emiten yang masih membayar dividen.
      if (!upcoming && i.ex_lalu !== null && (i.yield_pct ?? 0) > 0) {
        const ex = nextMarketAnniversary(i.ex_lalu);
        if (ex >= today && ex <= end) {
          out.push({
            kode: i.kode,
            nama: i.nama,
            harga: i.harga,
            yield_pct: i.yield_pct,
            jenis: "perkiraan",
            ex,
            bayar: i.bayar_lalu !== null ? nextMarketAnniversary(i.bayar_lalu) : null,
          });
        }
      }
    }
    out.sort((a, b) => a.ex - b.ex);
    return NextResponse.json({ items: out, updatedAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal mengambil data" }, { status: 502 });
  }
}
