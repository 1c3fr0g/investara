import YahooFinance from "yahoo-finance2";
import type {
  CryptoCategory,
  CryptoDetailData,
  CryptoHistoricalPoint,
  CryptoItem,
  CryptoFearGreed,
  CryptoRecommendation,
} from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const OPTS = { validateResult: false } as const;

export const USD_TO_IDR = 15850;

// Curated Top 35 Cryptocurrencies
interface RawCryptoDef {
  symbol: string;
  name: string;
  category: CryptoCategory;
  consensus: string;
  description: string;
  website_url?: string;
  whitepaper_url?: string;
  explorer_url?: string;
  github_url?: string;
  milestones?: { year: string; title: string; description: string }[];
  pros: string[];
  risks: string[];
}

const RAW_CRYPTOS: RawCryptoDef[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    category: "Layer 1",
    consensus: "Proof of Work (SHA-256)",
    description: "Mata uang digital terdesentralisasi pertama di dunia diciptakan oleh Satoshi Nakamoto pada 2009. Berfungsi sebagai emas digital (Store of Value) dengan batas suplai maksimal 21 juta koin yang tidak dapat diubah.",
    website_url: "https://bitcoin.org",
    whitepaper_url: "https://bitcoin.org/bitcoin.pdf",
    explorer_url: "https://mempool.space",
    github_url: "https://github.com/bitcoin/bitcoin",
    milestones: [
      { year: "2008", title: "Whitepaper Diterbitkan", description: "Satoshi Nakamoto mempublikasikan naskah 'Bitcoin: A Peer-to-Peer Electronic Cash System'." },
      { year: "2009", title: "Genesis Block Ditambang", description: "Blok pertama (Block 0) ditambang dengan pesan abadi koran The Times mengenai bailout bank." },
      { year: "2010", title: "Bitcoin Pizza Day", description: "Transaksi komersial riil perdana di dunia: 10.000 BTC ditukar dengan dua loyang pizza Papa John's." },
      { year: "2021", title: "Legal Tender El Salvador", description: "El Salvador menjadi negara pertama di dunia yang meresmikan Bitcoin sebagai alat pembayaran sah." },
      { year: "2024", title: "ETF Spot Wall Street & Halving ke-4", description: "SEC menyetujui Spot Bitcoin ETF dan terjadinya halving ke-4 (imbalan blok turun menjadi 3.125 BTC)." }
    ],
    pros: ["Aset kripto paling likuid dan aman di dunia", "Diadopsi institusi global & ETF Spot Wall Street", "Suplai terbatas mutlak 21 juta (deflasioner)"],
    risks: ["Konsumsi energi komputasi PoW", "Kecepatan transaksi jaringan utama (L1) relatif lambat (~7 TPS)"],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    category: "Layer 1",
    consensus: "Proof of Stake (PoS)",
    description: "Platform smart contract terbesar di dunia yang menjadi pondasi ekosistem keuangan terdesentralisasi (DeFi), NFT, dan Web3.",
    website_url: "https://ethereum.org",
    whitepaper_url: "https://ethereum.org/en/whitepaper/",
    explorer_url: "https://etherscan.io",
    github_url: "https://github.com/ethereum/go-ethereum",
    milestones: [
      { year: "2013", title: "Konsep Ethereum Diperkenalkan", description: "Vitalik Buterin merilis whitepaper yang mengusung blockchain dengan bahasa pemrograman Turing-complete." },
      { year: "2015", title: "Peluncuran Frontier (Mainnet)", description: "Jaringan Ethereum pertama kali aktif dan mulai mengeksekusi kontrak pintar (smart contract)." },
      { year: "2020", title: "Peluncuran Beacon Chain", description: "Memulai tahap pertama transisi konsensus ramah lingkungan Proof of Stake (PoS)." },
      { year: "2022", title: "The Merge Sukses", description: "Penggabungan resmi ke Proof of Stake berhasil memangkas konsumsi listrik jaringan sebesar 99.95%." },
      { year: "2024", title: "Upgrade Dencun & ETF Spot", description: "Implementasi EIP-4844 'blobs' menurunkan biaya transaksi Layer 2 hingga 90%+." }
    ],
    pros: ["Ekosistem pengembang dan aplikasi (dApps) terbesar", "Mekanisme EIP-1559 membakar ETH setiap transaksi", "Didukung ETF Spot global"],
    risks: ["Persaingan ketat dari Layer 1 alternatif berbiaya murah (Solana, Sui)", "Gas fee L1 bisa melonjak saat trafik ramai"],
  },
  {
    symbol: "SOL",
    name: "Solana",
    category: "Layer 1",
    consensus: "Proof of History + Proof of Stake",
    description: "Blockchain Layer 1 berkecepatan tinggi (mencapai 65.000 TPS) dengan biaya gas fee sub-sen, menjadi pusat ekosistem DeFi, DEX, dan koin ritel terpopuler.",
    website_url: "https://solana.com",
    whitepaper_url: "https://solana.com/solana-whitepaper.pdf",
    explorer_url: "https://solscan.io",
    github_url: "https://github.com/solana-labs/solana",
    milestones: [
      { year: "2017", title: "Desain Proof of History", description: "Anatoly Yakovenko menerbitkan whitepaper Proof of History untuk sinkronisasi waktu terdesentralisasi." },
      { year: "2020", title: "Peluncuran Mainnet Beta", description: "Jaringan Solana meluncurkan genesis block publik pertamanya." },
      { year: "2021", title: "Summer of Solana", description: "Adopsi masif proyek DeFi dan NFT membawa ekosistem Solana ke jajaran top 5 kripto global." },
      { year: "2024", title: "Rekor Transaksi DEX & Firedancer", description: "Volume perdagangan DEX Solana melampaui Ethereum dan uji coba client validator Firedancer." }
    ],
    pros: ["Kecepatan transaksi super cepat dengan biaya fraksional rupiah", "Volume transaksi DEX sering melampaui Ethereum", "Adopsi retail dan pengembang Web3 sangat masif"],
    risks: ["Persyaratan hardware validator sangat tinggi", "Riwayat downtime jaringan di masa lalu"],
  },
  {
    symbol: "BNB",
    name: "BNB",
    category: "Layer 1",
    consensus: "Proof of Staked Authority (PoSA)",
    description: "Token ekosistem Binance dan gas fee native jaringan BNB Smart Chain (BSC). Memiliki program kuartalan Auto-Burn permanen hingga tersisa 100 juta koin.",
    pros: ["Didukung oleh ekosistem bursa crypto terbesar di dunia (Binance)", "Mekanisme pembakaran (burn) rutin kuartalan", "Utilitas tinggi di Launchpool & diskon fee"],
    risks: ["Isu regulasi bursa sentralisasi global", "Validator BSC tergolong sedikit (cenderung tersentral)"],
  },
  {
    symbol: "XRP",
    name: "XRP",
    category: "Payments",
    consensus: "Ripple Protocol Consensus Algorithm (RPCA)",
    description: "Aset digital yang dirancang untuk transfer pembayaran antar bank global lintas negara (cross-border payments) secara instan dalam 3–5 detik dengan biaya nyaris nol.",
    pros: ["Kecepatan transfer lintas negara 3-5 detik", "Kemitraan kuat dengan institusi perbankan internasional", "Kepastian hukum pasca kemenangan parsial vs SEC"],
    risks: ["Pelepasan rutin suplai dari escrow Ripple", "Belum melampaui rekor ATH 2018 ($3.84)"],
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    category: "Meme",
    consensus: "Proof of Work (AuxPoW Scrypt)",
    description: "Koin meme pertama dan paling ikonik di dunia berlogo anjing Shiba Inu. Digunakan luas untuk tipping komunitas dan didukung oleh figur publik ternama seperti Elon Musk.",
    pros: ["Likuiditas sangat tinggi di seluruh exchange tier-1", "Komunitas kultus paling vokal dan loyal di kripto", "Dukungan sentimen Department of Government Efficiency (D.O.G.E)"],
    risks: ["Emisi inflasi koin tak terbatas (5 miliar koin/tahun)", "Volatilitas ekstrem digerakkan hype media sosial"],
  },
  {
    symbol: "ADA",
    name: "Cardano",
    category: "Layer 1",
    consensus: "Proof of Stake (Ouroboros)",
    description: "Blockchain berbasis penelitian ilmiah akademis dan peer-reviewed yang dipimpin oleh Charles Hoskinson. Menitikberatkan pada keamanan, skalabilitas formal, dan tata kelola terdesentralisasi (Voltaire).",
    pros: ["Protokol konsensus ramah lingkungan dan aman", "Tingkat staking desentralisasi tinggi oleh komunitas", "Upgrade tata kelola Chang hard fork"],
    risks: ["Pengembangan ekosistem dApps relatif lambat dibanding kompetitor", "Aktivitas DeFi on-chain masih tertinggal dari Solana"],
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    category: "Layer 1",
    consensus: "Avalanche Consensus",
    description: "Platform smart contract modular berkinerja tinggi yang memungkinkan peluncuran subnet khusus untuk institusi keuangan global (seperti Citi dan JP Morgan).",
    pros: ["Finalitas transaksi instan di bawah 1 detik", "Arsitektur subnet ramah kepatuhan institusi finansial", "Kemitraan korporasi tradisional kuat"],
    risks: ["Tingkat unlock token masih berlangsung", "Persaingan ketat dengan Layer 2 Ethereum"],
  },
  {
    symbol: "SUI",
    name: "Sui",
    category: "Layer 1",
    consensus: "Mysticeti / Narwhal-Bullshark PoS",
    description: "Blockchain Layer 1 berbasis bahasa pemrograman Move yang dikembangkan oleh mantan tim peneliti Meta/Facebook. Menawarkan eksekusi transaksi paralel dan latensi ultra-rendah.",
    pros: ["Bahasa Move memberikan keamanan smart contract lebih tangguh", "Pertumbuhan TVL DeFi tercepat sepanjang 2024", "Finalitas transaksi hanya 390 milidetik"],
    risks: ["Jadwal token unlock besar berkala", "Ekosistem masih dalam tahap adopsi awal"],
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    category: "Infrastructure",
    consensus: "Decentralized Oracle Network (DON)",
    description: "Jaringan oracle terdesentralisasi nomor satu yang menghubungkan data dunia nyata (harga saham, cuaca, valuta) ke smart contract blockchain. Pelopor standar CCIP dan tokenisasi RWA.",
    pros: ["Monopoli de-facto penyedia feed harga DeFi (mengamankan puluhan miliar dolar)", "Protokol interoperabilitas lintas rantai (CCIP) diadopsi SWIFT & Euroclear", "Fundamental kokoh untuk narasi RWA"],
    risks: ["Nilai akrual token LINK historis tidak selalu linier dengan utilisasi oracle", "Pergerakan harga cenderung defensif"],
  },
  {
    symbol: "NEAR",
    name: "NEAR Protocol",
    category: "AI & Big Data",
    consensus: "Nightshade Sharding PoS",
    description: "Blockchain Layer 1 berskala horizontal melalui sharding dinamis yang kini memposisikan diri sebagai infrastruktur utama User-Owned AI (kecerdasan buatan berbasis kripto).",
    pros: ["Pelopor narasi Blockchain + AI yang kredibel", "Sharding otomatis yang membuat kapasitas jaringan tak terbatas", "Abstraksi akun (Account Abstraction) memudahkan pengguna awam"],
    risks: ["Kompetisi ketat di sektor Layer 1 dan AI", "Inflasi token tahunan ~5%"],
  },
  {
    symbol: "TAO",
    name: "Bittensor",
    category: "AI & Big Data",
    consensus: "Proof of Intelligence",
    description: "Protokol open-source yang memonetisasi kecerdasan buatan terdesentralisasi melalui subnet-subnet AI khusus. Menggunakan model tokenomik persis seperti Bitcoin (maksimal 21 juta TAO dengan halving).",
    pros: ["Tokenomik mirip Bitcoin (halving 4 tahun sekali, suplai cap 21M)", "Inovasi subnet AI terdesentralisasi pertama yang berhasil menarik minat saintis AI", "Dukungan venture capital AI kelas atas"],
    risks: ["Valuasi tinggi dengan likuiditas yang lebih volatil", "Tingkat pemahaman teknologi yang kompleks"],
  },
  {
    symbol: "RENDER",
    name: "Render",
    category: "AI & Big Data",
    consensus: "Solana SPL Token",
    description: "Jaringan komputasi GPU terdesentralisasi (DePIN) yang menyediakan daya render grafis 3D, efek visual film, dan komputasi pelatihan model AI kepada pengguna global.",
    pros: ["Permintaan GPU riil yang meledak seiring tren AI generatif", "Migrasi sukses ke Solana menghemat biaya transaksi", "Kemitraan dengan studio efek Hollywood dan Apple ecosystem"],
    risks: ["Fluktuasi harga GPU global", "Ketergantungan pada siklus antusiasme AI"],
  },
  {
    symbol: "DOT",
    name: "Polkadot",
    category: "Interoperability",
    consensus: "Nominated Proof of Stake (NPoS)",
    description: "Protokol multi-rantai pecahan (sharded multichain) yang menghubungkan berbagai blockchain independen (parachains) dalam satu jaringan aman terpadu yang didirikan oleh co-founder Ethereum Gavin Wood.",
    pros: ["Interoperabilitas antar-blockchain tanpa jembatan rentan hack", "Model tata kelola OpenGov paling desentralis", "Rencana upgrade Agile Coretime (Polkadot 2.0)"],
    risks: ["Sistem lelang parachain sebelumnya dianggap terlalu rumit", "Tingkat inflasi token ~10% per tahun"],
  },
  {
    symbol: "SHIB",
    name: "Shiba Inu",
    category: "Meme",
    consensus: "Ethereum ERC-20 + Shibarium L2",
    description: "Meme coin bervolume raksasa yang berkembang menjadi ekosistem Web3 utuh dengan meluncurkan blockchain Layer 2 sendiri (Shibarium) dan DEX ShibaSwap.",
    pros: ["Ekosistem terus berevolusi (Shibarium L2, metaverse)", "Pembakaran token otomatis berbasis utilisasi transaksi", "Daftar di hampir semua exchange dunia"],
    risks: ["Jumlah pasokan token ratusan triliun", "Sangat bergantung pada sentimen pasar meme"],
  },
  {
    symbol: "PEPE",
    name: "Pepe",
    category: "Meme",
    consensus: "Ethereum ERC-20",
    description: "Meme coin berbasis karakter kodok internet kultus Pepe the Frog. 100% pasokan beredar di pasar tanpa pajak transaksi dan kontrak likuiditas dibakar permanen.",
    pros: ["Suplai 100% beredar (tidak ada risiko token unlock tim)", "Likuiditas tertinggi di segmen meme coin generasi baru", "Listing di exchange Tier-1 Coinbase & Robinhood"],
    risks: ["Nol fundamental murni digerakkan spekulasi budaya internet", "Volatilitas harga sangat tajam"],
  },
  {
    symbol: "APT",
    name: "Aptos",
    category: "Layer 1",
    consensus: "AptosBFT (PoS) + Move Engine",
    description: "Blockchain Layer 1 yang dirancang untuk performa tinggi dan skalabilitas perusahaan menggunakan mesin eksekusi paralel Block-STM dan bahasa Move.",
    pros: ["Performa transaksi paralel Block-STM hingga 160k TPS teoretis", "Kemitraan strategis dengan Microsoft, Franklin Templeton, dan BlackRock BUIDL", "Dukungan pendanaan kuat dari institusi"],
    risks: ["Emisi pembukaan token (unlock) masih cukup besar", "Persaingan ketat dengan Sui sesama pengguna bahasa Move"],
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    category: "Layer 2",
    consensus: "Optimistic Rollup (Ethereum L2)",
    description: "Solusi penskalaan Layer 2 terbesar di Ethereum yang menggunakan teknologi Optimistic Rollup untuk memangkas biaya gas fee hingga 95% dengan keamanan setara mainnet Ethereum.",
    pros: ["Total Value Locked (TVL) terbesar di antara seluruh Layer 2", "Ekosistem DeFi derivatif paling matang (GMX, Camelot, Uniswap)", "Peningkatan efisiensi biaya lewat upgrade Dencun"],
    risks: ["Tekanan jual dari unlock token tahunan", "Persaingan ketat dari ekosistem Base dan Optimism"],
  },
  {
    symbol: "OP",
    name: "Optimism",
    category: "Layer 2",
    consensus: "Optimistic Rollup + OP Stack",
    description: "Penskalaan Ethereum Layer 2 yang mempopulerkan OP Stack, framework modular yang diadopsi oleh jaringan raksasa seperti Coinbase Base, Worldcoin World Chain, dan Sony Soneium.",
    pros: ["Adopsi framework OP Stack oleh industri raksasa (Base, World Chain)", "Superchain vision menyatukan likuiditas multi-rollup", "Dukungan pendanaan publik goods yang kuat"],
    risks: ["Token utilitas OP terbatas pada governance", "Jadwal unlock token rutin ke kontributor"],
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    category: "DeFi",
    consensus: "Ethereum ERC-20",
    description: "Protokol bursa terdesentralisasi (DEX) otomatis (AMM) terbesar di dunia. Memfasilitasi pertukaran token tanpa perantara di puluhan jaringan blockchain.",
    pros: ["Volume perdagangan DEX nomor satu secara kumulatif", "Peluncuran Uniswap v4 dengan fitur 'hooks' yang inovatif", "Potensi aktivasi fee-switch bagi staker UNI di masa depan"],
    risks: ["Regulasi SEC terhadap antarmuka DEX", "Persaingan dari DEX orderbook terpusat"],
  },
  {
    symbol: "AAVE",
    name: "Aave",
    category: "DeFi",
    consensus: "Ethereum ERC-20",
    description: "Protokol pinjam-meminjam (lending & borrowing) terdesentralisasi terkemuka di mana pengguna dapat mendepositkan aset kripto untuk memperoleh imbal hasil (bunga) atau meminjam dengan jaminan overcollateralized.",
    pros: ["Protokol lending paling aman tanpa riwayat gagal bayar", "Suplai token hampir 100% beredar (deflasioner via buyback)", "Proposal 'fee switch' mendistribusikan pendapatan protokol"],
    risks: ["Ketergantungan pada likuiditas pasar kripto secara umum", "Risiko likuidasi massal saat pasar crash"],
  },
  {
    symbol: "INJ",
    name: "Injective",
    category: "DeFi",
    consensus: "Tendermint PoS (Cosmos SDK)",
    description: "Blockchain Layer 1 yang dioptimalkan khusus untuk sektor keuangan: modul orderbook on-chain, derivatif, FX, dan instrumen bursa terdesentralisasi tanpa gas fee tersembunyi.",
    pros: ["Lelang pembakaran mingguan (weekly burn auction) membakar jutaan koin", "Kecepatan transaksi sub-detik dengan nol gas fee bagi dApps", "Dukungan investor Mark Cuban dan Binance Labs"],
    risks: ["Likuiditas derivatif masih harus bersaing dengan CEX konvensional", "Komunitas relatif niche"],
  },
  {
    symbol: "KAS",
    name: "Kaspa",
    category: "Layer 1",
    consensus: "BlockDAG Proof of Work (GhostDAG)",
    description: "Aset digital Proof of Work pertama yang menerapkan arsitektur BlockDAG (Directed Acyclic Graph), memungkinkan konfirmasi blok paralel hingga 10 blok per detik tanpa membuang komputasi.",
    pros: ["Inovasi BlockDAG menyelesaikan trilema skalabilitas PoW", "Distribusi fair launch murni tanpa pra-penjualan atau alokasi VC", "Laju blok ultra-cepat 10 blok per detik"],
    risks: ["Belum terdaftar di semua bursa CEX tier 1 (misal Binance/Coinbase)", "Ekosistem smart contract masih dalam tahap pengembangan (KRC-20)"],
  },
  {
    symbol: "TON",
    name: "Toncoin",
    category: "Layer 1",
    consensus: "Catchain Proof of Stake",
    description: "Blockchain Layer 1 yang terintegrasi erat dengan aplikasi perpesanan Telegram (900+ juta pengguna aktif). Memfasilitasi dompet kripto native, mini-apps, dan pembayaran bot.",
    pros: ["Akses langsung ke 900+ juta pengguna Telegram", "Pertumbuhan ekosistem Mini-Apps & Tap-to-Earn masif", "Dukungan pembayaran USDT native langsung di Telegram"],
    risks: ["Ketergantungan tinggi pada kelangsungan ekosistem Telegram", "Isu hukum regulator terhadap founder Telegram"],
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    category: "Stablecoin",
    consensus: "Multi-Chain Fiat Collateralized",
    description: "Stablecoin tertua dan paling likuid di dunia yang dipatok 1:1 dengan Dolar AS. Didukung oleh cadangan kas dan Surat Utang Negara AS (US Treasury Bills).",
    pros: ["Likuiditas nomor satu di seluruh pasar kripto dunia", "Keuntungan operasional cadangan kas Tether melampaui raksasa Wall Street", "Tersedia di hampir seluruh jaringan blockchain"],
    risks: ["Risiko sentralisasi penerbit (Tether Holdings Ltd)", "Tekanan regulasi MiCA di Eropa"],
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    category: "Stablecoin",
    consensus: "Multi-Chain Fiat Collateralized",
    description: "Stablecoin teregulasi yang diterbitkan oleh Circle Internet Financial dengan transparansi cadangan penuh yang diaudit oleh kantor akuntan publik ternama.",
    pros: ["Kepatuhan hukum dan audit cadangan kas sangat transparan", "Dipilih sebagai standar pembayaran institusi tradisional (Visa)", "Pilihan utama protokol DeFi berorientasi keamanan"],
    risks: ["Pernah mengalami de-peg singkat saat krisis perbankan SVB 2023", "Bisa dibekukan oleh regulator jika ada investigasi"],
  },
  {
    symbol: "TRX",
    name: "TRON",
    category: "Layer 1",
    consensus: "Delegated Proof of Stake (DPoS)",
    description: "Jaringan blockchain terdesentralisasi yang didirikan oleh Justin Sun. Menjadi jaringan utama peredaran USDT terbesar di dunia (TRC-20) dengan volume transfer harian bernilai miliaran dolar.",
    website_url: "https://tron.network",
    whitepaper_url: "https://tron.network/static/doc/white_paper_v_2_0.pdf",
    explorer_url: "https://tronscan.org",
    pros: ["Jaringan peredaran USDT terbesar di dunia dengan biaya transfer flat murah", "Volume transaksi harian sangat tinggi dan stabil", "Mekanisme deflasi pembakaran TRX rutin"],
    risks: ["Konsentrasi validator super representatif (27 Super Representatives)", "Sensitif terhadap isu hukum pendiri proyek"],
  },
  {
    symbol: "LTC",
    name: "Litecoin",
    category: "Payments",
    consensus: "Proof of Work (Scrypt)",
    description: "Diciptakan oleh mantan insinyur Google Charlie Lee pada 2011 sebagai perak digital pelengkap emas digital Bitcoin. Memiliki waktu konfirmasi blok 2.5 menit dan batas suplai pasti 84 juta LTC.",
    website_url: "https://litecoin.org",
    whitepaper_url: "https://litecoin.org",
    explorer_url: "https://blockchair.com/litecoin",
    pros: ["Salah satu blockchain PoW paling teruji dengan 100% uptime sejak 2011", "Fitur privasi opsional MimbleWimble (MWEB)", "Likuiditas global di seluruh bursa dunia"],
    risks: ["Pertumbuhan ekosistem smart contract terbatas", "Pergerakan harga cenderung tertinggal dari narasi kripto baru"],
  },
  {
    symbol: "BCH",
    name: "Bitcoin Cash",
    category: "Payments",
    consensus: "Proof of Work (SHA-256)",
    description: "Hasil hard fork Bitcoin pada 2017 dengan kapasitas blok 32 MB agar mampu memproses transaksi cepat berbiaya receh sebagai uang elektronik peer-to-peer global.",
    website_url: "https://bitcoincash.org",
    whitepaper_url: "https://bitcoincash.org/bitcoin.pdf",
    explorer_url: "https://blockchair.com/bitcoin-cash",
    pros: ["Kapasitas blok besar memfasilitasi transaksi berbiaya pecahan rupiah", "Suplai terbatas mutlak 21 juta koin dengan siklus halving", "Dukungan pembayaran merchant global"],
    risks: ["Dominasi hash rate komputasi masih jauh di bawah Bitcoin (BTC)", "Persaingan ketat dengan solusi Layer 2"],
  },
  {
    symbol: "XLM",
    name: "Stellar",
    category: "Payments",
    consensus: "Stellar Consensus Protocol (SCP)",
    description: "Jaringan pembayaran open-source yang didirikan oleh Jed McCaleb. Menghubungkan bank internasional, sistem pembayaran, dan individu untuk transfer uang lintas negara secara instan.",
    website_url: "https://stellar.org",
    whitepaper_url: "https://stellar.org/papers/stellar-consensus-protocol",
    explorer_url: "https://stellar.expert",
    pros: ["Kemitraan kuat dengan institusi internasional (MoneyGram, Franklin Templeton)", "Platform smart contract Soroban menambahkan kapabilitas DeFi", "Biaya transfer nyaris nol"],
    risks: ["Peredaran token bertahap dari yayasan Stellar Development Foundation", "Sektor pembayaran cross-border bersaing ketat dengan XRP"],
  },
  {
    symbol: "HBAR",
    name: "Hedera",
    category: "Layer 1",
    consensus: "Hashgraph aBFT",
    description: "Jaringan publik terdesentralisasi berbasis teknologi Directed Acyclic Graph (Hashgraph) dengan keamanan tingkat militer aBFT. Dikelola oleh Dewan Pengurus korporasi dunia seperti Google, IBM, Boeing, dan Dell.",
    website_url: "https://hedera.com",
    whitepaper_url: "https://hedera.com/whitepaper",
    explorer_url: "https://hashscan.io",
    pros: ["Teknologi Hashgraph berkecepatan 10.000+ TPS dengan finalitas pasti", "Dewan pengurus terdiri dari korporasi terkemuka dunia", "Biaya transaksi sangat murah dan dipatok stabil dalam USD"],
    risks: ["Tingkat desentralisasi tata kelola dewan sering diperdebatkan komunitas kripto", "Unlock token berkala masih berlanjut"],
  },
  {
    symbol: "ICP",
    name: "Internet Computer",
    category: "Infrastructure",
    consensus: "Threshold Relay + Proof of Useful Work",
    description: "Inovasi komputasi cloud terdesentralisasi dari DFINITY Foundation. Memungkinkan aplikasi web, smart contracts (canisters), dan model kecerdasan buatan dijalankan 100% on-chain tanpa cloud konvensional.",
    website_url: "https://internetcomputer.org",
    whitepaper_url: "https://internetcomputer.org/whitepaper.pdf",
    explorer_url: "https://dashboard.internetcomputer.org",
    pros: ["Komputasi web 100% on-chain tanpa server cloud tersentralisasi", "Dapat mengeksekusi inferensi model AI secara native on-chain", "Teknologi kriptografi Chain Fusion mengintegrasikan Bitcoin & Ethereum"],
    risks: ["Riwayat penurunan harga curam pasca listing ATH 2021", "Kurva pembelajaran arsitektur canister bagi developer baru"],
  },
  {
    symbol: "POL",
    name: "Polygon",
    category: "Layer 2",
    consensus: "Proof of Stake + AggLayer zkEVM",
    description: "Token generasi baru hasil migrasi MATIC ke POL untuk mendukung visi Polygon 2.0. Menghubungkan likuiditas antar rollup Zero-Knowledge (ZK) di ekosistem AggLayer.",
    website_url: "https://polygon.technology",
    whitepaper_url: "https://polygon.technology/papers/polygon-2-0-whitepapers",
    explorer_url: "https://polygonscan.com",
    pros: ["Jaringan mitra institusi korporasi paling luas (Nike, Starbucks, Reddit)", "Teknologi AggLayer menyatukan likuiditas lintas rantai ZK", "Keberhasilan migrasi token MATIC ke POL"],
    risks: ["Persaingan ketat rollup Layer 2 (Arbitrum, Base, Optimism)", "Kompleksitas roadmap ekosistem ZK"],
  },
  {
    symbol: "TIA",
    name: "Celestia",
    category: "Infrastructure",
    consensus: "Tendermint PoS (Modular DA)",
    description: "Blockchain Data Availability (DA) modular pertama di dunia. Memisahkan konsensus dan ketersediaan data dari lapisan eksekusi, memangkas biaya operasional rollup secara signifikan.",
    website_url: "https://celestia.org",
    whitepaper_url: "https://celestia.org/resources/whitepaper",
    explorer_url: "https://celestiascan.com",
    pros: ["Pelopor arsitektur modular Data Availability yang diadopsi luas", "Teknologi Data Availability Sampling (DAS) efisien", "Pilihan favorit bagi pengembang rollup kustom"],
    risks: ["Tekanan jual dari jadwal pembukaan token investor", "Persaingan solusi DA dari Ethereum EIP-4844 dan EigenDA"],
  },
  {
    symbol: "SEI",
    name: "Sei",
    category: "Layer 1",
    consensus: "Twin-Turbo Consensus (Parallel EVM)",
    description: "Blockchain Layer 1 Parallelized EVM pertama yang dirancang untuk kecepatan transaksi ekstrim (finalitas 390 milidetik), mengoptimalkan trading bursa desentralisasi dan aplikasi Web3.",
    website_url: "https://sei.io",
    whitepaper_url: "https://sei.io/whitepaper",
    explorer_url: "https://seistream.app",
    pros: ["Parallelized EVM tercepat dengan finalitas sub-detik 390ms", "Kompatibilitas penuh dengan kode Ethereum smart contract", "Dukungan venture capital ternama (Multicoin, Jump Crypto)"],
    risks: ["Persaingan di sektor L1 paralel (Monad, Sui, Aptos)", "Pertumbuhan TVL ekosistem masih dalam tahap akselerasi"],
  },
  {
    symbol: "BONK",
    name: "Bonk",
    category: "Meme",
    consensus: "Solana SPL Token",
    description: "Meme coin berlogo anjing pertama di blockchain Solana yang di-airdrop ke komunitas pengembang dan holder NFT Solana, menjadi simbol kebangkitan ekosistem Solana.",
    website_url: "https://bonkcoin.com",
    whitepaper_url: "https://bonkcoin.com",
    explorer_url: "https://solscan.io/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    pros: ["Simbol kultural komunitas Solana dengan integrasi luas di dApps", "Mekanisme buyback and burn token dari utilitas BonkBot", "Listing lengkap di bursa Tier-1 global"],
    risks: ["Volatilitas ekstrim khas koin meme", "Sensitif terhadap hype media sosial"],
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    category: "Meme",
    consensus: "Solana SPL Token",
    description: "Koin meme sensasional di blockchain Solana yang menampilkan gambar anjing Shiba Inu bertopi rajut merah muda ('literally just a dog with a hat').",
    website_url: "https://dogwifcoin.org",
    whitepaper_url: "https://dogwifcoin.org",
    explorer_url: "https://solscan.io/token/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    pros: ["100% suplai koin beredar di pasar tanpa resiko inflasi tim", "Salah satu koin meme tercepat mencapai valuasi multi-miliar dolar", "Dukungan komunitas global yang sangat militan"],
    risks: ["Nol fundamental teknikal selain sentimen meme murni", "Fluktuasi harga sangat cepat"],
  },
  {
    symbol: "OM",
    name: "MANTRA",
    category: "Layer 1",
    consensus: "Proof of Stake (Cosmos SDK)",
    description: "Blockchain Layer 1 yang berfokus pada tokenisasi aset dunia nyata (Real World Assets / RWA) dengan kerangka kepatuhan regulasi institusional dan lisensi finansial di Timur Tengah.",
    website_url: "https://mantrachain.io",
    whitepaper_url: "https://mantrachain.io/whitepaper",
    explorer_url: "https://www.mintscan.io/mantra",
    pros: ["Pemimpin narasi tokenisasi Real World Assets (RWA) institusional", "Kemitraan korporasi properti raksasa di Dubai dan Timur Tengah", "Pertumbuhan harga dan TVL terkuat di 2024"],
    risks: ["Kenaikan harga parabola berpotensi mengalami koreksi teknikal", "Ketergantungan pada regulasi yurisdiksi tertentu"],
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    category: "DeFi",
    consensus: "Solana Program",
    description: "Mesin agregator bursa terdesentralisasi (DEX) utama di ekosistem Solana. Memproses rute swap likuiditas terbaik, platform trading derivatif perpetual, dan launchpad token LFG.",
    website_url: "https://jup.ag",
    whitepaper_url: "https://jup.ag/docs",
    explorer_url: "https://solscan.io/token/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    pros: ["Memproses lebih dari 70% volume perdagangan DEX di jaringan Solana", "Model tata kelola komunitas Jupuary & alokasi fee voting aktif", "Platform launchpad proyek-proyek top Solana"],
    risks: ["Emisi pembukaan token komunitas berkala", "Persaingan agregator likuiditas lintas rantai"],
  },
  {
    symbol: "ATOM",
    name: "Cosmos",
    category: "Interoperability",
    consensus: "Tendermint BFT PoS",
    description: "Pelopor ekosistem 'Internet of Blockchains'. Framework Cosmos SDK dan protokol Inter-Blockchain Communication (IBC) telah menggerakkan blockchain raksasa seperti Osmosis, Celestia, dan Injective.",
    website_url: "https://cosmos.network",
    whitepaper_url: "https://v1.cosmos.network/resources/whitepaper",
    explorer_url: "https://www.mintscan.io/cosmos",
    pros: ["Arsitektur IBC standar emas komunikasi desentralisasi tanpa jembatan", "Teknologi Cosmos SDK paling banyak dipakai untuk L1 mandiri", "Pembaruan tata kelola Interchain Security"],
    risks: ["Akrual nilai token ATOM historis terpisah dari kesuksesan dApps ekosistemnya", "Inflasi token dinamis"],
  },
  {
    symbol: "FIL",
    name: "Filecoin",
    category: "Infrastructure",
    consensus: "Proof of Spacetime (PoSt)",
    description: "Jaringan penyimpanan data terdesentralisasi terbesar di dunia (IPFS). Mengubah kapasitas hard disk yang menganggur di seluruh dunia menjadi pasar cloud penyimpanan data yang murah dan tahan sensor.",
    website_url: "https://filecoin.io",
    whitepaper_url: "https://filecoin.io/filecoin.pdf",
    explorer_url: "https://filfox.info",
    pros: ["Kapasitas penyimpanan data terdesentralisasi terbesar di Web3", "Peluncuran Filecoin Virtual Machine (FVM) mengaktifkan smart contracts", "Kemitraan penyimpanan arsip sains dan data institusi"],
    risks: ["Model tokenomik emisi penambang penyimpanan cukup besar", "Persaingan harga dengan penyedia cloud Web2 (AWS S3)"],
  },
  {
    symbol: "ALGO",
    name: "Algorand",
    category: "Layer 1",
    consensus: "Pure Proof of Stake (PPoS)",
    description: "Diciptakan oleh peraih penghargaan bergengsi Turing Award Silvio Micali. Menyediakan finalitas transaksi instan di bawah 3 detik tanpa percabangan (zero fork) dengan konsumsi energi karbon negatif.",
    website_url: "https://algorand.co",
    whitepaper_url: "https://algorand.co/technology",
    explorer_url: "https://allo.info",
    pros: ["Konsensus Pure PoS dengan finalitas mutlak tanpa percabangan jaringan", "Efisiensi energi karbon-negatif dan ramah lingkungan", "Adopsi tokenisasi aset di Eropa dan kemitraan FIFA"],
    risks: ["Pertumbuhan ekosistem DeFi relatif lambat dibanding Solana & Ethereum L2", "Valuasi pasar sempat terkoreksi dalam sejak 2021"],
  },
];

