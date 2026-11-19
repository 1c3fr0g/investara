import type { Metadata } from "next";
import { Suspense } from "react";
import { CryptoCompare } from "@/components/CryptoCompare";

export const metadata: Metadata = {
  title: "Bandingkan Cryptocurrency | Investara",
  description:
    "Bandingkan hingga 4 koin cryptocurrency secara berdampingan: metrik valuasi, ATH drawdown, indikator kuantitatif, dan historis return.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-500" />
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            Memuat perbandingan kripto...
          </p>
        </div>
      }
    >
      <CryptoCompare />
    </Suspense>
  );
}

