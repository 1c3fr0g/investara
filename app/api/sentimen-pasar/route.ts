import { NextResponse, type NextRequest } from "next/server";
import { getDynamicNewsCatalysts } from "@/lib/sentimentScanner";

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get("refresh") === "1";
    const catalysts = await getDynamicNewsCatalysts(force);
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      catalysts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memindai sentimen berita pasar" },
      { status: 500 }
    );
  }
}
