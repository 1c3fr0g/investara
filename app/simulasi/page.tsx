import { Suspense } from "react";
import { SimulasiPage } from "@/components/SimulasiPage";

export const metadata = {
  title: "Laboratorium Simulasi Paper Trading Radar Swing (1-3%) | Investara",
  description:
    "Simulasikan strategi swing trading 1-3% per hari pada saham IHSG dan MSCI secara real-time tanpa risiko. Otomatisasi evaluasi target profit (TP) dan stop loss (SL).",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-zinc-500">
          Memuat simulator paper trading...
        </div>
      }
    >
      <SimulasiPage />
    </Suspense>
  );
}