// Comprehensive dictionary for Binance Spot Pairs
export const COIN_NAMES: Record<string, string> = {
  TRX: "TRON",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  XLM: "Stellar",
  HBAR: "Hedera",
  ATOM: "Cosmos",
  FIL: "Filecoin",
  ICP: "Internet Computer",
  ETC: "Ethereum Classic",
  VET: "VeChain",
  RUNE: "THORChain",
  BONK: "Bonk",
  WIF: "dogwifhat",
  FLOKI: "FLOKI",
  JUP: "Jupiter",
  PYTH: "Pyth Network",
  PENDLE: "Pendle",
  ONDO: "Ondo Finance",
  STX: "Stacks",
  IMX: "Immutable",
  GRT: "The Graph",
  WLD: "Worldcoin",
  GALA: "Gala",
  SAND: "The Sandbox",
  MANA: "Decentraland",
  AXS: "Axie Infinity",
  CHZ: "Chiliz",
  DYDX: "dYdX",
  CRV: "Curve DAO",
  SNX: "Synthetix",
  LDO: "Lido DAO",
  MKR: "Maker",
  ENS: "Ethereum Name Service",
  STRK: "Starknet",
  ZK: "ZKsync",
  ENA: "Ethena",
  NOT: "Notcoin",
  IO: "io.net",
  W: "Wormhole",
  NEIRO: "First Neiro on Ethereum",
  TIA: "Celestia",
  SEI: "Sei",
  ALGO: "Algorand",
  FTM: "Fantom / Sonic",
  BOME: "BOOK OF MEME",
  POPCAT: "Popcat",
  MEW: "cat in a dogs world",
  TURBO: "Turbo",
  BLUR: "Blur",
  TWT: "Trust Wallet Token",
  CAKE: "PancakeSwap",
};

