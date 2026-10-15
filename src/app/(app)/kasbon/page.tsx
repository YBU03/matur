import { konteksOperasional } from "@/lib/operasional-data";
import { KasbonView } from "./view";
export default async function Kasbon({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const { s, db, outlet, outlets } = await konteksOperasional(
    "kasbon",
    (await searchParams).outlet,
  );
  const [k, penugasan] = await Promise.all([
    db
      .from("kasbon_staf")
      .select(
        "*,pengguna:pengguna!kasbon_staf_pengguna_id_fkey(nama),kasbon_potongan(jumlah,slip_gaji(penggajian(status,periode)))",
      )
      .eq("outlet_id", outlet.id)
      .order("tanggal", { ascending: false }),
    db
      .from("penugasan")
      .select("pengguna:pengguna_id(id,nama)")
      .eq("outlet_id", outlet.id),
  ]);
  if (k.error || penugasan.error) throw new Error("Data kasbon gagal dimuat.");
  const staf = [
    ...new Map(
      (penugasan.data ?? []).map((p) => {
        const u = p.pengguna as unknown as { id: string; nama: string };
        return [u.id, u] as const;
      }),
    ).values(),
  ];
  const rows = (k.data ?? []).map((x) => {
    const q = x.kasbon_potongan as unknown as {
      jumlah: number;
      slip_gaji: { penggajian: { status: string; periode: string } };
    }[];
    const paid = q
      .filter((y) => y.slip_gaji.penggajian.status === "final")
      .reduce((n, y) => n + Number(y.jumlah), 0);
    return {
      id: x.id,
      nama: (x.pengguna as unknown as { nama: string }).nama,
      tanggal: x.tanggal,
      jumlah: Number(x.jumlah),
      cicilan: Number(x.cicilan),
      catatan: x.catatan,
      terbayar: paid,
      draft: q
        .filter((y) => y.slip_gaji.penggajian.status !== "final")
        .reduce((n, y) => n + Number(y.jumlah), 0),
    };
  });
  return (
    <KasbonView
      key={outlet.id}
      outlet={outlet}
      outlets={outlets}
      staf={staf}
      rows={rows}
      boleh={["owner", "hrd"].includes(s.active!.role)}
    />
  );
}
