import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPushEndpoint, pushSettings } from "@/lib/alertPush";
import { removePushDevice, savePushDevice } from "@/lib/db";

const unauthorized = () => NextResponse.json({ error: "Belum login" }, { status: 401 });

export async function GET() {
  if (!(await auth())?.user?.id) return unauthorized();
  return NextResponse.json({ publicKey: (await pushSettings())?.publicKey ?? null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  if (!await pushSettings()) return NextResponse.json({ error: "Push browser belum dikonfigurasi." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const { p256dh, auth: key } = body?.keys ?? {};
  if (typeof endpoint !== "string" || !isPushEndpoint(endpoint) ||
    typeof p256dh !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(p256dh) ||
    typeof key !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(key)) {
    return NextResponse.json({ error: "Langganan browser tidak valid." }, { status: 400 });
  }
  await savePushDevice(userId, { endpoint, keys: { p256dh, auth: key } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  if (typeof body?.endpoint !== "string" || !isPushEndpoint(body.endpoint)) {
    return NextResponse.json({ error: "Langganan browser tidak valid." }, { status: 400 });
  }
  await removePushDevice(body.endpoint, userId);
  return NextResponse.json({ ok: true });
}
