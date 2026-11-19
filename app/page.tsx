import { Suspense } from "react";
import { StockList } from "@/components/StockList";
import { IhsgChart } from "@/components/IhsgChart";

export default function Home() {
  return (
    <main>
      <IhsgChart />
      <Suspense fallback={<div role="status" className="p-10 text-center text-zinc-600 dark:text-zinc-400">Memuat screener...</div>}>
        <StockList />
      </Suspense>
    </main>
  );
}
