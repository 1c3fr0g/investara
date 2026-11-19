import { Suspense } from "react";
import { Compare } from "@/components/Compare";

export const metadata = { title: "Bandingkan Saham - Investara" };

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-green-800/70">Memuat...</div>}>
      <Compare />
    </Suspense>
  );
}
