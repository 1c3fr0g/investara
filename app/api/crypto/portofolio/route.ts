import { auth } from "@/auth";
import { addTransaction, deleteTransaction, listHoldings, listTransactions, PortfolioPositionError, updateHolding } from "@/lib/db";
import { cryptoQuantityUnits, validPortfolioSymbol } from "@/lib/portfolio";

const headers = { "Cache-Control": "private, no-store" };
const errorResponse = (error: string, status: number) => Response.json({ error }, { status, headers });
const validPrice = (value: unknown) => typeof value === "number" && value > 0 && value <= 1e12;
const validQuantity = (value: unknown) => typeof value === "number" && cryptoQuantityUnits(value) !== null;

async function portfolio(userId: string) {
  const [items, transactions] = await Promise.all([listHoldings(userId, undefined, "crypto"), listTransactions(userId, "crypto")]);
  return { items, transactions };
}

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return errorResponse("Belum login.", 401);
  return Response.json(await portfolio(userId), { headers });
}

export async function POST(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return errorResponse("Belum login.", 401);
  const body = await request.json().catch(() => null);
  const kode = typeof body?.kode === "string" ? body.kode.trim().toUpperCase() : "";
  const { tipe, harga, lot, requestId } = body ?? {};
  const fee = body?.fee ?? 0;
  const catatan = typeof body?.catatan === "string" ? body.catatan.trim() : "";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const tanggal = typeof body?.tanggal === "string" ? body.tanggal : today;
  const date = new Date(tanggal + "T00:00:00Z");

  if (!validPortfolioSymbol(kode, "crypto") || (tipe !== "BELI" && tipe !== "JUAL") || !validPrice(harga) || !validQuantity(lot) ||
      typeof fee !== "number" || !Number.isFinite(fee) || fee < 0 || fee > 1e15 || catatan.length > 1000 ||
      (tipe === "JUAL" && fee > harga * lot) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== tanggal || tanggal > today ||
      (requestId !== undefined && (typeof requestId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId)))) {
    return errorResponse("Periksa kode koin, harga, jumlah, biaya, dan tanggal transaksi.", 400);
  }

  try {
    const transaction = await addTransaction(userId, { kode, tipe, harga, lot, fee, tanggal, catatan }, true, requestId, "crypto");
    return Response.json({ transaction, items: await listHoldings(userId, undefined, "crypto") }, { status: 201, headers });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return errorResponse(error.message, 409);
    throw error;
  }
}

export async function PUT(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return errorResponse("Belum login.", 401);
  const { id, harga_beli, lot, expected } = (await request.json().catch(() => null)) ?? {};
  if (typeof id !== "string" || !id || !validPrice(harga_beli) || !validQuantity(lot) ||
      (expected !== undefined && !(validPrice(expected?.harga_beli) && validQuantity(expected?.lot)))) {
    return errorResponse("Harga atau jumlah koin tidak valid.", 400);
  }
  try {
    if (!await updateHolding(userId, id, { harga_beli, lot, expected }, "crypto")) return errorResponse("Posisi tidak ditemukan.", 404);
    return Response.json(await portfolio(userId), { headers });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return errorResponse(error.message, 409);
    throw error;
  }
}

export async function DELETE(request: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return errorResponse("Belum login.", 401);
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (!id || !await deleteTransaction(userId, id, "crypto")) return errorResponse("Transaksi tidak ditemukan.", 404);
    return Response.json({ ok: true, items: await listHoldings(userId, undefined, "crypto") }, { headers });
  } catch (error) {
    if (error instanceof PortfolioPositionError) return errorResponse(error.message, 409);
    throw error;
  }
}
