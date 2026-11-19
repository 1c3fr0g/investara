"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rp } from "@/lib/format";
import type { AlertEvent } from "@/lib/db";
import { Card } from "./ui";

const ALERT_INBOX_UPDATED = "investara-alert-inbox-updated";
type Inbox = { events: AlertEvent[]; unreadCount: number };
const eventDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function AlertInbox() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const readVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      if (document.hidden) return;
      const version = readVersion.current;
      fetch("/api/alerts/inbox", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Gagal memuat notifikasi.");
          const result: Inbox = await response.json();
          if (controller.signal.aborted || version !== readVersion.current) return;
          setInbox(result);
          setError("");
        })
        .catch(() => { if (!controller.signal.aborted) setError("Gagal memuat notifikasi."); });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  async function markRead() {
    setMarking(true);
    try {
      const response = await fetch("/api/alerts/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      });
      if (!response.ok) throw new Error("Gagal menandai notifikasi.");
      const result: Inbox = await response.json();
      readVersion.current += 1;
      setInbox(result);
      setError("");
      window.dispatchEvent(new Event(ALERT_INBOX_UPDATED));
    } catch {
      setError("Gagal menandai notifikasi.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Kotak masuk alert</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Saat server berjalan, hasil pemindaian tersimpan meskipun halaman ditutup.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="ios-glass-pill control-button rounded-xl text-xs font-semibold">Kelola filter di Screener</Link>
          {Boolean(inbox?.unreadCount) && (
            <button type="button" disabled={marking} onClick={() => void markRead()} className="ios-glass-pill control-button rounded-xl text-xs font-semibold disabled:opacity-50">Tandai semua dibaca</button>
          )}
        </div>
      </div>
      <BrowserPushControl />
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {!inbox && !error && <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">Memuat notifikasi…</p>}
      {inbox?.events.length === 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">Belum ada alert. Aktifkan pantauan dari filter tersimpan atau buat alert harga.</p>}
      {inbox && inbox.events.length > 0 && (
        <ul className="divide-y divide-zinc-200/80 dark:divide-white/10">
          {inbox.events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0 flex-1 basis-48 wrap-anywhere">
                <p className="text-sm font-semibold">
                  {!event.read_at && <span aria-label="Belum dibaca" className="mr-2 inline-block size-2 rounded-full bg-blue-500" />}
                  {event.kode} {event.kind === "filter" ? "masuk filter" : "mencapai target"} · {event.label}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{rp(event.harga)} · {eventDate.format(event.created_at)} WIB</p>
              </div>
              <Link href={event.query ? "/?" + event.query : "/saham/" + event.kode} className="ios-glass-pill control-button rounded-xl text-xs font-semibold">
                {event.query ? "Buka filter" : "Detail saham"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BrowserPushControl() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [device, setDevice] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const controller = new AbortController();
    fetch("/api/alerts/push", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const { publicKey: key } = await response.json();
        if (!controller.signal.aborted) setPublicKey(key);
      })
      .catch(() => {});
    navigator.serviceWorker.getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => { if (!controller.signal.aborted) setDevice(subscription ?? null); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function changeDevice(enable: boolean) {
    setBusy(true);
    setMessage("");
    let created: PushSubscription | undefined;
    try {
      if (enable && publicKey) {
        if (await Notification.requestPermission() !== "granted") throw new Error("Izin notifikasi belum diberikan.");
        await navigator.serviceWorker.register("/alert-sw.js");
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
          const key = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
          subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
          created = subscription;
        }
        const response = await fetch("/api/alerts/push", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription),
        });
        if (!response.ok) throw new Error("Gagal mengaktifkan notifikasi perangkat.");
        setDevice(subscription);
        setMessage("Notifikasi perangkat aktif.");
      } else if (!enable && device) {
        const response = await fetch("/api/alerts/push", {
          method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: device.endpoint }),
        });
        if (!response.ok) throw new Error("Gagal menonaktifkan notifikasi perangkat.");
        await device.unsubscribe();
        setDevice(null);
        setMessage("Notifikasi perangkat dinonaktifkan.");
      }
    } catch (error) {
      await created?.unsubscribe().catch(() => {});
      setMessage(error instanceof Error ? error.message : "Pengaturan notifikasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!publicKey && !device) {
    return <p className="text-xs text-zinc-600 dark:text-zinc-400">Notifikasi perangkat membutuhkan konfigurasi Web Push di server dan browser yang mendukungnya.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {publicKey && <button type="button" disabled={busy} onClick={() => void changeDevice(true)} className="ios-glass-pill control-button rounded-xl text-xs font-semibold disabled:opacity-50">Aktifkan notifikasi perangkat</button>}
      {device && <button type="button" disabled={busy} onClick={() => void changeDevice(false)} className="ios-glass-pill control-button rounded-xl text-xs font-semibold disabled:opacity-50">Nonaktifkan di perangkat ini</button>}
      {message && <p role="status" className="text-xs">{message}</p>}
    </div>
  );
}
