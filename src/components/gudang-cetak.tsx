"use client";
import { useEffect, useState } from "react";
import {
  cetakGudangDefault,
  validCetakGudang,
  type CetakGudang,
} from "@/lib/gudang-cetak-config";
export function useCetakGudang() {
  const [opsi, setOpsi] = useState<CetakGudang>(cetakGudangDefault);
  useEffect(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("matoer-cetak-gudang") ?? "null",
      );
      if (v && validCetakGudang(v)) setOpsi(v);
    } catch {}
  }, []);
  const simpan = (o: CetakGudang) => {
    setOpsi(o);
    try {
      localStorage.setItem("matoer-cetak-gudang", JSON.stringify(o));
    } catch {}
  };
  return [opsi, simpan] as const;
}
export function PengaturanCetakGudang({
  opsi,
  onChange,
}: {
  opsi: CetakGudang;
  onChange: (o: CetakGudang) => void;
}) {
  return (
    <details className="my-3 rounded-xl border bg-white p-3 text-sm">
      <summary className="cursor-pointer font-semibold">
        Pengaturan cetak 3 rangkap
      </summary>
      <div className="mt-3 flex flex-wrap gap-3">
        <label>
          Preset
          <select
            className="mt-1 block rounded-lg border p-2"
            value={
              [
                ["a4", 210, 297],
                ["full", 241.3, 279.4],
                ["half", 241.3, 139.7],
              ].find(
                ([, w, h]) => w === opsi.lebar && h === opsi.tinggi,
              )?.[0] ?? "custom"
            }
            onChange={(e) => {
              const wh =
                e.target.value === "full"
                  ? [241.3, 279.4]
                  : e.target.value === "half"
                    ? [241.3, 139.7]
                    : e.target.value === "a4"
                      ? [210, 297]
                      : [opsi.lebar, opsi.tinggi];
              onChange({ ...opsi, lebar: wh[0], tinggi: wh[1] });
            }}
          >
            <option value="a4">A4 (210 × 297 mm)</option>
            <option value="full">Continuous 9,5 × 11 inci</option>
            <option value="half">Continuous 9,5 × 5,5 inci</option>
            <option value="custom">Ukuran sendiri</option>
          </select>
        </label>
        <label>
          Lebar mm
          <input
            type="number"
            min="180"
            max="330"
            step="0.1"
            value={opsi.lebar}
            onChange={(e) =>
              onChange({ ...opsi, lebar: Number(e.target.value) })
            }
            className="mt-1 block w-24 rounded-lg border p-2"
          />
        </label>
        <label>
          Tinggi mm
          <input
            type="number"
            min="130"
            max="420"
            step="0.1"
            value={opsi.tinggi}
            onChange={(e) =>
              onChange({ ...opsi, tinggi: Number(e.target.value) })
            }
            className="mt-1 block w-24 rounded-lg border p-2"
          />
        </label>
        <label>
          Jenis rangkap
          <select
            value={opsi.rangkap}
            onChange={(e) =>
              onChange({
                ...opsi,
                rangkap: e.target.value as CetakGudang["rangkap"],
              })
            }
            className="mt-1 block rounded-lg border p-2"
          >
            <option value="ncr">NCR 3 lapis: satu set cetak</option>
            <option value="salinan">Kertas biasa: tiga salinan</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-stone-600">
        Cocokkan ukuran kertas dan skala 100% / ukuran asli di pengaturan
        printer. PDF NCR berisi satu set; jangan memilih 3 copies lagi. Kertas
        biasa sudah menghasilkan 3 set berlabel. Setelan disimpan pada browser
        ini. Ukuran continuous perlu diuji sesuai printer dan area perforasinya.
      </p>
      {!validCetakGudang(opsi) && (
        <p role="alert" className="mt-2 text-red-700">
          Lebar harus 180–330 mm dan tinggi 130–420 mm.
        </p>
      )}
    </details>
  );
}