export const COIN_CATEGORIES: Record<string, CryptoCategory> = {
  TRX: "Layer 1",
  LTC: "Payments",
  BCH: "Payments",
  XLM: "Payments",
  HBAR: "Layer 1",
  ATOM: "Interoperability",
  FIL: "Infrastructure",
  ICP: "Infrastructure",
  ETC: "Layer 1",
  VET: "Infrastructure",
  RUNE: "DeFi",
  BONK: "Meme",
  WIF: "Meme",
  FLOKI: "Meme",
  JUP: "DeFi",
  PYTH: "Infrastructure",
  PENDLE: "DeFi",
  ONDO: "DeFi",
  STX: "Layer 2",
  IMX: "Layer 2",
  GRT: "Infrastructure",
  WLD: "AI & Big Data",
  GALA: "Meme",
  SAND: "Meme",
  MANA: "Meme",
  AXS: "DeFi",
  CHZ: "Payments",
  DYDX: "DeFi",
  CRV: "DeFi",
  SNX: "DeFi",
  LDO: "DeFi",
  MKR: "DeFi",
  ENS: "Infrastructure",
  STRK: "Layer 2",
  ZK: "Layer 2",
  ENA: "DeFi",
  NOT: "Meme",
  IO: "AI & Big Data",
  W: "Interoperability",
  NEIRO: "Meme",
  TIA: "Infrastructure",
  SEI: "Layer 1",
  ALGO: "Layer 1",
  FTM: "Layer 1",
  BOME: "Meme",
  POPCAT: "Meme",
  MEW: "Meme",
  TURBO: "Meme",
  BLUR: "DeFi",
  TWT: "Infrastructure",
  CAKE: "DeFi",
};

