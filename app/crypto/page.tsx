import { Suspense } from "react";
import { CryptoList } from "@/components/CryptoList";

export const metadata = {
  title: "Pasar Cryptocurrency & Top Market Cap | Investara",
  description: "Screener crypto real-time, pergerakan harga IDR & USD, analisis teknikal, dan sinyal beli koin kripto.",
};

export default function CryptoPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-zinc-500">Memuat pasar crypto...</div>}>
      <CryptoList />
    </Suspense>
  );
}

