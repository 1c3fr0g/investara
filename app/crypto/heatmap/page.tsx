import type { Metadata } from "next";
import { CryptoHeatmap } from "@/components/CryptoHeatmap";

export const metadata: Metadata = {
  title: "Peta Panas Kripto (Heatmap) | Investara",
  description:
    "Visualisasi peta panas pasar cryptocurrency live realtime berdasarkan kapitalisasi pasar dan pergerakan harga 24 jam / 7 hari.",
};

export default function Page() {
  return <CryptoHeatmap />;
}

