import { NextResponse, type NextRequest } from "next/server";
import { getDynamicNewsCatalysts } from "@/lib/sentimentScanner";

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get("refresh") === "1";
    const scan = await getDynamicNewsCatalysts(force);
    return NextResponse.json(scan, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Gagal memindai sentimen berita pasar." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
