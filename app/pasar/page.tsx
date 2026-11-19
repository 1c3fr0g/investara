import { Suspense } from "react";
import { MarketOverview } from "@/components/MarketOverview";

export const metadata = { title: "Pasar & Top Movers - Investara" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 mr-3" />
          Memuat data pasar & makro...
        </div>
      }
    >
      <MarketOverview />
    </Suspense>
  );
}
