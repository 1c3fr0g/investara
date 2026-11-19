import { Suspense } from "react";
import { StockDetail } from "@/components/StockDetail";

export async function generateMetadata({ params }: PageProps<"/saham/[kode]">) {
  const { kode } = await params;
  const ticker = kode.toUpperCase();
  return {
    title: "Saham " + ticker + " | Investara",
    description: "Harga, laporan keuangan, riwayat dividen, dan berita saham " + ticker + " di Bursa Efek Indonesia.",
  };
}

async function Content({ params }: { params: PageProps<"/saham/[kode]">["params"] }) {
  const { kode } = await params;
  return <StockDetail kode={kode.toUpperCase()} />;
}

export default function Page(props: PageProps<"/saham/[kode]">) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-green-800/70">Memuat...</div>}>
      <Content params={props.params} />
    </Suspense>
  );
}
