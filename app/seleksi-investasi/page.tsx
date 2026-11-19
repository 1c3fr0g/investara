import { InvestmentSelection } from "@/components/InvestmentSelection";

export const metadata = {
  title: "Seleksi Saham Investasi | Investara",
  description: "Susun daftar riset saham IDX berdasarkan profil dan perbandingan fundamental dalam sektor.",
};

export default function Page() {
  return <InvestmentSelection />;
}