export interface CoinOfficialLinks {
  cmcSlug: string;
  website: string;
  whitepaper: string;
  explorer: string;
  github?: string;
}

export const COIN_OFFICIAL_LINKS: Record<string, CoinOfficialLinks> = {
  BTC: {
    cmcSlug: "bitcoin",
    website: "https://bitcoin.org",
    whitepaper: "https://bitcoin.org/bitcoin.pdf",
    explorer: "https://mempool.space",
    github: "https://github.com/bitcoin/bitcoin",
  },
  ETH: {
    cmcSlug: "ethereum",
    website: "https://ethereum.org",
    whitepaper: "https://ethereum.org/en/whitepaper/",
    explorer: "https://etherscan.io",
    github: "https://github.com/ethereum/go-ethereum",
  },
  SOL: {
    cmcSlug: "solana",
    website: "https://solana.com",
    whitepaper: "https://solana.com/solana-whitepaper.pdf",
    explorer: "https://solscan.io",
    github: "https://github.com/solana-labs/solana",
  },
  BNB: {
    cmcSlug: "bnb",
    website: "https://www.bnbchain.org",
    whitepaper: "https://github.com/bnb-chain/whitepaper/blob/master/WHITEPAPER.md",
    explorer: "https://bscscan.com",
    github: "https://github.com/bnb-chain",
  },
  XRP: {
    cmcSlug: "xrp",
    website: "https://ripple.com",
    whitepaper: "https://ripple.com/files/ripple_consensus_whitepaper.pdf",
    explorer: "https://xrpscan.com",
    github: "https://github.com/ripple/rippled",
  },
  DOGE: {
    cmcSlug: "dogecoin",
    website: "https://dogecoin.com",
    whitepaper: "https://github.com/dogecoin/dogecoin/blob/master/README.md",
    explorer: "https://dogechain.info",
    github: "https://github.com/dogecoin/dogecoin",
  },
  ADA: {
    cmcSlug: "cardano",
    website: "https://cardano.org",
    whitepaper: "https://cardano.org/ouroboros/",
    explorer: "https://cardanoscan.io",
    github: "https://github.com/cardano-foundation",
  },
  AVAX: {
    cmcSlug: "avalanche",
    website: "https://avax.network",
    whitepaper: "https://www.avalabs.org/whitepapers",
    explorer: "https://snowtrace.io",
    github: "https://github.com/ava-labs",
  },
  SUI: {
    cmcSlug: "sui",
    website: "https://sui.io",
    whitepaper: "https://github.com/MystenLabs/sui/blob/main/doc/paper/sui.pdf",
    explorer: "https://suiscan.xyz",
    github: "https://github.com/MystenLabs/sui",
  },
  LINK: {
    cmcSlug: "chainlink",
    website: "https://chain.link",
    whitepaper: "https://chain.link/whitepaper",
    explorer: "https://etherscan.io/token/0x514910771af9ca656af840dff83e8264ecf986ca",
    github: "https://github.com/smartcontractkit/chainlink",
  },
  NEAR: {
    cmcSlug: "near-protocol",
    website: "https://near.org",
    whitepaper: "https://near.org/papers/the-official-near-white-paper/",
    explorer: "https://nearblocks.io",
    github: "https://github.com/near",
  },
  TAO: {
    cmcSlug: "bittensor",
    website: "https://bittensor.com",
    whitepaper: "https://bittensor.com/whitepaper",
    explorer: "https://taostats.io",
    github: "https://github.com/opentensor/bittensor",
  },
  RENDER: {
    cmcSlug: "render",
    website: "https://render.x.io",
    whitepaper: "https://render.x.io/whitepaper",
    explorer: "https://solscan.io/token/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    github: "https://github.com/rendernetwork",
  },
  DOT: {
    cmcSlug: "polkadot-new",
    website: "https://polkadot.com",
    whitepaper: "https://polkadot.com/whitepaper/",
    explorer: "https://polkadot.subscan.io",
    github: "https://github.com/paritytech/polkadot-sdk",
  },
  SHIB: {
    cmcSlug: "shiba-inu",
    website: "https://shib.io",
    whitepaper: "https://shibatoken.com/shibpaper",
    explorer: "https://etherscan.io/token/0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
    github: "https://github.com/shibatoken",
  },
  PEPE: {
    cmcSlug: "pepe",
    website: "https://pepe.vip",
    whitepaper: "https://pepe.vip/#about",
    explorer: "https://etherscan.io/token/0x6982508145454ce325ddbe47a25d4ec3d2311933",
    github: "https://github.com/pepe-coin",
  },
  APT: {
    cmcSlug: "aptos",
    website: "https://aptosfoundation.org",
    whitepaper: "https://aptosfoundation.org/whitepaper/aptos-whitepaper_en.pdf",
    explorer: "https://explorer.aptoslabs.com",
    github: "https://github.com/aptos-labs/aptos-core",
  },
  ARB: {
    cmcSlug: "arbitrum",
    website: "https://arbitrum.io",
    whitepaper: "https://docs.arbitrum.io/welcome/get-started",
    explorer: "https://arbiscan.io",
    github: "https://github.com/OffchainLabs",
  },
  OP: {
    cmcSlug: "optimism-ethereum",
    website: "https://optimism.io",
    whitepaper: "https://community.optimism.io",
    explorer: "https://optimistic.etherscan.io",
    github: "https://github.com/ethereum-optimism",
  },
  UNI: {
    cmcSlug: "uniswap",
    website: "https://uniswap.org",
    whitepaper: "https://uniswap.org/whitepaper-v3.pdf",
    explorer: "https://etherscan.io/token/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    github: "https://github.com/Uniswap",
  },
  AAVE: {
    cmcSlug: "aave",
    website: "https://aave.com",
    whitepaper: "https://github.com/aave/aave-v3-core/blob/master/techpaper/Aave_V3_Technical_Paper.pdf",
    explorer: "https://etherscan.io/token/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    github: "https://github.com/aave",
  },
  INJ: {
    cmcSlug: "injective",
    website: "https://injective.com",
    whitepaper: "https://injective.com/injective-whitepaper.pdf",
    explorer: "https://explorer.injective.network",
    github: "https://github.com/InjectiveLabs",
  },
  TON: {
    cmcSlug: "toncoin",
    website: "https://ton.org",
    whitepaper: "https://ton.org/whitepaper.pdf",
    explorer: "https://tonscan.org",
    github: "https://github.com/ton-blockchain",
  },
  KAS: {
    cmcSlug: "kaspa",
    website: "https://kaspa.org",
    whitepaper: "https://eprint.iacr.org/2018/1040.pdf",
    explorer: "https://explorer.kaspa.org",
    github: "https://github.com/kaspanet",
  },
  TRX: {
    cmcSlug: "tron",
    website: "https://tron.network",
    whitepaper: "https://tron.network/static/doc/white_paper_v_2_0.pdf",
    explorer: "https://tronscan.org",
    github: "https://github.com/tronprotocol",
  },
  LTC: {
    cmcSlug: "litecoin",
    website: "https://litecoin.org",
    whitepaper: "https://litecoin.org",
    explorer: "https://blockchair.com/litecoin",
    github: "https://github.com/litecoin-project/litecoin",
  },
  BCH: {
    cmcSlug: "bitcoin-cash",
    website: "https://bitcoincash.org",
    whitepaper: "https://bitcoincash.org/bitcoin.pdf",
    explorer: "https://blockchair.com/bitcoin-cash",
    github: "https://github.com/bitcoin-cash-node/bitcoin-cash-node",
  },
  XLM: {
    cmcSlug: "stellar",
    website: "https://stellar.org",
    whitepaper: "https://stellar.org/papers/stellar-consensus-protocol",
    explorer: "https://stellar.expert",
    github: "https://github.com/stellar",
  },
  HBAR: {
    cmcSlug: "hedera",
    website: "https://hedera.com",
    whitepaper: "https://hedera.com/whitepaper",
    explorer: "https://hashscan.io",
    github: "https://github.com/hashgraph",
  },
  ICP: {
    cmcSlug: "internet-computer",
    website: "https://internetcomputer.org",
    whitepaper: "https://internetcomputer.org/whitepaper.pdf",
    explorer: "https://dashboard.internetcomputer.org",
    github: "https://github.com/dfinity",
  },
  POL: {
    cmcSlug: "polygon-ecosystem-token",
    website: "https://polygon.technology",
    whitepaper: "https://polygon.technology/papers/polygon-2-0-whitepapers",
    explorer: "https://polygonscan.com",
    github: "https://github.com/maticnetwork",
  },
  TIA: {
    cmcSlug: "celestia",
    website: "https://celestia.org",
    whitepaper: "https://celestia.org/resources/whitepaper",
    explorer: "https://celestiascan.com",
    github: "https://github.com/celestiaorg",
  },
  SEI: {
    cmcSlug: "sei",
    website: "https://sei.io",
    whitepaper: "https://sei.io/whitepaper",
    explorer: "https://seistream.app",
    github: "https://github.com/sei-protocol",
  },
  BONK: {
    cmcSlug: "bonk1",
    website: "https://bonkcoin.com",
    whitepaper: "https://bonkcoin.com",
    explorer: "https://solscan.io/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    github: "https://github.com/bonk-coin",
  },
  WIF: {
    cmcSlug: "dogwifhat",
    website: "https://dogwifcoin.org",
    whitepaper: "https://dogwifcoin.org",
    explorer: "https://solscan.io/token/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  },
  OM: {
    cmcSlug: "mantra",
    website: "https://mantrachain.io",
    whitepaper: "https://mantrachain.io/whitepaper",
    explorer: "https://www.mintscan.io/mantra",
  },
  JUP: {
    cmcSlug: "jupiter-exchange-solana",
    website: "https://jup.ag",
    whitepaper: "https://jup.ag/docs",
    explorer: "https://solscan.io/token/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    github: "https://github.com/jup-ag",
  },
  ATOM: {
    cmcSlug: "cosmos",
    website: "https://cosmos.network",
    whitepaper: "https://v1.cosmos.network/resources/whitepaper",
    explorer: "https://www.mintscan.io/cosmos",
    github: "https://github.com/cosmos",
  },
  FIL: {
    cmcSlug: "filecoin",
    website: "https://filecoin.io",
    whitepaper: "https://filecoin.io/filecoin.pdf",
    explorer: "https://filfox.info",
    github: "https://github.com/filecoin-project",
  },
  ALGO: {
    cmcSlug: "algorand",
    website: "https://algorand.co",
    whitepaper: "https://algorand.co/technology",
    explorer: "https://allo.info",
    github: "https://github.com/algorand",
  },
  FTM: {
    cmcSlug: "fantom",
    website: "https://fantom.foundation",
    whitepaper: "https://fantom.foundation/research/wp_home.pdf",
    explorer: "https://ftmscan.com",
    github: "https://github.com/Fantom-foundation",
  },
  ETC: {
    cmcSlug: "ethereum-classic",
    website: "https://ethereumclassic.org",
    whitepaper: "https://ethereumclassic.org/knowledge-base",
    explorer: "https://etcblockexplorer.com",
    github: "https://github.com/ethereumclassic",
  },
  FLOKI: {
    cmcSlug: "floki-inu",
    website: "https://floki.com",
    whitepaper: "https://docs.floki.com",
    explorer: "https://etherscan.io/token/0xcf0c122c6b73ff809c693db761e7baebe62b6a2e",
  },
  PYTH: {
    cmcSlug: "pyth-network",
    website: "https://pyth.network",
    whitepaper: "https://docs.pyth.network/home",
    explorer: "https://solscan.io/token/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    github: "https://github.com/pyth-network",
  },
  PENDLE: {
    cmcSlug: "pendle",
    website: "https://pendle.finance",
    whitepaper: "https://docs.pendle.finance",
    explorer: "https://etherscan.io/token/0x808507121b80c02388fad14726482e061b8da827",
    github: "https://github.com/pendle-finance",
  },
  ONDO: {
    cmcSlug: "ondo-finance",
    website: "https://ondo.finance",
    whitepaper: "https://docs.ondo.finance",
    explorer: "https://etherscan.io/token/0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
  },
  STX: {
    cmcSlug: "stacks",
    website: "https://stacks.co",
    whitepaper: "https://stacks.co/whitepaper.pdf",
    explorer: "https://explorer.hiro.so",
    github: "https://github.com/stacks-network",
  },
  IMX: {
    cmcSlug: "immutablex",
    website: "https://immutable.com",
    whitepaper: "https://docs.immutable.com",
    explorer: "https://etherscan.io/token/0xf57e7e7c23978c3caec3c3548e3d615c346e79ff",
  },
  GRT: {
    cmcSlug: "the-graph",
    website: "https://thegraph.com",
    whitepaper: "https://thegraph.com/docs/en/about/",
    explorer: "https://etherscan.io/token/0xc944e90c64b2c07662a292be6244bdf05cda44a7",
    github: "https://github.com/graphprotocol",
  },
  WLD: {
    cmcSlug: "worldcoin-org",
    website: "https://worldcoin.org",
    whitepaper: "https://worldcoin.org/whitepaper",
    explorer: "https://etherscan.io/token/0x163f8c2467924be0ae7b5347228cabf260318753",
  },
  CRV: {
    cmcSlug: "curve-dao-token",
    website: "https://curve.fi",
    whitepaper: "https://curve.fi/files/stableswap-paper.pdf",
    explorer: "https://etherscan.io/token/0xd533a949740bb3306d119cc777fa900ba034cd52",
    github: "https://github.com/curvefi",
  },
  DYDX: {
    cmcSlug: "dydx-eth",
    website: "https://dydx.exchange",
    whitepaper: "https://dydx.exchange",
    explorer: "https://etherscan.io/token/0x92d6c1e31e14520e676a687f0a93788b716beff5",
  },
  LDO: {
    cmcSlug: "lido-dao",
    website: "https://lido.fi",
    whitepaper: "https://lido.fi/static/Lido:Ethereum-Liquid-Staking.pdf",
    explorer: "https://etherscan.io/token/0x5a98fcbea516cf06857215779fd812ca96ef143e",
    github: "https://github.com/lidofinance",
  },
  MKR: {
    cmcSlug: "maker",
    website: "https://makerdao.com",
    whitepaper: "https://makerdao.com/whitepaper/",
    explorer: "https://etherscan.io/token/0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
  },
  FET: {
    cmcSlug: "artificial-superintelligence-alliance",
    website: "https://fetch.ai",
    whitepaper: "https://fetch.ai/whitepaper.pdf",
    explorer: "https://etherscan.io/token/0xaea46a44ac14229070931d759ac7dca971fe75be",
    github: "https://github.com/fetchai",
  },
  USDT: {
    cmcSlug: "tether",
    website: "https://tether.to",
    whitepaper: "https://tether.to/en/transparency/",
    explorer: "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7",
  },
  USDC: {
    cmcSlug: "usd-coin",
    website: "https://circle.com/usdc",
    whitepaper: "https://www.circle.com/en/transparency",
    explorer: "https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  },
};

type SpotQuote = {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  closeTime: number;
};

type ProviderQuote = {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketTime?: Date;
  marketCap?: number;
  circulatingSupply?: number;
};

const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const parseTicker = (value: unknown) => typeof value === "string" && value.trim() ? finite(Number(value)) : null;
const toIdr = (value: number | null) => value === null ? null : value * USD_TO_IDR;
function timestamp(value: unknown) {
  if (value instanceof Date) return positive(value.getTime());
  if (typeof value === "number") return positive(value < 1e12 ? value * 1000 : value);
  return typeof value === "string" ? positive(Date.parse(value)) : null;
}

async function fetchSpot(symbol?: string): Promise<SpotQuote[]> {
  const url = new URL("https://api.binance.com/api/v3/ticker/24hr");
  if (symbol) url.searchParams.set("symbol", symbol + "USDT");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_500) });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body) ? body : [body];
  } catch {
    return [];
  }
}

