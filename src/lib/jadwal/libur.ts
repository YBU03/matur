import { eachDate, weekStart } from "./waktu";

export type RestPlanHost = {
  id: string;
  weeklyDayOffQuota: number;
};

export type RestPlanInput = {
  startDate: string;
  endDate: string;
  hosts: RestPlanHost[];
  /** Tanggal izin/libur yang sudah disetujui admin, sebagai `hostId|tanggal`. */
  approvedLeaveKeys?: Set<string>;
};

export type RestPlan = {
  /** Kunci `hostId|tanggal` untuk hari libur yang direncanakan. */
  keys: Set<string>;
  /** Jumlah host yang libur pada tiap tanggal, untuk pemeriksaan penyebaran. */
  perDate: Record<string, number>;
};

/** Minggu yang terlalu pendek di tepi periode dilewati; liburnya diatur bulan sebelah. */
const MIN_DAYS_PER_WEEK = 4;

/**
 * Menentukan hari libur tiap host, satu minggu sekali, dan menyebarkannya
 * merata ke seluruh hari dalam minggu itu.
 *
 * Tanpa perencanaan ini, hari libur hanya muncul sebagai sisa dari pengisian
 * shift, sehingga gampang menumpuk di hari yang berdekatan — misalnya Senin
 * satu orang libur, lalu Selasa dan Rabu dua orang lagi. Di sini tiap giliran
 * libur selalu jatuh pada hari yang paling sedikit peliburnya, dan titik
 * mulainya berputar tiap minggu supaya host tidak selalu kebagian hari yang sama.
 */
export function planRestDays({
  startDate,
  endDate,
  hosts,
  approvedLeaveKeys = new Set<string>(),
}: RestPlanInput): RestPlan {
  const keys = new Set<string>();
  const perDate: Record<string, number> = {};

  const dates = eachDate(startDate, endDate);
  dates.forEach((date) => (perDate[date] = 0));

  // Kelompokkan tanggal per minggu, dengan urutan minggu yang tetap.
  const weeks = new Map<string, string[]>();
  for (const date of dates) {
    const week = weekStart(date);
    const list = weeks.get(week) ?? [];
    list.push(date);
    weeks.set(week, list);
  }

  const sortedHosts = [...hosts].sort((a, b) => a.id.localeCompare(b.id));
  const weekKeys = [...weeks.keys()].sort();

  weekKeys.forEach((week, weekIndex) => {
    const weekDates = weeks.get(week) ?? [];
    if (weekDates.length < MIN_DAYS_PER_WEEK) return;

    sortedHosts.forEach((host, hostIndex) => {
      const quota = Math.max(0, Math.min(weekDates.length - 1, host.weeklyDayOffQuota));
      if (quota === 0) return;

      // Izin yang sudah disetujui langsung dihitung sebagai jatah liburnya.
      const approved = weekDates.filter((date) => approvedLeaveKeys.has(`${host.id}|${date}`));
      approved.forEach((date) => {
        keys.add(`${host.id}|${date}`);
        perDate[date] += 1;
      });

      let remaining = quota - approved.length;
      if (remaining <= 0) return;

      // Titik mulai berputar tiap minggu agar giliran hari liburnya bergeser.
      const offset = (weekIndex + hostIndex) % weekDates.length;
      const rotated = [...weekDates.slice(offset), ...weekDates.slice(0, offset)];

      while (remaining > 0) {
        const pilihan = rotated
          .filter((date) => !keys.has(`${host.id}|${date}`))
          .sort((a, b) => perDate[a] - perDate[b] || rotated.indexOf(a) - rotated.indexOf(b))[0];

        if (!pilihan) break;

        keys.add(`${host.id}|${pilihan}`);
        perDate[pilihan] += 1;
        remaining -= 1;
      }
    });
  });

  return { keys, perDate };
}
