# Matoer

Sistem terintegrasi coffeeshop CV. Hazna Berkah Indonesia — POS, gudang, akunting,
dan portal mitra. Lihat [docs/ROADMAP.md](docs/ROADMAP.md) untuk tahapan dan [docs/PANDUAN-PROYEK.md](docs/PANDUAN-PROYEK.md) untuk panduan pemantauan pembangunan.

Produksi: https://matur-ybu.vercel.app (deploy otomatis setiap push).

## Menjalankan

```bash
npm install
npm run dev   # http://localhost:3000
```

Salin `.env.example` ke `.env.local` lalu isi `PIN_PEPPER` (rahasia login PIN,
harus sama dengan yang dipakai saat akun kasir/barista dibuat). Data awal ada di
`supabase/seed.sql`.

## Struktur
- `src/lib/roles.ts` — peran, maskot, dan menu tiap dashboard
- `src/components/` — konfirmasi edit (AKS-05), hapus 2 tahap (AKS-06)
- `supabase/migrations/` — skema database + RLS
- `public/brand`, `public/mascot` — logo & maskot per peran
