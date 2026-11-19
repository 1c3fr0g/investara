import { Suspense } from "react";
import { MsciPage } from "@/components/MsciPage";

export const metadata = {
  title: "Klasifikasi & Indeks Saham MSCI Indonesia | Investara",
  description:
    "Daftar konstituen saham Indonesia MSCI Standard Index & MSCI Small Cap. Analisis bobot indeks, arus dana asing, dan jadwal rebalancing.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-zinc-500">
          Memuat data indeks MSCI Indonesia...
        </div>
      }
    >
      <MsciPage />
    </Suspense>
  );
}

