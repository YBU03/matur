import { MessageCircle, Phone, Headset } from "lucide-react";
import {
  tautanSupport,
  tampilNomorSupport,
  type KontakSupport,
} from "@/lib/support-outlet";

export function SupportOutletCards({ rows }: { rows: KontakSupport[] }) {
  if (!rows.length)
    return (
      <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-stone-500">
        Belum ada kontak support yang aktif.
      </p>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((k) => {
        const link = tautanSupport(k.nomor);
        return (
          <article
            key={k.id}
            className="flex flex-col rounded-2xl border border-matur-100 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-matur-50 text-matur-700">
                <Headset size={22} aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-kopi-900">{k.bagian}</h2>
            </div>
            <p className="mb-1 text-sm text-stone-500">Petugas</p>
            <p className="font-semibold text-kopi-800">{k.nama}</p>
            {link && (
              <>
                <a
                  href={link.wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp ${k.bagian}, ${k.nama}, ${tampilNomorSupport(k.nomor)}`}
                  className="mb-5 mt-2 w-fit break-all rounded text-lg font-bold text-emerald-700 underline decoration-emerald-200 underline-offset-4 focus-visible:outline-2"
                >
                  {tampilNomorSupport(k.nomor)}
                </a>
                <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                  <a
                    href={link.wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Chat WhatsApp ${k.bagian}`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    Chat WhatsApp
                  </a>
                  <a
                    href={link.telepon}
                    aria-label={`Telepon ${k.bagian}`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold hover:bg-stone-50"
                  >
                    <Phone size={17} aria-hidden="true" />
                    Telepon
                  </a>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
