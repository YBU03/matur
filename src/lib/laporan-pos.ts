// Katalog Pusat Laporan (ala Luna): penjualan, pembelian, persediaan (outlet & gudang pusat), pendapatan/pengeluaran lain.
// Data dari RPC laporan_operasional(jenis, outlet|null=gudang, dari, sampai, mode, bahan).

export type Tab = "ikhtisar" | "penjualan" | "pembelian" | "produk" | "lain";
export const TABS: [Tab, string][] = [
  ["ikhtisar", "Ikhtisar Bisnis"],
  ["penjualan", "Penjualan"],
  ["pembelian", "Pembelian"],
  ["produk", "Produk & Persediaan"],
  ["lain", "Pendapatan & Pengeluaran Lain-Lain"],
];

export type TipeKolom = "teks" | "rp" | "angka" | "tgl" | "waktu" | "persen" | "label";
export type Kolom = { k: string; label: string; tipe?: TipeKolom; total?: boolean };
/** outlet = wajib pilih outlet; gudang = hanya gudang pusat; keduanya = outlet atau gudang pusat */
export type Lingkup = "outlet" | "gudang" | "keduanya";
export type Laporan = { tab: Tab; judul: string; info: string; lingkup: Lingkup; tanggal: "rentang" | "per" | "tidak"; bahan?: "wajib" | "opsional"; kartu?: boolean; grafik?: { x: string; y: string }; kolom: Kolom[] };

const rp = (k: string, label: string, total = true): Kolom => ({ k, label, tipe: "rp", total });
const n = (k: string, label: string, total = true): Kolom => ({ k, label, tipe: "angka", total });
const t = (k: string, label: string): Kolom => ({ k, label });
const lb = (k: string, label: string): Kolom => ({ k, label, tipe: "label" });

const RINGKAS: Kolom[] = [n("transaksi", "Transaksi"), n("item", "Item terjual"), rp("kotor", "Penjualan kotor"), rp("diskon", "Diskon"), rp("bersih", "Penjualan bersih"), rp("hpp", "HPP (resep)"), rp("laba_kotor", "Laba kotor"), rp("rata", "Rata-rata / transaksi"), n("void", "Transaksi void"), rp("nilai_void", "Nilai void"), rp("pengeluaran", "Pengeluaran outlet"), rp("laba_bersih_kas", "Perkiraan laba operasional")];

