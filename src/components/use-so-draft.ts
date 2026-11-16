"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cadangkanSo, daftarDraftSo } from "@/lib/so-draft-actions";
import { bacaSoDraft, hariSo, type SoDraft } from "@/lib/so-draft";
export function useSoDraft(key: string, outletId: string, scope: string, sistem: Record<string, number>) {
  const seed = useRef(sistem); seed.current = sistem;
  const fresh = useCallback((tanggal = hariSo()): SoDraft => ({ version: 2, id: crypto.randomUUID(), outletId, tanggal, scope, isi: {}, sistem: { ...seed.current }, catatan: "", jenis: "rutin", updatedAt: Date.now() }), [outletId, scope]);
  const [draft, setDraft] = useState<SoDraft | null>(null);
  const [archives, setArchives] = useState<SoDraft[]>([]);
  const [status, setStatus] = useState("");
  const latest = useRef<SoDraft | null>(null);
  const localOkay = useRef(true);
  const remember = useCallback((d: SoDraft) => {
    try {
      const raw = JSON.parse(localStorage.getItem(`${key}:archives`) ?? "{}");
      raw[d.id] = d;
      localStorage.setItem(`${key}:archives`, JSON.stringify(raw));
      localStorage.setItem(`${key}:active`, d.id);
      localOkay.current = true;
      setStatus(d.completedId ? `Arsip SO final. Nomor bukti: ${d.completedId}.` : "Draft tersimpan di perangkat; menunggu cadangan server.");
    } catch {
      localOkay.current = false;
      setStatus("Draft perangkat gagal disimpan. Tetap buka halaman ini; coba unduh cadangan.");
    }
    setArchives(old => [...old.filter(x => x.id !== d.id), d].sort((a,b) => b.updatedAt-a.updatedAt));
  }, [key]);
  useEffect(() => {
    let live = true;
    let local: SoDraft[] = [];
    let selected: SoDraft | null = null;
    try {
      local = Object.values(JSON.parse(localStorage.getItem(`${key}:archives`) ?? "{}")).map(x => bacaSoDraft(x, outletId)).filter((x): x is SoDraft => !!x);
      selected = local.find(x => x.id === localStorage.getItem(`${key}:active`) && !x.completedId) ?? null;
      // Salin draft versi lama tanpa menghapus bukti aslinya.
      if (!local.length) {
        const old = JSON.parse(localStorage.getItem(key) ?? "null");
        if (old?.version === 1 && old.outletId === outletId && Object.keys(old.isi ?? {}).length) {
          selected = { ...fresh(old.tanggal), isi: old.isi, sistem: old.sistem ?? {}, catatan: old.catatan ?? "", jenis: old.jenis ?? "rutin" };
          local = [selected]; remember(selected);
        }
      }
    } catch { setStatus("Draft perangkat belum dapat dibaca. Mencoba cadangan server."); }
    const initial = selected ?? fresh();
    latest.current = initial; setDraft(initial); setArchives(local);
    void daftarDraftSo(outletId).then(r => {
      if (!live) return;
      const remote = r.drafts ?? [];
      setArchives(old => {
        const map = new Map(remote.map(d => [d.id,d]));
        old.forEach(d => { if (!map.has(d.id) || map.get(d.id)!.updatedAt < d.updatedAt) map.set(d.id,d); });
        return [...map.values()].sort((a,b) => b.updatedAt-a.updatedAt);
      });
      const newer = remote.find(d => d.id === latest.current?.id && d.updatedAt > latest.current.updatedAt);
      if (newer && latest.current?.updatedAt === initial.updatedAt) {
        latest.current = newer; setDraft(newer); remember(newer);
      }
      const candidate = remote.find(d => d.scope === scope && !d.completedId && d.tanggal === hariSo());
      // Jangan menimpa isian yang sedang diketik saat respons jaringan tiba.
      if (candidate && latest.current?.id === initial.id && !Object.keys(latest.current.isi).length && !latest.current.attempt) {
        latest.current = candidate; setDraft(candidate); setStatus("Draft hari ini dipulihkan dari server. Periksa hitungan sebelum menyimpan.");
      } else if (r.error) setStatus(r.error + " Draft perangkat tetap dipakai.");
    }).catch(() => { if (live) setStatus("Server belum terhubung. Draft tersimpan hanya jika penyimpanan perangkat berhasil."); });
    return () => { live = false; };
  }, [key, outletId, scope, fresh, remember]);
  const change = useCallback((fn: (d: SoDraft) => SoDraft) => {
    const current = latest.current;
    if (!current) return;
    const next = { ...fn(current), updatedAt: Math.max(Date.now(), current.updatedAt+1) };
    latest.current = next; remember(next); setDraft(next);
  }, [remember]);
  useEffect(() => {
    if (!draft || (!Object.keys(draft.isi).length && !draft.completedId && !draft.attempt)) return;
    const timer = setTimeout(() => {
      void cadangkanSo(draft).then(r => {
        if (latest.current?.id !== draft.id || latest.current.updatedAt !== draft.updatedAt) return;
        setStatus(r.error ?? (draft.completedId ? `Arsip SO final. Nomor bukti: ${draft.completedId}.` : localOkay.current ? "Draft tersimpan di perangkat dan dicadangkan ke server. Belum menjadi SO final." : "Draft dicadangkan ke server; penyimpanan perangkat tidak tersedia."));
      }).catch(() => { if (latest.current?.id === draft.id && latest.current.updatedAt === draft.updatedAt) setStatus("Cadangan server tertunda. Periksa status draft perangkat sebelum menutup halaman."); });
    }, 900);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const reconnect = () => {
      const d=latest.current;
      if (!d || !Object.keys(d.isi).length) return;
      void cadangkanSo(d).then(r=>{
        if(latest.current?.id!==d.id || latest.current.updatedAt!==d.updatedAt) return;
        setStatus(r.error??(d.completedId?`Arsip SO final. Nomor bukti: ${d.completedId}.`:"Draft dicadangkan ke server setelah koneksi kembali. Belum menjadi SO final."));
      }).catch(()=>{ /* Draft perangkat tetap ada; tidak mengirim SO final otomatis. */ });
    };
    window.addEventListener("online",reconnect);
    return ()=>window.removeEventListener("online",reconnect);
  }, []);
  const open = (d: SoDraft) => { latest.current = d; remember(d); setDraft(d); };
  const complete = async (id: string) => {
    if (!latest.current) return;
    const done = { ...latest.current, completedId: id, attempt: undefined, updatedAt: Math.max(Date.now(),latest.current.updatedAt+1) };
    remember(done);
    try { await cadangkanSo(done); } catch { /* Bukti final sudah berada di tabel opname. */ }
    const next = fresh(); latest.current = next; setDraft(next);
    try { localStorage.setItem(`${key}:active`, next.id); } catch { /* status lokal ditampilkan oleh remember */ }
    setStatus(`SO berhasil masuk server. Nomor bukti: ${id}.`);
  };
  return { draft, archives, status, change, open, fresh, complete };
}
