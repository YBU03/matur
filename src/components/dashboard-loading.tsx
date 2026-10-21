import Image from "next/image";

export function DashboardLoading({
  fullScreen = false,
  label = "Sedang menyiapkan dashboard…",
  mascot = "/mascot/kasir.png",
}: {
  fullScreen?: boolean;
  label?: string;
  mascot?: string;
}) {
  return (
    <div
      data-page-loading
      aria-busy="true"
      role="status"
      aria-live="polite"
      className={`${fullScreen ? "min-h-dvh" : "min-h-[60vh] rounded-3xl"} flex flex-col items-center justify-center bg-gradient-to-b from-matur-50 to-matur-100 px-6 py-10 text-center`}
    >
      <Image
        src={mascot}
        alt=""
        width={144}
        height={144}
        priority
        className="masuk-loading-mascot rounded-3xl"
      />
      <h1 className="mt-6 max-w-sm text-lg font-bold leading-relaxed text-kopi-900">
        {label}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-stone-600">
        Mohon tunggu sebentar sampai proses selesai.
      </p>
      <div
        aria-hidden="true"
        className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-matur-200"
      >
        <div className="masuk-loading-progress h-full w-1/3 rounded-full bg-matur-500" />
      </div>
    </div>
  );
}