export const LAPORAN: Record<string, Laporan> = {
  ikhtisar: { tab: "ikhtisar", judul: "Ikhtisar Bisnis", info: "Ringkasan penjualan, HPP, laba kotor, void, dan pengeluaran outlet dalam periode.", lingkup: "outlet", tanggal: "rentang", kartu: true, kolom: RINGKAS },
  ringkasan: { tab: "penjualan", judul: "Ringkasan Penjualan", info: "Total transaksi, penjualan kotor/bersih, diskon, dan rata-rata per transaksi.", lingkup: "outlet", tanggal: "rentang", kartu: true, kolom: RINGKAS },
  harian: { tab: "penjualan", judul: "Ringkasan Penjualan Harian", info: "Penjualan per tanggal dalam periode.", lingkup: "outlet", tanggal: "rentang", grafik: { x: "tanggal", y: "bersih" }, kolom: [{ k: "tanggal", label: "Tanggal", tipe: "tgl" }, n("transaksi", "Transaksi"), rp("kotor", "Kotor"), rp("diskon", "Diskon"), rp("bersih", "Bersih"), rp("hpp", "HPP"), rp("laba_kotor", "Laba kotor"), rp("rata", "Rata-rata", false)] },
  transaksi: { tab: "penjualan", judul: "Penjualan", info: "Daftar semua transaksi beserta item, kasir, dan metode bayar.", lingkup: "outlet", tanggal: "rentang", kolom: [{ k: "waktu", label: "Waktu", tipe: "waktu" }, n("nomor", "No.", false), lb("kanal", "Kanal"), lb("tipe", "Tipe"), t("kasir", "Kasir"), t("pelanggan", "Pelanggan"), t("item", "Item"), rp("subtotal", "Subtotal"), rp("diskon", "Diskon"), rp("total", "Total"), lb("metode", "Bayar"), lb("status", "Status")] },
  produk: { tab: "penjualan", judul: "Penjualan per Produk", info: "Qty, omzet, HPP, dan laba tiap menu.", lingkup: "outlet", tanggal: "rentang", kolom: [t("menu", "Produk"), t("kategori", "Kategori"), n("qty", "Qty"), rp("kotor", "Penjualan"), rp("hpp", "HPP"), rp("laba", "Laba kotor")] },
  kategori: { tab: "penjualan", judul: "Penjualan per Kategori Produk", info: "Omzet per kategori menu.", lingkup: "outlet", tanggal: "rentang", grafik: { x: "kategori", y: "kotor" }, kolom: [t("kategori", "Kategori"), n("qty", "Qty"), rp("kotor", "Penjualan"), rp("hpp", "HPP"), rp("laba", "Laba kotor")] },
  tipe: { tab: "penjualan", judul: "Penjualan per Tipe Penjualan", info: "Langsung, GoFood, GrabFood, ShopeeFood, dst. serta dine-in / take away.", lingkup: "outlet", tanggal: "rentang", kolom: [lb("kanal", "Kanal"), lb("tipe", "Tipe"), n("transaksi", "Transaksi"), rp("kotor", "Kotor"), rp("diskon", "Diskon"), rp("bersih", "Bersih")] },
  metode: { tab: "penjualan", judul: "Penjualan per Metode Pembayaran", info: "Tunai, QRIS, debit, transfer.", lingkup: "outlet", tanggal: "rentang", grafik: { x: "metode", y: "nominal" }, kolom: [lb("metode", "Metode"), n("transaksi", "Transaksi"), rp("nominal", "Nominal")] },
  jam: { tab: "penjualan", judul: "Penjualan per Jam", info: "Jam ramai: jumlah transaksi & omzet per jam.", lingkup: "outlet", tanggal: "rentang", grafik: { x: "jam", y: "bersih" }, kolom: [{ k: "jam", label: "Jam", tipe: "teks" }, n("transaksi", "Transaksi"), rp("bersih", "Penjualan"), rp("rata", "Rata-rata", false)] },
  void: { tab: "penjualan", judul: "Penjualan yang Dibatalkan", info: "Transaksi void beserta alasan dan SPV yang menyetujui.", lingkup: "outlet", tanggal: "rentang", kolom: [{ k: "waktu", label: "Waktu", tipe: "waktu" }, n("nomor", "No.", false), t("kasir", "Kasir"), t("item", "Item"), rp("total", "Total"), t("alasan", "Alasan"), t("void_oleh", "Disetujui"), { k: "void_at", label: "Waktu void", tipe: "waktu" }] },
  stok_keluar: { tab: "penjualan", judul: "Stok Keluar dari Penjualan", info: "Bahan yang terpakai otomatis dari resep setiap penjualan.", lingkup: "outlet", tanggal: "rentang", kolom: [t("bahan", "Bahan"), t("kategori", "Kategori"), n("jumlah", "Jumlah", false), t("satuan", "Satuan"), rp("nilai", "Nilai")] },
  modifier: { tab: "penjualan", judul: "Penjualan Modifier", info: "Varian/tambahan yang dipilih pelanggan (ukuran, gula, es, topping).", lingkup: "outlet", tanggal: "rentang", kolom: [t("grup", "Grup"), t("varian", "Varian"), n("qty", "Qty"), rp("tambahan", "Tambahan harga")] },
  kasir: { tab: "penjualan", judul: "Kinerja Kasir", info: "Shift, transaksi, penjualan, void, dan selisih kas per kasir.", lingkup: "outlet", tanggal: "rentang", kolom: [t("kasir", "Kasir"), n("shift", "Shift"), n("transaksi", "Transaksi"), rp("bersih", "Penjualan"), n("void", "Void"), rp("selisih", "Selisih kas")] },

  pembelian: { tab: "pembelian", judul: "Pembelian", info: "Daftar pembelian ke supplier di gudang pusat.", lingkup: "gudang", tanggal: "rentang", kolom: [{ k: "tanggal", label: "Tanggal", tipe: "tgl" }, t("nomor", "Nomor"), t("supplier", "Supplier"), t("faktur", "No. faktur"), t("item", "Item"), lb("status", "Status"), rp("total", "Total")] },
  pembelian_bahan: { tab: "pembelian", judul: "Pembelian per Bahan", info: "Total qty dan harga rata-rata tiap bahan yang dibeli.", lingkup: "gudang", tanggal: "rentang", kolom: [t("bahan", "Bahan"), n("qty", "Qty", false), t("satuan", "Satuan"), rp("harga_rata", "Harga rata-rata", false), n("faktur", "Faktur"), rp("total", "Total")] },
  pembelian_supplier: { tab: "pembelian", judul: "Pembelian per Supplier", info: "Rekap belanja per supplier.", lingkup: "gudang", tanggal: "rentang", kolom: [t("supplier", "Supplier"), n("faktur", "Faktur"), rp("total", "Total")] },
  kiriman: { tab: "pembelian", judul: "Kiriman Gudang ke Outlet", info: "Bahan yang dikirim gudang pusat ke outlet beserta status penerimaan.", lingkup: "keduanya", tanggal: "rentang", kolom: [{ k: "tanggal", label: "Tanggal", tipe: "tgl" }, t("nomor", "Nomor"), t("outlet", "Outlet"), lb("status", "Status"), t("penerima", "Penerima"), n("item", "Jenis bahan"), rp("total", "Nilai")] },

  produk_menu: { tab: "produk", judul: "Produk", info: "Daftar menu dengan harga, HPP resep, dan margin.", lingkup: "keduanya", tanggal: "tidak", kolom: [t("menu", "Produk"), t("kategori", "Kategori"), rp("harga", "Harga", false), rp("harga_ojol", "Harga ojol", false), rp("hpp", "HPP", false), { k: "margin", label: "Margin", tipe: "persen" }, lb("aktif", "Aktif")] },
  persediaan: { tab: "produk", judul: "Persediaan", info: "Stok tiap bahan per tanggal tertentu beserta nilainya.", lingkup: "keduanya", tanggal: "per", kolom: [t("bahan", "Bahan"), t("kategori", "Kategori"), n("stok", "Stok", false), t("satuan", "Satuan"), n("stok_min", "Stok min.", false), rp("harga", "Harga/satuan", false), rp("nilai", "Nilai"), lb("status", "Status")] },
  mutasi_persediaan: { tab: "produk", judul: "Mutasi Persediaan", info: "Stok awal, masuk, pemakaian, waste, transfer, penyesuaian, dan stok akhir per bahan.", lingkup: "keduanya", tanggal: "rentang", kolom: [t("bahan", "Bahan"), t("satuan", "Satuan"), n("awal", "Awal", false), n("masuk", "Masuk", false), n("pemakaian", "Pemakaian", false), n("waste", "Waste", false), n("transfer", "Transfer keluar", false), n("penyesuaian", "Penyesuaian", false), n("akhir", "Akhir", false), rp("nilai_akhir", "Nilai akhir")] },
  stok_rendah: { tab: "produk", judul: "Produk Stok Rendah", info: "Bahan yang stoknya di bawah batas minimum per tanggal.", lingkup: "keduanya", tanggal: "per", kolom: [t("bahan", "Bahan"), t("kategori", "Kategori"), n("stok", "Stok", false), n("stok_min", "Stok min.", false), t("satuan", "Satuan"), lb("status", "Status")] },
  mutasi_barang: { tab: "produk", judul: "Mutasi Barang", info: "Log semua pergerakan stok: pembelian, kiriman, pemakaian, waste, opname, transfer.", lingkup: "keduanya", tanggal: "rentang", bahan: "opsional", kolom: [{ k: "waktu", label: "Waktu", tipe: "waktu" }, t("bahan", "Bahan"), lb("jenis", "Jenis"), n("masuk", "Masuk", false), n("keluar", "Keluar", false), t("satuan", "Satuan"), t("keterangan", "Keterangan"), t("oleh", "Oleh")] },
  kartu_stok: { tab: "produk", judul: "Kartu Stok", info: "Riwayat masuk/keluar satu bahan dengan saldo berjalan.", lingkup: "keduanya", tanggal: "rentang", bahan: "wajib", kolom: [{ k: "waktu", label: "Waktu", tipe: "waktu" }, lb("jenis", "Jenis"), t("keterangan", "Keterangan"), n("masuk", "Masuk"), n("keluar", "Keluar"), n("saldo", "Saldo", false), t("oleh", "Oleh")] },

  pengeluaran: { tab: "lain", judul: "Pengeluaran", info: "Semua pengeluaran outlet (dari laci & dibayar pusat).", lingkup: "outlet", tanggal: "rentang", kolom: [{ k: "tanggal", label: "Tanggal", tipe: "tgl" }, t("kategori", "Kategori"), t("keterangan", "Keterangan"), lb("sumber", "Sumber"), t("oleh", "Oleh"), rp("jumlah", "Jumlah")] },
  pengeluaran_kategori: { tab: "lain", judul: "Pengeluaran per Kategori", info: "Rekap pengeluaran per kategori biaya.", lingkup: "outlet", tanggal: "rentang", grafik: { x: "kategori", y: "jumlah" }, kolom: [t("kategori", "Kategori"), lb("grup", "Grup"), n("catatan", "Catatan"), rp("laci", "Dari laci"), rp("pusat", "Dibayar pusat"), rp("jumlah", "Total")] },
  pendapatan_lain: { tab: "lain", judul: "Penyesuaian Pendapatan", info: "Angka dashboard online food dan koreksi manual dari Catatan Harian.", lingkup: "outlet", tanggal: "rentang", kolom: [{ k: "tanggal", label: "Tanggal", tipe: "tgl" }, lb("kanal", "Kanal"), lb("jenis", "Jenis"), t("keterangan", "Keterangan"), t("oleh", "Oleh"), rp("jumlah", "Jumlah")] },
  marketing_produk: { tab: "lain", judul: "Produk Marketing / Endorse", info: "Produk yang diberikan untuk influencer, sampel, dan promo.", lingkup: "outlet", tanggal: "rentang", kolom: [{ k: "tanggal", label: "Tanggal", tipe: "tgl" }, lb("jenis", "Jenis"), t("penerima", "Penerima"), t("item", "Produk"), t("oleh", "Oleh"), rp("nilai_jual", "Nilai jual"), rp("hpp", "HPP")] },
};

