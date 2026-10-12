// Tampil seketika saat pindah menu, sementara data halaman dimuat
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Memuat">
      <div className="h-28 rounded-3xl bg-matur-100" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-matur-50" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-matur-50" />
    </div>
  );
}