function marketItem(symbol: string, ticker?: SpotQuote, yahoo?: ProviderQuote): CryptoItem | null {
  const spotPrice = positive(parseTicker(ticker?.lastPrice));
  const price = spotPrice ?? positive(yahoo?.regularMarketPrice);
  if (price === null) return null;

  const spot = spotPrice !== null;
  const raw = cryptoMetadata.get(symbol);
  const cap = positive(yahoo?.marketCap);
  const volume = spot ? positive(parseTicker(ticker?.quoteVolume)) : null;
  const high = spot ? positive(parseTicker(ticker?.highPrice)) : positive(yahoo?.regularMarketDayHigh);
  const low = spot ? positive(parseTicker(ticker?.lowPrice)) : positive(yahoo?.regularMarketDayLow);
  const observedAt = spot ? timestamp(ticker?.closeTime) : timestamp(yahoo?.regularMarketTime);
  return {
    rank: null,
    symbol,
    name: raw?.name ?? COIN_NAMES[symbol] ?? symbol,
    category: raw?.category ?? COIN_CATEGORIES[symbol] ?? "Lainnya",
    price_usd: price,
    price_idr: price * USD_TO_IDR,
    change_24h: spot ? parseTicker(ticker?.priceChangePercent) : finite(yahoo?.regularMarketChangePercent),
    change_7d: null,
    high_24h_usd: high,
    low_24h_usd: low,
    high_24h_idr: toIdr(high),
    low_24h_idr: toIdr(low),
    volume_24h_usd: volume,
    volume_24h_idr: toIdr(volume),
    market_cap_usd: cap,
    market_cap_idr: toIdr(cap),
    circulating_supply: positive(yahoo?.circulatingSupply),
    max_supply: null,
    ath_usd: null,
    ath_date: null,
    atl_usd: null,
    atl_date: null,
    ath_change_pct: null,
    sparkline: [],
    icon_url: "https://assets.coincap.io/assets/icons/" + symbol.toLowerCase() + "@2x.png",
    quoteSource: spot ? "Binance Spot" : "Yahoo Finance",
    quoteCurrency: spot ? "USDT" : "USD",
    observedAt,
    stale: observedAt !== null && Date.now() - observedAt > 30 * 60_000,
  };
}

