import { NextResponse, type NextRequest } from "next/server";
import { isKnownCode } from "@/lib/market";
import { getStockActivity } from "@/lib/stockActivityProvider";

export async function GET(req: NextRequest, ctx: { params: Promise<{ kode: string }> }) {
  const { kode: raw } = await ctx.params;
  const kode = raw.trim().toUpperCase();
  if (!isKnownCode(kode)) return NextResponse.json({ error: "Kode saham tidak dikenal" }, { status: 404 });
  const query = req.nextUrl.searchParams;
  const view = query.get("view");
  const days = Number(query.get("days") ?? "30");
  const page = Number(query.get("page") ?? "1");
  if ((view !== "broker" && view !== "insider") || ![7, 30, 90].includes(days) ||
      !Number.isInteger(page) || page < 1 || page > 100 || (view === "broker" && page !== 1)) {
    return NextResponse.json({ error: "Parameter aktivitas saham tidak valid" }, { status: 400 });
  }
  return NextResponse.json(await getStockActivity(kode, view, days, page), {
    headers: { "Cache-Control": "no-store" },
  });
}
