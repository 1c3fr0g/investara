"use client";

import { useEffect, useRef, useState } from "react";

const DOMAINS: Record<string, string> = {
  // Perbankan & Finansial
  BBCA: "bca.co.id",
  BBRI: "bri.co.id",
  BMRI: "bankmandiri.co.id",
  BBNI: "bni.co.id",
  BRIS: "bankbsi.co.id",
  BBTN: "btn.co.id",
  BDMN: "danamon.co.id",
  BNGA: "cimbniaga.co.id",
  ARTO: "jago.com",
  MEGA: "bankmega.com",
  BTPN: "btpn.com",
  BJBR: "bankbjb.co.id",
  BJTM: "bankjatim.co.id",

  // Telekomunikasi & Teknologi
  TLKM: "telkom.co.id",
  ISAT: "ioh.co.id",
  EXCL: "xlaxiata.co.id",
  TOWR: "sarana-menara.com",
  MTEL: "mitratel.co.id",
  TBIG: "tower-bersama.com",
  GOTO: "gotocompany.com",
  BUKA: "bukalapak.com",
  EMTK: "emtek.co.id",
  BELI: "blibli.com",

  // Konglomerasi & Otomotif
  ASII: "astra.co.id",
  AUTO: "component.astra.co.id",

  // Konsumer Primer & Non-Primer
  UNVR: "unilever.co.id",
  ICBP: "indofoodcbp.com",
  INDF: "indofood.com",
  MYOR: "mayora.com",
  CMRY: "cimory.com",
  CPIN: "charoenpokphand.co.id",
  JPFA: "japfacomfeed.co.id",
  AMRT: "alfamart.co.id",
  MIDI: "alfamidiku.com",
  ACES: "kawanlamagroup.com",
  ERAA: "erajaya.com",
  MAPI: "map.co.id",
  MAPA: "mapactive.id",
  GGRM: "gudanggaramtbk.com",
  HMSP: "sampoerna.com",
  SIDO: "sidomuncul.co.id",
  KLBF: "kalbe.co.id",

  // Energi, Tambang & Logam
  ADRO: "adaro.com",
  PTBA: "ptba.co.id",
  ITMG: "itmg.co.id",
  PGAS: "pgas.co.id",
  ANTM: "antam.com",
  MDKA: "merdekacoppergold.com",
  MEDC: "medcoenergi.com",
  INCO: "vale.com",
  HRUM: "harumnaturalresources.com",
  BUMI: "bumiresources.com",
  BRMS: "bumiresourcesminerals.com",
  AMMN: "amman.co.id",
  BREN: "baritorenewables.co.id",
  CUAN: "petrindo.co.id",
  PGEO: "pertaminageothermal.com",
  ESSA: "essa.id",
  AKRA: "akr.co.id",
  BYAN: "bayancorp.com",
  MBMA: "merdekabattery.com",
  NCKL: "haritanickel.com",

  // Semen, Kimia & Kertas
  SMGR: "sig.id",
  INTP: "indocement.co.id",
  BRPT: "barito.com",
  TPIA: "chandra-asri.com",
  INKP: "app.co.id",
  TKIM: "app.co.id",
  AVIA: "avianbrands.com",

  // Infrastruktur, Logistik & Properti
  JSMR: "jasamarga.com",
  BIRD: "bluebirdgroup.com",
  GIAA: "garuda-indonesia.com",
  SMDR: "samudera.id",
  BSDE: "sinarmasland.com",
  CTRA: "ciputra.com",
  PWON: "pakuwon.com",
  SMRA: "summarecon.com",
  ASRI: "alamsutera.com",
  PANI: "pantaiindahkapuk.com",

  // Kesehatan
  SILO: "siloamhospitals.com",
  HEAL: "herminahospitals.com",
  MIKA: "mitrakeluarga.com",
  PRDA: "prodia.co.id",

  // Alat Berat & Lainnya
  UNTR: "unitedtractors.com",
  DSSA: "dian-swastatika.com",
};

// Gradient warna monogram cadangan bila logo tidak ditemukan
const GRADIENTS = [
  "from-emerald-500 to-teal-700",
  "from-blue-600 to-indigo-800",
  "from-violet-500 to-purple-800",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-cyan-500 to-blue-700",
  "from-teal-500 to-emerald-800",
];

function getHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function StockLogo({
  kode,
  size = "md",
  className = "",
  website,
}: {
  kode: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  website?: string | null;
}) {
  const cleanCode = kode ? kode.trim().toUpperCase() : "";

  // 0: Stockbit IDX CDN (high-res transparent PNG)
  // 1: Google Favicon API (high-res 128px)
  // 2: Fallback monogram badge
  const [stage, setStage] = useState<number>(0);
  const prevCodeRef = useRef(cleanCode);

  if (prevCodeRef.current !== cleanCode) {
    prevCodeRef.current = cleanCode;
    setStage(0);
  }

  let domain = DOMAINS[cleanCode];
  if (!domain && website) {
    try {
      const url = new URL(website.startsWith("http") ? website : `https://${website}`);
      domain = url.hostname.replace(/^www\./, "");
    } catch {}
  }

  // Size configurations
  const sizeMap = {
    xs: "h-5 w-5 text-[9px] rounded-md p-0.5",
    sm: "h-7 w-7 text-xs rounded-lg p-0.5",
    md: "h-9 w-9 text-xs rounded-xl p-1",
    lg: "h-12 w-12 text-sm rounded-2xl p-1.5",
    xl: "h-16 w-16 text-lg rounded-2xl p-2",
  };

  const imgSizeMap = {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const dimCls = sizeMap[size] || sizeMap.md;
  const px = imgSizeMap[size] || 36;
  const grad = GRADIENTS[getHash(cleanCode) % GRADIENTS.length];

  // Stage 2 or failed: Tampilkan Monogram Berwarna Tajam
  if (!cleanCode || stage >= 2 || (stage === 1 && !domain)) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${grad} font-bold text-white shadow-xs select-none ${dimCls} ${className}`}
        title={cleanCode}
      >
        {cleanCode.slice(0, 2)}
      </div>
    );
  }

  // Stage 0: CDN Stockbit khusus emiten BEI (jauh lebih tajam dan resmi)
  // Stage 1: Google Favicon dengan ukuran 128px
  const currentSrc =
    stage === 0
      ? `https://assets.stockbit.com/logos/companies/${cleanCode}.png`
      : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain!)}&sz=128`;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200/90 bg-white shadow-xs transition dark:border-zinc-700/80 dark:bg-zinc-100 ${dimCls} ${className}`}
      title={cleanCode}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt={`Logo ${cleanCode}`}
        width={px}
        height={px}
        onError={() => setStage((prev) => prev + 1)}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}