const cryptoMetadata = new Map(RAW_CRYPTOS.map((coin) => [coin.symbol, coin]));
let cachedYahoo: { fetchedAt: number; quotes: ProviderQuote[] } | null = null;

async function yahooQuotes(): Promise<ProviderQuote[]> {
  if (cachedYahoo && Date.now() - cachedYahoo.fetchedAt < 5 * 60_000) return cachedYahoo.quotes;
  const result = await yf.quote(RAW_CRYPTOS.map(({ symbol }) => symbol + "-USD"), {}, {
    ...OPTS, fetchOptions: { signal: AbortSignal.timeout(4_000) },
  }).catch(() => []);
  cachedYahoo = { fetchedAt: Date.now(), quotes: result };
  return result;
}

let cachedMarket: { checkedAt: number; items: CryptoItem[] } | null = null;
let pendingMarket: Promise<{ items: CryptoItem[]; updatedAt: number | null }> | null = null;

function marketSnapshot(items: CryptoItem[]) {
  const updatedAt = items.reduce((latest, item) => Math.max(latest, item.observedAt ?? 0), 0) || null;
  return { items, updatedAt };
}

export async function getCryptoUniverse(force = false): Promise<{ items: CryptoItem[]; updatedAt: number | null }> {
  if (pendingMarket) return pendingMarket;
  if (cachedMarket && Date.now() - cachedMarket.checkedAt < (force ? 3_000 : 15_000)) {
    return marketSnapshot(cachedMarket.items);
  }

  pendingMarket = (async () => {
    const [spot, yahoo] = await Promise.all([fetchSpot(), yahooQuotes()]);
    const yahooBySymbol = new Map(yahoo.map((quote) => [quote.symbol.replace(/-USD$/, ""), quote]));
    const tickers = new Map<string, SpotQuote>();
    for (const ticker of spot) {
      if (typeof ticker?.symbol !== "string" || !/^[A-Z0-9]+USDT$/.test(ticker.symbol)) continue;
      const symbol = ticker.symbol.slice(0, -4);
      if (cryptoMetadata.has(symbol) || (!/(UP|DOWN|BULL|BEAR)$/.test(symbol) && (parseTicker(ticker.quoteVolume) ?? 0) >= 100_000)) {
        tickers.set(symbol, ticker);
      }
    }

    const previousBySymbol = new Map(cachedMarket?.items.map((item) => [item.symbol, item]));
    const items: CryptoItem[] = [];
    for (const symbol of new Set([...tickers.keys(), ...yahooBySymbol.keys(), ...previousBySymbol.keys()])) {
      const item = marketItem(symbol, tickers.get(symbol), yahooBySymbol.get(symbol));
      const previous = previousBySymbol.get(symbol);
      if (item) {
        // A slower fallback must never replace a more recent observation during an outage.
        if (previous?.observedAt && (!item.observedAt || previous.observedAt > item.observedAt)) {
          items.push({ ...previous, stale: true });
        } else {
          items.push(item);
        }
      } else if (previous) {
        items.push({ ...previous, stale: true });
      }
    }

    items.sort((a, b) => Number(a.stale) - Number(b.stale) || (b.market_cap_usd ?? -1) - (a.market_cap_usd ?? -1)
      || (b.volume_24h_usd ?? -1) - (a.volume_24h_usd ?? -1) || a.symbol.localeCompare(b.symbol));
    let verifiedRank = 0;
    for (const item of items) {
      item.rank = !item.stale && item.market_cap_usd !== null ? ++verifiedRank : null;
    }
    cachedMarket = { checkedAt: Date.now(), items };
    return marketSnapshot(items);
  })().finally(() => { pendingMarket = null; });
  return pendingMarket;
}

