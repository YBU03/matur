import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { SiapkanKatalog } from "./siapkan";

export default async function Page({ searchParams }: {searchParams: Promise<{outlet?: string}>}) {
 const s=await getSession();
 if(!s?.active || !["owner","admin_pusat"].includes(s.active.role)) notFound();
 const db=await supabaseServer();
 const {data,error}=await db.from("outlet").select("id,nama,konsep,katalog_bersama,brand(nama)").eq("mode","asli").is("deleted_at",null).order("nama");
 if(error) throw new Error(error.message);
 const outlets=data??[]; const sp=await searchParams;
 const o=outlets.find(o=>o.id===sp.outlet)??outlets[0];
 if(!o) return <p>Tambahkan outlet di Master Outlet terlebih dahulu.</p>;
 const [{data:menus,error:me},{count:transaksi,error:te}]=await Promise.all([
  db.from("menu").select("id,nama,outlet_id,aktif,induk_id,resep(id)").eq("mode","asli").is("deleted_at",null).or(o.katalog_bersama?`outlet_id.eq.${o.id},outlet_id.is.null`:`outlet_id.eq.${o.id}`).order("nama"),
  db.from("transaksi").select("id",{count:"exact",head:true}).eq("outlet_id",o.id),
 ]);
 if(me||te) throw new Error((me??te)!.message);
 const rows=menus??[]; const khusus=rows.filter(m=>m.outlet_id===o.id);
 const brand=Array.isArray(o.brand)?o.brand[0]?.nama:(o.brand as {nama?:string}|null)?.nama;
 return <div className="space-y-5">
  <div><h1 className="text-2xl font-bold">Brand & Katalog Outlet</h1><p className="text-sm text-stone-500">Atur konsep usaha dan menu masing-masing outlet.</p></div>
  <div className="flex flex-wrap gap-3 text-sm font-semibold underline"><Link href="/master/brand">Kelola brand</Link><Link href="/master/outlet">Tambah / edit outlet dan konsep</Link></div>
  <form className="flex gap-2"><select name="outlet" defaultValue={o.id} aria-label="Outlet" className="rounded-xl border p-3">{outlets.map(x=><option key={x.id} value={x.id}>{x.nama}</option>)}</select><button className="rounded-xl bg-kopi-900 px-4 text-white">Tampilkan</button></form>
  <section className="rounded-2xl border bg-white p-4 space-y-2"><h2 className="font-bold">{o.nama}</h2><p>{brand??"Brand belum diatur"} · {o.konsep??"Konsep belum diatur"}</p><p className="text-sm">{o.katalog_bersama?"Menggunakan katalog bersama lama + menu khusus outlet.":"Menggunakan katalog khusus outlet."}</p><p className="text-sm">{rows.length} menu/kemasan · {rows.filter(m=>m.aktif).length} aktif · {rows.filter(m=>!m.resep.length).length} tanpa resep. Menu tanpa resep tidak memotong bahan; periksa apakah produk titipan atau perlu resep.</p></section>
  <SiapkanKatalog key={o.id} outlet={o.id} sources={outlets.filter(x=>x.id!==o.id).map(x=>({id:x.id,nama:x.nama}))} boleh={!transaksi&&!khusus.length} bersama={o.katalog_bersama}/>
  <section className="grid gap-3 sm:grid-cols-2">{[
   ["Menu & harga",`/master/menu?outlet_id=${o.id}`,"Tambah/edit menu khusus outlet ini; termasuk harga langsung dan online."],
   ["Resep & HPP",`/hpp-menu?outlet=${o.id}`,"Atur takaran bahan untuk masing-masing menu dan kemasan."],
   ["Bahan & stok",`/stok/outlet?outlet=${o.id}`,"Pilih bahan, minimum, SO, koreksi, waste dan permintaan gudang."],
   ["Identitas struk","/pengaturan/struk","Pilih outlet untuk mengatur alamat, judul dan kontak struk."],
   ["Promo outlet","/promo","Pilih outlet dan menu yang mengikuti promosi."],
   ["Bahan master","/master/bahan","Tambah bahan dan kategori, satuan, konversi serta pemasok."],
  ].map(([title,href,desc])=><Link key={href} href={href} className="rounded-2xl border bg-white p-4"><h2 className="font-bold">{title} →</h2><p className="text-sm text-stone-500">{desc}</p></Link>)}</section>
  <section className="rounded-2xl border bg-white p-4"><h2 className="font-bold">Katalog yang tersedia ({rows.length})</h2><ul className="divide-y">{rows.map(m=><li key={m.id} className="flex flex-wrap gap-2 py-2"><span className="mr-auto">{m.nama} · {m.aktif?"Aktif":"Nonaktif"} · {m.outlet_id?"Khusus outlet":"Bersama lama"}</span><Link className="text-sm underline" href={`/menu-varian/${m.induk_id??m.id}`}>Varian & resep</Link></li>)}</ul>{!rows.length&&<p>Belum ada menu. Tambahkan menu atau salin katalog outlet lain.</p>}</section>
 </div>;
}
