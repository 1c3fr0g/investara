import { Suspense } from "react";
import { CryptoDetail } from "@/components/CryptoDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const sym = symbol?.toUpperCase() || "Crypto";
  return {
    title: `${sym} Analisis & Rekomendasi | Investara`,
    description: `Statistik harga ${sym}, grafik interaktif, indikator teknikal, sinyal beli, dan kalkulator return historis.`,
  };
}

async function Content({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <CryptoDetail symbol={symbol} />;
}

export default function CryptoDetailPage(props: {
  params: Promise<{ symbol: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-zinc-500">
          Memuat analisis koin...
        </div>
      }
    >
      <Content params={props.params} />
    </Suspense>
  );
}

