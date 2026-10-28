import { it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buatDokumenGudang } from "../gudang-dokumen";
import { validCetakGudang } from "../gudang-cetak-config";
import type { Kiriman, ItemKiriman } from "../kiriman";
const k: Kiriman = {
  id: "uji",
  nomor: "KRM-UJI-001",
  tanggal: "2026-10-27",
  status: "diterima",
  catatan:
    "Data contoh untuk pemeriksaan format. Barang dihitung dan diperiksa saat diterima.",
  pengirim: "Dimas - Pengiriman",
  total: 120000,
  dikirim_at: null,
  diterima_at: null,
  nama_penerima: "Rani - Outlet",
  pembuat_nama: "Sinta - Admin Gudang",
  pemeriksa_nama: "Budi - Pemeriksa Gudang",
  outlet: {
    nama: "Outlet Contoh Matoer",
    alamat: "Jalan Contoh No. 10, Purwokerto",
  },
};
const pt = {
  nama: "CV. Hazna Berkah Indonesia",
  alamat: "Alamat perusahaan contoh untuk uji cetak",
  email: null,
  telepon: null,
};
const items: ItemKiriman[] = Array.from({ length: 10 }, (_, n) => ({
  id: String(n),
  bahan_id: String(n),
  nama: [
    "Kopi Arabika kemasan 1 kg",
    "Susu kental manis pouch",
    "Cup minuman 16 oz",
    "Sedotan hitam kemasan",
  ][n % 4],
  satuan: "pack",
  konversi: 1,
  qty: n + 1,
  harga: 12000,
  qty_diterima: n + 1,
}));
it("renders four signature boxes, one NCR set and exactly three regular-paper sets", () => {
  const a = buatDokumenGudang("surat-jalan", k, items, pt, {
    lebar: 210,
    tinggi: 297,
    rangkap: "ncr",
  });
  const b = buatDokumenGudang("invoice", k, items, pt, {
    lebar: 241.3,
    tinggi: 139.7,
    rangkap: "ncr",
  });
  const c = buatDokumenGudang("invoice", k, items, pt, {
    lebar: 241.3,
    tinggi: 139.7,
    rangkap: "salinan",
  });
  for (const text of [
    "Dibuat oleh",
    "Diperiksa oleh",
    "Dikirim oleh",
    "Diterima oleh",
  ])
    expect(a.output()).toContain(text);
  expect(a.getNumberOfPages()).toBe(1);
  expect(c.getNumberOfPages()).toBe(b.getNumberOfPages() * 3);
  expect(c.output()).toContain("Arsip Gudang");
  expect(c.output()).toContain("Accounting");
  if (process.env.GUDANG_PDF_QA) {
    mkdirSync("work/gudang-pdf", { recursive: true });
    for (const [name, doc] of [
      ["surat-jalan-a4", a],
      ["invoice-continuous-3-salinan", c],
      [
        "surat-jalan-multipage",
        buatDokumenGudang(
          "surat-jalan",
          {
            ...k,
            catatan:
              "Catatan panjang untuk memastikan teks tidak terpotong. ".repeat(
                24,
              ),
          },
          [...items, ...items, ...items],
          pt,
          { lebar: 241.3, tinggi: 139.7, rangkap: "ncr" },
        ),
      ],
    ] as const)
      writeFileSync(
        `work/gudang-pdf/${name}.pdf`,
        new Uint8Array(doc.output("arraybuffer")),
      );
  }
});
it("rejects unreadable or invalid paper sizes", () => {
  expect(validCetakGudang({ lebar: 58, tinggi: 100, rangkap: "ncr" })).toBe(
    false,
  );
  expect(() =>
    buatDokumenGudang("invoice", k, items, pt, {
      lebar: 0,
      tinggi: 0,
      rangkap: "ncr",
    }),
  ).toThrow(/Ukuran/);
});