const missingFearGreed: CryptoFearGreed = { value: null, sentiment: "Tidak tersedia", observedAt: null, stale: false };
let fearGreed: { checkedAt: number; data: CryptoFearGreed } | null = null;
let pendingFearGreed: Promise<CryptoFearGreed> | null = null;

export async function getLiveFearAndGreed(): Promise<CryptoFearGreed> {
  if (pendingFearGreed) return pendingFearGreed;
  if (fearGreed && Date.now() - fearGreed.checkedAt < 5 * 60_000) return fearGreed.data;

  pendingFearGreed = (async () => {
    let snapshot = fearGreed?.data.value != null ? { ...fearGreed.data, stale: true } : missingFearGreed;
    try {
      const response = await fetch("https://api.alternative.me/fng/?limit=1", { signal: AbortSignal.timeout(3_500) });
      const latest = response.ok ? (await response.json())?.data?.[0] : null;
      const value = parseTicker(latest?.value);
      const observedAt = positive(Number(latest?.timestamp) * 1000);
      if (value !== null && value >= 0 && value <= 100 && observedAt !== null && typeof latest.value_classification === "string") {
        snapshot = { value, observedAt, sentiment: latest.value_classification, stale: false };
      }
    } catch {
      // Keep the provider's original observation time when the refresh fails.
    }
    fearGreed = { checkedAt: Date.now(), data: snapshot };
    return snapshot;
  })().finally(() => { pendingFearGreed = null; });
  return pendingFearGreed;
}

