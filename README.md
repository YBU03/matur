# Matur

Sistem terintegrasi coffeeshop CV. Hazna Berkah Indonesia — POS, gudang, akunting,
dan portal mitra. Lihat [docs/ROADMAP.md](docs/ROADMAP.md) untuk tahapan.

## Menjalankan

```bash
npm install
npm run dev   # http://localhost:3000
```

Tahap 1 memakai akun demo (lihat panel "Akun demo" di halaman login). Atur
`SESSION_SECRET` di environment produksi.

## Struktur
- `src/lib/roles.ts` — peran, maskot, dan menu tiap dashboard
- `src/components/` — konfirmasi edit (AKS-05), hapus 2 tahap (AKS-06)
- `supabase/migrations/` — skema database + RLS
- `public/brand`, `public/mascot` — logo & maskot per peran
