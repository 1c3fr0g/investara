// Konstituen indeks bersifat statis dan direvisi BEI tiap semester (Feb & Agu).
// Perbarui daftar ini secara berkala dari situs resmi IDX dan pengumuman rebalancing MSCI.

export const IDX30 = [
  "ADRO", "AKRA", "AMMN", "AMRT", "ANTM", "ASII", "BBCA", "BBNI", "BBRI", "BMRI",
  "BRIS", "BRPT", "CPIN", "EXCL", "GOTO", "ICBP", "INCO", "INDF", "INKP", "ISAT",
  "KLBF", "MDKA", "MEDC", "PGAS", "PGEO", "PTBA", "SMGR", "TLKM", "UNTR", "UNVR",
];

export const LQ45 = [
  ...IDX30,
  "ACES", "ARTO", "BBTN", "BSDE", "CTRA", "ESSA", "HRUM", "INTP", "ITMG", "JPFA",
  "MAPI", "MIKA", "SIDO", "TOWR", "TPIA",
];

export const HIGHDIV20 = [
  "ADRO", "AKRA", "ASII", "BBCA", "BBNI", "BBRI", "BBTN", "BMRI", "BJBR", "BJTM",
  "GGRM", "HMSP", "ICBP", "INDF", "ITMG", "PTBA", "SMGR", "TLKM", "UNTR", "UNVR",
];

// MSCI Indonesia Standard Index (Global Standard / Large & Mid Cap)
// Digunakan sebagai acuan utama ETF global seperti iShares MSCI Indonesia (EIDO).
export const MSCI_STANDARD = [
  "BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "AMMN", "BRPT", "BREN", "CPIN",
  "ICBP", "INDF", "INKP", "KLBF", "MDKA", "PGAS", "UNTR", "UNVR", "ADRO", "GOTO",
  "CUAN", "TPIA", "ISAT", "BRIS", "AMRT",
];

// MSCI Indonesia Small Cap Index
// Mewakili saham emiten kapitalisasi menengah-kecil dengan likuiditas & free float memadai.
export const MSCI_SMALLCAP = [
  "ACES", "AKRA", "ANTM", "ARTO", "AUTO", "AVIA", "BDMN", "BNGA", "BSDE", "BTPS",
  "BUMI", "CLEO", "CMRY", "CTRA", "DMAS", "ELSA", "ENRG", "ERAA", "ESSA", "EXCL",
  "HEAL", "HRUM", "INCO", "INTP", "ITMG", "JPFA", "JSMR", "KIJA", "LINK", "MAPA",
  "MAPI", "MBMA", "MEDC", "MIKA", "MNCN", "MYOR", "NISP", "PANR", "PGEO", "PNBN",
  "PTBA", "PTPP", "PWON", "ROTI", "SCMA", "SIDO", "SILO", "SIMP", "SMGR", "SMRA",
  "SSIA", "TAPG", "TKIM", "TOWR", "ULTJ", "WIIM", "WIKA", "WOOD",
];

// Seluruh konstituen MSCI Indonesia Investable Market Index (IMI)
export const MSCI_ALL = Array.from(new Set([...MSCI_STANDARD, ...MSCI_SMALLCAP]));

export type Group = {
  id: string;
  label: string;
  desc: string;
  codes?: string[];
  papan?: string;
  badge?: string;
  isMsci?: boolean;
  isSwing?: boolean;
};

export const GROUPS: Group[] = [
  { id: "semua", label: "Semua saham", desc: "Seluruh saham tercatat" },
  { id: "swing", label: "⚡ Swing 1-3%", desc: "Daftar terpilih saham likuiditas tinggi di area pantulan support (Target 1-3%)", badge: "Target 1-3%", isSwing: true },
  { id: "msci-standard", label: "MSCI Standard", desc: "25 saham kapitalisasi besar acuan investor asing global", codes: MSCI_STANDARD, badge: "MSCI Large/Mid", isMsci: true },
  { id: "msci-smallcap", label: "MSCI Small Cap", desc: "58 saham berkembang dengan likuiditas tinggi indeks MSCI", codes: MSCI_SMALLCAP, badge: "MSCI Small Cap", isMsci: true },
  { id: "msci-all", label: "MSCI Indonesia (Semua)", desc: "Seluruh 83 saham konstituen MSCI Standard & Small Cap", codes: MSCI_ALL, badge: "MSCI IMI", isMsci: true },
  { id: "idx30", label: "IDX30", desc: "30 saham likuid & kapitalisasi besar", codes: IDX30 },
  { id: "lq45", label: "LQ45", desc: "45 saham paling likuid", codes: LQ45 },
  { id: "highdiv20", label: "IDX HIGH DIVIDEND 20", desc: "20 saham dividen tinggi", codes: HIGHDIV20 },
  { id: "utama", label: "Papan Utama", desc: "Emiten skala besar", papan: "Utama" },
  { id: "pengembangan", label: "Papan Pengembangan", desc: "Emiten skala menengah", papan: "Pengembangan" },
  { id: "akselerasi", label: "Papan Akselerasi", desc: "Emiten skala kecil", papan: "Akselerasi" },
  { id: "ekonomibaru", label: "Papan Ekonomi Baru", desc: "Emiten sektor ekonomi baru", papan: "Ekonomi Baru" },
  { id: "pemantauan", label: "Pemantauan Khusus", desc: "Saham dalam pemantauan khusus", papan: "Pemantauan Khusus" },
];

export const GROUP_IDS = GROUPS.map((g) => g.id);