import { buatOpnamePDF, buatLabaPDF } from "../gudang-laporan-pdf";
import type { GudangLaporan } from "../gudang-laporan";
it("exports warehouse reports directly as PDF without the receipt-only browser print stylesheet", () => {
  const d = {
    id: "contoh",
    tanggal: "2026-10-27",
    status: "final",
    versi: 1,
    catatan: "Selisih hasil hitung fisik.",
    nama_petugas: "Petugas Gudang Uji",
    created_at: "2026-10-27",
    final_at: "2026-10-27",
  };
  const rows = [
    {
      bahan_id: "1",
      nama: "Kopi kemasan",
      satuan: "g",
      sistem: 1000,
      fisik: 980,
      hpp: 100,
      alasan: "Selisih fisik",
    },
    {
      bahan_id: "2",
      nama: "Cup",
      satuan: "pcs",
      sistem: 200,
      fisik: null,
      hpp: 500,
      alasan: "",
    },
  ];
  const a = buatOpnamePDF(d, rows);
  const r: GudangLaporan = {
    rows: [
      {
        id: "1",
        nomor: "KRM-UJI-001",
        outlet_id: "1",
        outlet: "Outlet Contoh",
        kepemilikan: "Pusat",
        waktu: "2026-10-27T02:00:00Z",
        bahan_id: "1",
        nama: "Kopi kemasan",
        harga: 150000,
        hpp_gudang: 100000,
        qty: 2,
      },
    ],
    biaya: [
      {
        id: "1",
        tanggal: "2026-10-27",
        jumlah: 10000,
        keterangan: "Ongkos kirim",
        outlet_id: null,
      },
    ],
    mutasi: [],
  };
  const b = buatLabaPDF(r, "2026-10-01", "2026-10-27", "Semua outlet");
  expect(a.output()).toContain("Belum dihitung");
  expect(b.output()).toContain("HPP diketahui");
  if (process.env.GUDANG_PDF_QA) {
    mkdirSync("work/gudang-pdf", { recursive: true });
    writeFileSync(
      "work/gudang-pdf/opname-gudang.pdf",
      new Uint8Array(a.output("arraybuffer")),
    );
    writeFileSync(
      "work/gudang-pdf/laba-rugi-gudang.pdf",
      new Uint8Array(b.output("arraybuffer")),
    );
  }
});

it("prints the Hazna sales invoice without service charge or invented payment data", () => {
  const png = readFileSync("public/brand/hazna-logo.png");
  const logo = {
    url: "data:image/png;base64," + png.toString("base64"),
    w: png.readUInt32BE(16),
    h: png.readUInt32BE(20),
  };
  const goods = items.slice(0, 6).map((i, n) => ({
    ...i,
    harga: 12000 + n * 1000,
    qty: 2,
    qty_diterima: 1,
  }));
  const formats = [
    ["invoice-hazna-a4", 210, 297],
    ["invoice-hazna-continuous", 241.3, 139.7],
    ["invoice-hazna-minimum", 180, 130],
  ] as const;
  for (const [name, lebar, tinggi] of formats) {
    const doc = buatDokumenGudang(
      "invoice",
      k,
      goods,
      pt,
      { lebar, tinggi, rangkap: "ncr" },
      logo,
    );
    const pdf = doc.output();
    for (const label of [
      "INVOICE PENJUALAN",
      "SKU",
      "Diskon",
      "Pajak",
      "Pembayaran",
      "SISA TAGIHAN",
      "Belum direkonsiliasi",
      "Rp 87.000",
    ])
      expect(pdf).toContain(label);
    expect(pdf).toContain("/Subtype /Image");
    expect(pdf).not.toMatch(/service charge/i);
    expect(pdf).not.toContain("Rp 174.000");
    if (process.env.GUDANG_PDF_QA) {
      mkdirSync("work/gudang-pdf", { recursive: true });
      writeFileSync(
        "work/gudang-pdf/" + name + ".pdf",
        new Uint8Array(doc.output("arraybuffer")),
      );
    }
  }
});

it("prints saved address, custom logo and signed invoice adjustment", () => {
  const png = readFileSync("public/brand/hazna-logo.png");
  const logo = {
    url: "data:image/png;base64," + png.toString("base64"),
    w: png.readUInt32BE(16),
    h: png.readUInt32BE(20),
  };
  const alamat =
    "Jl. Raya Pengalusan No.6, Kompas, Pengalusan, Kec. Mrebet, Kabupaten Purbalingga, Jawa Tengah 53352";
  const company = { ...pt, alamat };
  const kiriman = {
    ...k,
    pemeriksaan_status: "selesai",
    penyesuaian: {
      nilai: -750,
      keterangan: "Pembulatan sesuai kesepakatan",
      versi: 1,
    },
  } as Kiriman;
  const docs = [
    [
      "invoice-pengaturan-alamat",
      buatDokumenGudang(
        "invoice",
        kiriman,
        items.slice(0, 3),
        company,
        { lebar: 210, tinggi: 297, rangkap: "ncr" },
        logo,
      ),
    ],
    [
      "surat-jalan-pengaturan-alamat",
      buatDokumenGudang(
        "surat-jalan",
        kiriman,
        items.slice(0, 3),
        company,
        { lebar: 210, tinggi: 297, rangkap: "ncr" },
        logo,
      ),
    ],
    [
      "invoice-pengaturan-continuous",
      buatDokumenGudang(
        "invoice",
        kiriman,
        items.slice(0, 3),
        company,
        { lebar: 241.3, tinggi: 139.7, rangkap: "ncr" },
        logo,
      ),
    ],
  ] as const;
  for (const [name, doc] of docs) {
    expect(doc.output()).toContain("53352");
    expect(doc.output()).toContain("/Subtype /Image");
    if (name.startsWith("invoice")) {
      expect(doc.output()).toContain("Penyesuaian");
      expect(doc.output()).toContain("- Rp 750");
      expect(doc.output()).toContain("Rp 71.250");
    }
    if (process.env.GUDANG_PDF_QA) {
      mkdirSync("work/gudang-pdf", { recursive: true });
      writeFileSync(
        "work/gudang-pdf/" + name + ".pdf",
        new Uint8Array(doc.output("arraybuffer")),
      );
    }
  }
});