const DAY = 86_400_000;
const historyCache = new Map<string, { at: number; points: CryptoHistoricalPoint[] }>();
const pendingHistory = new Map<string, Promise<CryptoHistoricalPoint[]>>();

async function getHistory(symbol: string): Promise<CryptoHistoricalPoint[]> {
  const cached = historyCache.get(symbol);
  if (cached && Date.now() - cached.at < (cached.points.length ? 30 * 60_000 : 60_000)) return cached.points;
  const pending = pendingHistory.get(symbol);
  if (pending) return pending;

  const work = yf.chart(symbol + "-USD", { period1: new Date(Date.now() - 5 * 366 * DAY), interval: "1d" }, {
    fetchOptions: { signal: AbortSignal.timeout(4_000) },
  }).then(({ quotes }) => quotes.flatMap((quote) => {
    const close = positive(quote.close);
    const t = timestamp(quote.date);
    return close !== null && t !== null ? [{ t, p_usd: close, p_idr: close * USD_TO_IDR }] : [];
  }).sort((a, b) => a.t - b.t)).catch(() => [])
    .then((points) => {
      const result = points.length ? points : cached?.points ?? [];
      historyCache.set(symbol, { at: Date.now(), points: result });
      if (historyCache.size > 100) {
        const oldest = historyCache.keys().next().value;
        if (oldest !== undefined) historyCache.delete(oldest);
      }
      return result;
    }).finally(() => pendingHistory.delete(symbol));
  pendingHistory.set(symbol, work);
  return work;
}

function emaSeries(values: number[], period: number) {
  const series = [];
  const alpha = 2 / (period + 1);
  let average = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  series.push(average);
  for (const value of values.slice(period)) {
    average += (value - average) * alpha;
    series.push(average);
  }
  return series;
}

function recommendation(history: CryptoHistoricalPoint[], metadata: RawCryptoDef | undefined, index: CryptoFearGreed): CryptoRecommendation | null {
  if (history.length < 200 || Date.now() - history[history.length - 1].t > 3 * DAY) return null;
  const closes = history.map((point) => point.p_usd);
  const close = closes[closes.length - 1];
  const aboveEma20 = close >= emaSeries(closes, 20).at(-1)!;
  const aboveEma50 = close >= emaSeries(closes, 50).at(-1)!;
  const aboveEma200 = close >= emaSeries(closes, 200).at(-1)!;
  const slowEma = emaSeries(closes, 26);
  const fastEma = emaSeries(closes, 12).slice(14);
  const macd = slowEma.map((value, i) => fastEma[i] - value);
  const histogram = macd.at(-1)! - emaSeries(macd, 9).at(-1)!;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const move = closes[i] - closes[i - 1];
    if (i <= 14) {
      gain += Math.max(move, 0) / 14;
      loss += Math.max(-move, 0) / 14;
    } else {
      gain = (gain * 13 + Math.max(move, 0)) / 14;
      loss = (loss * 13 + Math.max(-move, 0)) / 14;
    }
  }
  const rsi = loss === 0 ? gain === 0 ? 50 : 100 : 100 - 100 / (1 + gain / loss);
  const changes = closes.slice(-30).map((value, i) => value / closes[closes.length - 31 + i] - 1);
  const average = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const volatility = Math.sqrt(changes.reduce((sum, value) => sum + (value - average) ** 2, 0) / changes.length) * 100;
  const maSignal = aboveEma20 && aboveEma50 ? "Bullish" : !aboveEma20 && !aboveEma50 ? "Bearish" : "Neutral";
  const macdSignal = histogram > 0 ? "Bullish" : histogram < 0 ? "Bearish" : "Neutral";
  const score = (aboveEma20 ? 20 : 0) + (aboveEma50 ? 25 : 0) + (aboveEma200 ? 25 : 0) + (histogram > 0 ? 20 : 0) + (rsi >= 50 ? 10 : 0);
  return {
    signal: score >= 85 ? "STRONG BUY" : score >= 65 ? "BUY" : score <= 15 ? "STRONG SELL" : score <= 35 ? "SELL" : "NEUTRAL",
    score,
    summary: "Skor tren dihitung dari penutupan harian Yahoo Finance. Sinyal merangkum tren teknikal dan tidak menyatakan peluang keuntungan.",
    indicators: {
      rsi14: { value: Number(rsi.toFixed(1)), status: rsi <= 30 ? "Oversold" : rsi >= 70 ? "Overbought" : "Neutral", signal: rsi <= 30 ? "Buy" : rsi >= 70 ? "Sell" : "Neutral" },
      macd: { signal: macdSignal, note: "MACD 12/26 dengan garis sinyal 9 hari." },
      maTrend: { signal: maSignal, aboveEma20, aboveEma50, aboveEma200 },
      volatility30d: { value: Number(volatility.toFixed(2)), status: volatility >= 5 ? "Tinggi" : volatility >= 2 ? "Sedang" : "Rendah" },
      fearGreed: index,
    },
    pros: metadata?.pros ?? [],
    risks: metadata?.risks ?? [],
  };
}

function historicalPrice(history: CryptoHistoricalPoint[], target: number) {
  const point = history.find((entry) => entry.t >= target);
  return point && point.t - target <= 3 * DAY ? point.p_usd : null;
}

export async function getCryptoMarketItem(symbol: string, force = false): Promise<CryptoItem | null> {
  const query = symbol.trim().toUpperCase();
  const clean = query.replace(/(?<=.)USDT$|-USD$/, "");
  const matches = (coin: Pick<RawCryptoDef, "symbol" | "name">) =>
    coin.symbol === query || coin.symbol === clean || coin.name.toUpperCase().replace(/\s+/g, "-") === query.replace(/\s+/g, "-");
  const { items } = await getCryptoUniverse(force);
  let item = items.find(matches);
  if (!item && /^[A-Z0-9]{1,20}$/.test(clean)) {
    const [spot] = await fetchSpot(clean);
    item = marketItem(clean, spot) ?? undefined;
  }
  return item ?? null;
}

export async function getCryptoDetail(symbol: string, force = false): Promise<CryptoDetailData | null> {
  const item = await getCryptoMarketItem(symbol, force);
  if (!item) return null;

  const [history, index] = await Promise.all([getHistory(item.symbol), getLiveFearAndGreed()]);
  const metadata = cryptoMetadata.get(item.symbol);
  const official = COIN_OFFICIAL_LINKS[item.symbol];
  const slug = official?.cmcSlug ?? item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cmc = "https://coinmarketcap.com/currencies/" + slug + "/";
  const latest = history.at(-1);
  const weekAgo = latest ? historicalPrice(history, latest.t - 7 * DAY) : null;
  const change7d = latest && weekAgo !== null && Date.now() - latest.t <= 3 * DAY ? (latest.p_usd / weekAgo - 1) * 100 : null;
  const returnSimulations = [
    ["1 Bulan Lalu", 30], ["6 Bulan Lalu", 182], ["1 Tahun Lalu", 365], ["2 Tahun Lalu", 730],
    ["3 Tahun Lalu", 1095], ["5 Tahun Lalu", 1826],
  ].map(([period, days]) => {
    const price = latest && Date.now() - latest.t <= 3 * DAY ? historicalPrice(history, latest.t - Number(days) * DAY) : null;
    return {
      period: String(period),
      initialPriceUsd: price ?? 0,
      initialPriceIdr: toIdr(price) ?? 0,
      roiPct: price !== null && latest ? (latest.p_usd / price - 1) * 100 : 0,
      isAvailable: price !== null,
      note: price === null ? "Riwayat tidak tersedia" : undefined,
    };
  });
  return {
    ...item,
    change_7d: change7d,
    sparkline: change7d === null ? [] : history.slice(-8).map((point) => point.p_usd),
    description: metadata?.description ?? item.name,
    consensus: metadata?.consensus ?? "Belum tersedia",
    website_url: official?.website ?? metadata?.website_url,
    whitepaper_url: official?.whitepaper ?? metadata?.whitepaper_url,
    explorer_url: official?.explorer ?? metadata?.explorer_url,
    github_url: official?.github ?? metadata?.github_url,
    cmc_url: cmc,
    milestones: metadata?.milestones ?? [],
    recommendation: recommendation(history, metadata, index),
    history,
    returnSimulations,
  };
}
