import { supabaseServer } from "@/lib/supabase/server";
import { rentang, type Ringkasan } from "../dashboard/sales";
import { rentangTanggal } from "@/lib/promo-tampilan";
import { KomparasiFilter } from "./komparasi-filter";
import { KomparasiView } from "./komparasi-view";

type Outlet = { id: string; nama: string };

/** Tab Komparasi: antar outlet (periode sama) atau antar periode (outlet sama). Hanya baca ringkasan_penjualan. */
export async function Komparasi({ outlets, sp, mode }: { outlets: Outlet[]; sp: Record<string, string | undefined>; mode: "asli" | "simulasi" }) {
  const jenis: "outlet" | "periode" = sp.km === "periode" ? "periode" : "outlet";
  const ada = (id?: string) => outlets.some((o) => o.id === id);
  const nama = (id: string) => outlets.find((o) => o.id === id)?.nama ?? "Outlet";
  if (outlets.length === 0)
    return <p className="rounded-xl border border-matur-200 bg-matur-50 p-4 text-sm">Belum ada outlet aktif yang ditampilkan di Dashboard POS.</p>;

  const a = ada(sp.a) ? sp.a! : outlets[0].id;
  const b = jenis === "outlet" ? (ada(sp.b) && sp.b !== a ? sp.b! : outlets.find((o) => o.id !== a)?.id ?? a) : a;
  const pA = sp.p ?? "bulan";
  const rA = rentang(pA, sp.pd, sp.ps);
  const pB = sp.pb ?? "sebelumnya";
  const rB =
    jenis === "outlet"
      ? rA
      : pB === "sebelumnya"
        ? rentang("kustom", rA.prevDari, rA.prevSampai)
        : rentang(pB, sp.pbd, sp.pbs);

  const db = await supabaseServer();
  const ambil = async (outlet: string, dari: string, sampai: string) => {
    const { data, error } = await db.rpc("ringkasan_penjualan", { p_outlet: outlet, p_dari: dari, p_sampai: sampai, p_mode: mode });
    return { data: (data as Ringkasan | null) ?? null, error: !!error };
  };
  const [dA, dB, prevA, prevB] = await Promise.all([
    ambil(a, rA.dari, rA.sampai),
    ambil(b, rB.dari, rB.sampai),
    ambil(a, rA.prevDari, rA.prevSampai),
    ambil(b, rB.prevDari, rB.prevSampai),
  ]);
  const label = (r: { dari: string; sampai: string }) => rentangTanggal(r.dari, r.sampai);
  const sisiA = jenis === "outlet" ? { judul: nama(a), sub: label(rA) } : { judul: label(rA), sub: nama(a) };
  const sisiB = jenis === "outlet" ? { judul: nama(b), sub: label(rB) } : { judul: label(rB), sub: nama(a) };

  return (
    <div className="space-y-4">
      <KomparasiFilter outlets={outlets} jenis={jenis} a={a} b={b} p={pA} pd={sp.pd} ps={sp.ps} pb={pB} pbd={sp.pbd} pbs={sp.pbs} />
      {a === b && jenis === "outlet" ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Hanya ada satu outlet aktif. Gunakan mode <b>Antar periode</b> untuk membandingkan outlet yang sama di dua periode.</p>
      ) : (
        <KomparasiView
          jenis={jenis}
          sisiA={sisiA}
          sisiB={sisiB}
          dA={dA.data}
          dB={dB.data}
          prevA={prevA.data}
          prevB={prevB.data}
          rA={{ dari: rA.dari, sampai: rA.sampai, hari: rA.hari }}
          rB={{ dari: rB.dari, sampai: rB.sampai, hari: rB.hari }}
          error={dA.error || dB.error}
          simulasi={mode === "simulasi"}
        />
      )}
    </div>
  );
}
