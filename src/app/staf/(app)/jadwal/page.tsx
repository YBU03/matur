import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { JudulHalaman } from "@/components/staf/ui";
import { currentMonth, monthLabel, monthRange, shiftMonth } from "@/lib/jadwal/waktu";
import { muatIzin, muatJadwal, muatShift, muatStaf } from "@/lib/sdm";
import { sesiStaf } from "@/lib/staf";
import { KalenderStaf } from "./kalender-staf";

// Kalender bulanan jadwal terbit (pola halaman jadwal host Makaryo): ketuk tanggal untuk melihat siapa saja yang bertugas.
export default async function JadwalStaf({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const { s, outlet } = await sesiStaf();
  const sp = await searchParams;
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : currentMonth();
  const { start, end } = monthRange(bulan);
  const [shifts, staf, jadwal, izin] = await Promise.all([
    muatShift(outlet),
    muatStaf(outlet),
    muatJadwal(outlet, start, end),
    muatIzin(outlet, start, end, { penggunaId: s.userId, status: ["menunggu", "disetujui"] }),
  ]);
  const nav = "grid size-10 place-items-center rounded-full border border-garis bg-white hover:bg-matur-50";
  return (
    <>
      <JudulHalaman
        judul="Jadwal"
        keterangan="Shift yang sudah diterbitkan HRD/SPV."
        aksi={
          <div className="flex items-center gap-2">
            <Link href={`/staf/jadwal?bulan=${shiftMonth(bulan, -1)}`} className={nav} aria-label="Bulan sebelumnya">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-28 text-center text-sm font-bold capitalize text-kopi-900">{monthLabel(bulan)}</span>
            <Link href={`/staf/jadwal?bulan=${shiftMonth(bulan, 1)}`} className={nav} aria-label="Bulan berikutnya">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        }
      />
      <KalenderStaf
        bulan={bulan}
        saya={s.userId}
        shifts={shifts}
        nama={Object.fromEntries(staf.map((x) => [x.id, x.nama]))}
        jadwal={jadwal.filter((j) => j.status === "terbit")}
        izin={izin}
      />
    </>
  );
}
