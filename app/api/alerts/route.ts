import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  addPriceAlert,
  applyAlertSnapshot,
  deletePriceAlert,
  listPriceAlerts,
  togglePriceAlert,
} from "@/lib/db";
import { getUniverse } from "@/lib/market";

const unauthorized = () => NextResponse.json({ error: "Belum login" }, { status: 401 });

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();

  const alerts = await listPriceAlerts(s.user.id);
  const snapshot = alerts.length ? await getUniverse().catch(() => null) : null;
  if (snapshot) applyAlertSnapshot(snapshot.items, snapshot.updatedAt);
  const universe = snapshot?.items ?? [];
  const priceMap = new Map(universe.map((u) => [u.kode, u]));

  const enriched = (snapshot ? await listPriceAlerts(s.user.id) : alerts).map((a) => {
    const stock = priceMap.get(a.kode);
    const harga = stock?.harga ?? null;
    const selisihPct = harga && a.target_harga ? ((a.target_harga - harga) / harga) * 100 : null;

    return {
      ...a,
      nama: stock?.nama ?? a.kode,
      harga_sekarang: harga,
      perubahan_pct: stock?.perubahan_pct ?? null,
      selisih_pct: selisihPct,
    };
  });

  return NextResponse.json({
    items: enriched,
    triggeredCount: enriched.filter((a) => a.aktif === 1 && a.triggered === 1).length,
  });
}

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();

  const body = await req.json().catch(() => null);
  const kode = typeof body?.kode === "string" ? body.kode.trim().toUpperCase() : "";
  const kondisi = body?.kondisi === "DIBAWAH" ? "DIBAWAH" : "DIATAS";
  const target_harga = Number(body?.target_harga);
  const catatan = typeof body?.catatan === "string" ? body.catatan.trim() : "";

  if (!/^[A-Z0-9]{4}$/.test(kode) || !(target_harga > 0) || target_harga > 1e9) {
    return NextResponse.json({ error: "Data alert tidak valid" }, { status: 400 });
  }

  const alert = await addPriceAlert(s.user.id, {
    kode,
    kondisi,
    target_harga,
    catatan,
  });

  return NextResponse.json({ alert }, { status: 201 });
}

export async function PATCH(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const aktif = Boolean(body?.aktif);

  if (!id) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  const ok = await togglePriceAlert(s.user.id, id, aktif);
  if (!ok) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !await deletePriceAlert(s.user.id, id)) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