it("prints fully editable signature boxes: custom titles, blank names and custom dates", () => {
  const doc = buatDokumenGudang(
    "invoice",
    k,
    items.slice(0, 3),
    { ...pt, judul_ttd: ["Hormat kami", "Mengetahui", "Kurir", "Penerima"] },
    { lebar: 210, tinggi: 297, rangkap: "ncr" },
    undefined,
    [
      {
        judul: "Hormat kami",
        nama: "Ayu Finance",
        tanggal: "Tanggal: 27-10-2026",
      },
      { judul: "Mengetahui", nama: "", tanggal: "" },
      { judul: "", nama: "", tanggal: "Tanggal: ................" },
      { judul: "Penerima", nama: "", tanggal: "" },
    ],
  );
  const pdf = doc.output();
  for (const t of [
    "Hormat kami",
    "Mengetahui",
    "Ayu Finance",
    "Tanggal: 27-10-2026",
  ])
    expect(pdf).toContain(t);
  for (const t of ["Dibuat oleh", "Sinta - Admin Gudang"])
    expect(pdf).not.toContain(t);
  // tanpa isian khusus: judul dari pengaturan, nama dari data kiriman
  const awal = buatDokumenGudang(
    "surat-jalan",
    k,
    items.slice(0, 3),
    { ...pt, judul_ttd: ["Hormat kami", "", "Kurir", "Penerima"] },
    { lebar: 210, tinggi: 297, rangkap: "ncr" },
  ).output();
  expect(awal).toContain("Hormat kami");
  expect(awal).toContain("Sinta - Admin Gudang");
  expect(awal).not.toContain("Diperiksa oleh");
});
it("prints editable due date, distinct billing, warehouse/outlet phones, and tax before amount", () => {
  const png = readFileSync("public/brand/hazna-logo.png");
  const logo = {
    url: "data:image/png;base64," + png.toString("base64"),
    w: png.readUInt32BE(16),
    h: png.readUInt32BE(20),
  };
  const goods = items.slice(0, 3);
  const isi = {
    jatuh_tempo: "2026-11-10",
    catatan: "Catatan versi baru",
    telepon_gudang: "62 856-9786-5737",
    tagih_mode: "manual" as const,
    tagih_outlet: null,
    baris: Object.fromEntries(
      goods.map((i) => [i.id, { diskon: 1000, pajak: 500 }]),
    ),
    item_basis: Object.fromEntries(
      goods.map((i) => [i.id, { qty: Number(i.qty_diterima), harga: i.harga }]),
    ),
    identitas: {
      perusahaan: {
        ...pt,
        alamat:
          "Jl. Raya Pengalusan No.6, Kompas, Pengalusan, Kec. Mrebet, Kabupaten Purbalingga, Jawa Tengah 53352",
        telepon: "62 856-9786-5737",
        logo_path: null,
      },
      kirim: {
        nama: "Outlet kirim",
        alamat: "Alamat outlet kirim",
        telepon: "628111111",
      },
      tagih: {
        nama: "Outlet tagihan manual",
        alamat: "Alamat penagihan",
        telepon: "628222222",
      },
    },
  };
  const edited = {
    ...k,
    dokumen: [
      { jenis: "invoice" as const, isi, terbit: isi, versi: 1, arsip_at: null },
    ],
  };
  const invoice = buatDokumenGudang(
      "invoice",
      edited,
      goods,
      pt,
      { lebar: 210, tinggi: 297, rangkap: "ncr" },
      logo,
    ),
    text = invoice.output();
  for (const label of [
    "10/11/2026",
    "628111111",
    "628222222",
    "62 856-9786-5737",
    "Catatan versi baru",
    "Outlet tagihan manual",
    "Rp 70.500",
  ])
    expect(text).toContain(label);
  expect(text.indexOf("(Pajak)")).toBeLessThan(text.indexOf("(Jumlah)"));
  const surat = buatDokumenGudang(
    "surat-jalan",
    { ...edited, dokumen: [{ ...edited.dokumen[0], jenis: "surat-jalan" }] },
    goods,
    pt,
    { lebar: 210, tinggi: 297, rangkap: "ncr" },
    logo,
  );
  expect(surat.output()).toContain("628111111");
  if (process.env.GUDANG_PDF_QA) {
    mkdirSync("work/gudang-pdf", { recursive: true });
    writeFileSync(
      "work/gudang-pdf/invoice-editor-lengkap.pdf",
      new Uint8Array(invoice.output("arraybuffer")),
    );
    writeFileSync(
      "work/gudang-pdf/surat-jalan-editor-lengkap.pdf",
      new Uint8Array(surat.output("arraybuffer")),
    );
  }
});