export const LABEL: Record<string, string> = {
  langsung: "Langsung", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok", ruma_app: "Ruma App", tumbler: "Tumbler",
  dine_in: "Dine in", take_away: "Take away", tunai: "Tunai", qris: "QRIS", debit: "Debit", transfer: "Transfer",
  lunas: "Lunas", void: "Void", pemakaian: "Pemakaian", pembelian: "Pembelian", kiriman_masuk: "Kiriman masuk", kiriman_keluar: "Kiriman keluar",
  kiriman_batal: "Kiriman batal", opname: "Opname", koreksi: "Koreksi", waste: "Waste", transfer_keluar: "Transfer keluar", transfer_masuk: "Transfer masuk",
  marketing: "Marketing", saldo_awal: "Saldo awal", habis: "Habis", menipis: "Menipis", aman: "Aman", laci: "Laci", pusat: "Pusat",
  hpp: "HPP", beban: "Beban", lain: "Lain", platform: "Dashboard platform", endorse: "Barter endorse", endorse_fee: "Endorse + fee", sampel: "Sampel",
  promo: "Promo", lainnya: "Lainnya", true: "Ya", false: "Tidak", diterima: "Diterima", dikirim: "Dikirim", draft: "Draft", batal: "Batal", non_tunai: "Non tunai",
};

