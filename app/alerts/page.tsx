import { Suspense } from "react";
import { AlertManager } from "@/components/AlertManager";

export const metadata = {
  title: "Alert Harga & Screener | Investara",
  description: "Notifikasi harga saham dan kriteria screener IHSG",
};

async function AlertsContent({ searchParams }: PageProps<"/alerts">) {
  const { kode } = await searchParams;
  const candidate = typeof kode === "string" ? kode.toUpperCase() : "";
  return <AlertManager initialCode={/^[A-Z0-9]{4}$/.test(candidate) ? candidate : ""} />;
}

export default function AlertsPage(props: PageProps<"/alerts">) {
  return (
    <Suspense fallback={<main className="screen-shell screen-section"><p role="status">Memuat notifikasi alert...</p></main>}>
      <AlertsContent {...props} />
    </Suspense>
  );
}

