import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addTransaction, deleteTransaction, listHoldings, listTransactions, PortfolioPositionError } from "@/lib/db";

const unauthorized = () => NextResponse.json({ error: "Belum login" }, { status: 401 });

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  return NextResponse.json({ items: await listTransactions(s.user.id) });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();

  const body = await req.json().catch(() => null);
  const kode = typeof body?.kode === "string" ? body.kode.trim().toUpperCase() : "";
  const tipe = body?.tipe;
  const harga = Number(body?.harga);
  const lot = Number(body?.lot);
  const fee = body?.fee == null ? 0 : Number(body.fee);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const tanggal = typeof body?.tanggal === "string" ? body.tanggal : today;
  const catatan = typeof body?.catatan === "string" ? body.catatan.trim() : "";
  const syncHolding = body?.syncHolding === true;
  const requestId = body?.requestId;
  const date = new Date(tanggal + "T00:00:00Z");

  if (!/^[A-Z0-9]{4}$/.test(kode) || (tipe !== "BELI" && tipe !== "JUAL") ||
      !(harga > 0) || !(lot > 0) || harga > 1e9 || lot > 1e9 ||
      !Number.isFinite(fee) || fee < 0 || fee > 1e15 || catatan.length > 1000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== tanggal ||
      (syncHolding && tanggal > today) ||
      (requestId !== undefined && (typeof requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(requestId)))) {
    return NextResponse.json({ error: "Data transaksi tidak valid" }, { status: 400 });
  }

  try {
    const transaction = await addTransaction(s.user.id, { kode, tipe, harga, lot, fee, tanggal, catatan }, syncHolding, requestId);
    return NextResponse.json({ transaction, items: await listHoldings(s.user.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

export async function DELETE(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (!id || !await deleteTransaction(s.user.id, id)) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ok: true, items: await listHoldings(s.user.id) });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