/** Tanggal (YYYY-MM-DD) zona WIB. */
export const tglWib = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const geser = (t: string, hari: number) => {
  const d = new Date(t + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
};

export const PRESET: [string, string][] = [
  ["hari_ini", "Hari ini"],
  ["kemarin", "Kemarin"],
  ["minggu_ini", "Minggu ini"],
  ["7_hari", "7 hari terakhir"],
  ["bulan_ini", "Bulan ini"],
  ["bulan_lalu", "Bulan lalu"],
  ["30_hari", "30 hari terakhir"],
];

/** Rentang tanggal untuk preset pemantauan harian / mingguan / bulanan. Minggu dimulai Senin. */
export function rentangPreset(preset: string, hariIni: string): [string, string] {
  const d = new Date(hariIni + "T00:00:00Z");
  switch (preset) {
    case "kemarin":
      return [geser(hariIni, -1), geser(hariIni, -1)];
    case "minggu_ini":
      return [geser(hariIni, -((d.getUTCDay() + 6) % 7)), hariIni];
    case "7_hari":
      return [geser(hariIni, -6), hariIni];
    case "30_hari":
      return [geser(hariIni, -29), hariIni];
    case "bulan_ini":
      return [hariIni.slice(0, 8) + "01", hariIni];
    case "bulan_lalu": {
      const awal = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const akhir = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      return [awal.toISOString().slice(0, 10), akhir.toISOString().slice(0, 10)];
    }
    default:
      return [hariIni, hariIni];
  }
}

/** Peran → tab yang boleh dilihat. Admin gudang: pembelian & persediaan. */
export function tabBoleh(peran: string): Tab[] {
  if (peran === "admin_gudang") return ["pembelian", "produk"];
  return TABS.map(([k]) => k);
}
export const PERAN_LAPORAN = ["owner", "admin_pusat", "finance", "spv", "admin_gudang", "manajer_area"];
export const PERAN_GUDANG = ["owner", "admin_pusat", "finance", "admin_gudang"];
