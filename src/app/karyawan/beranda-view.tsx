import Link from "next/link";
import { CalendarDays, ClipboardList, Clock3, Coffee, LogIn, LogOut, Receipt, ScanFace, Timer } from "lucide-react";
import { Kartu, KartuAngka, KartuModul, KepalaKartu, Lencana, tombol } from "@/components/staf/ui";
import { formatDurasiPendek } from "@/lib/jadwal/rekap";

const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "–");
const tglPanjang = (t: string) => new Date(t + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

type ShiftRingkas = { nama: string; jam_mulai: string; jam_selesai: string };
export type BerandaProps = {
  sapaan: string;
  nama: string;
  outletNama: string;
  sUtama: ShiftRingkas | null;
  jumlahShiftHariIni: number;
  absenUtama: { status: string; telat_menit: number; masuk_at: string; pulang_at: string | null } | null;
  terbuka: boolean;
  totalMenit: number;
  tepat: number;
  telat: number;
  keempat: string;
  keempatLabel: string;
  kasir: boolean;
  tukarMasuk: number;
  berikut: ({ id: string; tanggal: string } & ShiftRingkas)[];
  labelPeriode?: string;
  tambahan?: React.ReactNode;
};

/** Tampilan beranda staf (tanpa akses data) — pola beranda host Makaryo. */
export function BerandaView({ sapaan, nama, outletNama, sUtama, jumlahShiftHariIni, absenUtama, terbuka, totalMenit, tepat, telat, keempat, keempatLabel, kasir, tukarMasuk, berikut, labelPeriode = "bulan ini", tambahan }: BerandaProps) {
  return (
    <>
      <header className="mb-5">
        <p className="text-[13px] font-medium text-redup">{sapaan},</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-kopi-900">{nama}!</h1>
        <p className="mt-1 text-[12px] font-semibold text-redup">{outletNama}</p>
      </header>

      <div className="mb-4 rounded-[var(--radius-kartu)] bg-gradient-to-br from-matur-500 via-matur-600 to-kopi-700 p-5 text-white shadow-[var(--shadow-melayang)] sm:p-6">
        <p className="text-[12px] font-semibold text-white/80">Shift kamu hari ini</p>
        {sUtama ? (
          <>
            <p className="mt-1 text-lg font-bold">{sUtama.nama}</p>
            <p className="tabular mt-0.5 text-[13px] text-white/85">
              {sUtama.jam_mulai} – {sUtama.jam_selesai} WIB
              {jumlahShiftHariIni > 1 && ` · +${jumlahShiftHariIni - 1} shift lain`}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-lg font-bold">Tidak ada shift hari ini</p>
            <p className="mt-1 text-[13px] text-white/85">Nikmati liburmu. Jadwal berikutnya ada di menu Jadwal.</p>
          </>
        )}
        {absenUtama && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2.5">
            <Lencana nada={absenUtama.status === "telat" ? "kuning" : absenUtama.status === "tepat" ? "hijau" : "netral"}>
              {absenUtama.status === "telat" ? `Telat ${absenUtama.telat_menit} mnt` : absenUtama.status === "tepat" ? "Tepat waktu" : "Tanpa jadwal"}
            </Lencana>
            <span className="tabular text-[12px] font-semibold text-white/90">
              Masuk {jam(absenUtama.masuk_at)}
              {absenUtama.pulang_at ? ` · pulang ${jam(absenUtama.pulang_at)}` : ""}
            </span>
          </div>
        )}
        {terbuka ? (
          <Link href="/karyawan/absen" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-kopi-900">
            <LogOut className="size-4" aria-hidden /> Absen pulang
          </Link>
        ) : (
          !absenUtama ? (
            <Link href="/karyawan/absen" className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold ${sUtama ? "bg-white text-matur-700" : "bg-white/20 text-white"}`}>
              <LogIn className="size-4" aria-hidden /> {sUtama ? "Absen masuk sekarang" : "Absen tanpa jadwal"}
            </Link>
          ) : null
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuAngka label={`Jam kerja ${labelPeriode}`} nilai={formatDurasiPendek(totalMenit)} ikon={Clock3} nada="oranye" />
        <KartuAngka label="Tepat waktu" nilai={tepat} ikon={ScanFace} nada="hijau" />
        <KartuAngka label="Telat" nilai={telat} ikon={Timer} nada="kuning" />
        <KartuAngka label={keempatLabel} nilai={keempat} ikon={CalendarDays} nada="kopi" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuModul href="/karyawan/absen" judul="Absen" keterangan="Masuk & pulang" ikon={ScanFace} nada="oranye" />
        <KartuModul href="/karyawan/jadwal" judul="Jadwal" keterangan="Lihat shift kamu" ikon={CalendarDays} nada="kopi" />
        <KartuModul href="/karyawan/izin" judul="Izin & Tukar" keterangan="Izin, libur & tukar shift" ikon={ClipboardList} nada="hijau" badge={tukarMasuk} />
        {kasir ? (
          <KartuModul href="/kasir/pos" judul="Buka POS" keterangan="Khusus tablet outlet" ikon={Receipt} nada="merah" />
        ) : (
          <KartuModul href="/karyawan/lainnya" judul="Lainnya" keterangan="Slip, setoran, stok" ikon={Coffee} nada="merah" />
        )}
      </div>

      {tambahan}

      <Kartu>
        <KepalaKartu judul="Shift berikutnya" aksi={<Link href="/karyawan/jadwal" className={tombol.lembut + " !min-h-9 !px-4 !py-1.5 text-xs"}>Kalender</Link>} />
        {berikut.length ? (
          <ul className="divide-y divide-garis">
            {berikut.map((j) => {
              return (
                <li key={j.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-semibold capitalize text-kopi-900">{tglPanjang(j.tanggal)}</span>
                  <span className="tabular text-right text-[13px] font-semibold text-redup">
                    {j.nama}
                    <br />
                    {j.jam_mulai} – {j.jam_selesai}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-redup">Belum ada jadwal terbit untuk 2 minggu ke depan.</p>
        )}
      </Kartu>
    </>
  );
}
