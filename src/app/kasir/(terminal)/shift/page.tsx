import Image from "next/image";

export default function ShiftPage() {
  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <Image src="/mascot/kasir.png" alt="" width={140} height={140} className="mx-auto rounded-3xl" />
      <h1 className="mt-4 text-2xl font-bold">🔒 Shift & Absensi</h1>
      <p className="mt-2 text-stone-500">Tutup shift, setoran kas, absensi, dan slip gaji akan dibuka di tahap berikutnya.</p>
    </div>
  );
}
