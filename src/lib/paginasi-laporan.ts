/** Read the entire authorized result or fail; exports must never silently use the API row cap. */
export async function semuaHalaman<T>(
  baca: (
    dari: number,
    sampai: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ukuran = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let awal = 0; ; awal += ukuran) {
    const r = await baca(awal, awal + ukuran - 1);
    if (r.error) throw new Error(r.error.message);
    if (!Array.isArray(r.data))
      throw new Error("Data laporan belum dapat dimuat lengkap");
    rows.push(...(r.data as T[]));
    if (r.data.length < ukuran) return rows;
  }
}
