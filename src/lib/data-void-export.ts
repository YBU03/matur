import { rekapVoid,waktuVoid,type VoidRow } from "./data-void";
export async function exportVoid(rows:VoidRow[],outlet:string,periode:string,type:"pdf"|"xlsx"){
 const r=rekapVoid(rows);
 const sections=[
 {title:"Ringkasan",headers:["Transaksi","Jumlah menu","Nominal void neto"],rows:[[r.transaksi,r.qty,r.nominal]]},
 {title:"Transaksi void",headers:["ID","No.","Outlet","Dibuat (WIB)","Void (WIB)","Pelaku","Kategori","Alasan / catatan","Subtotal","Diskon","Nominal neto"],rows:rows.map(t=>[t.id,t.nomor,t.outlet,waktuVoid(t.created_at),waktuVoid(t.void_at),t.pelaku,t.kategori,t.alasan??"",Number(t.subtotal),Number(t.diskon),Number(t.total)])},
 {title:"Detail menu",headers:["ID transaksi","No.","Outlet","Menu","Qty","Harga","Nilai sebelum diskon"],rows:rows.flatMap(t=>t.items.map(i=>[t.id,t.nomor,t.outlet,i.nama,Number(i.qty),Number(i.harga),Number(i.qty)*Number(i.harga)]))},
 {title:"Rekap alasan",headers:["Kategori","Transaksi","Nominal neto"],rows:r.alasan.map(a=>[a.nama,a.transaksi,a.nominal])},
 {title:"Rekap menu",headers:["Menu","Qty","Nilai sebelum diskon"],rows:r.menu.map(m=>[m.nama,m.qty,m.nominal])}];
 if(type==="xlsx"){
 const ExcelJS=await import("exceljs");const wb=new ExcelJS.Workbook();
 for(const section of sections){const ws=wb.addWorksheet(section.title);ws.addRow(["Matoer · Data Void"]);ws.addRow([outlet]);ws.addRow([periode]);ws.addRow([]);ws.addRow(section.headers).font={bold:true};for(const row of section.rows)ws.addRow(row);ws.columns.forEach(c=>{c.width=24;});ws.views=[{state:"frozen",ySplit:5}];}
 const blob=new Blob([await wb.xlsx.writeBuffer()],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Matoer-Data-Void.xlsx";a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
 }else{const {jsPDF}=await import("jspdf");const {default:autoTable}=await import("jspdf-autotable");const doc=new jsPDF({orientation:"landscape",format:"a4"});
 sections.forEach((section,n)=>{if(n)doc.addPage();doc.setFontSize(13);doc.text("Matoer · Data Void · "+section.title,14,14);doc.setFontSize(9);doc.text(outlet,14,21);doc.text(periode,14,27);autoTable(doc,{head:[section.headers],body:section.rows,startY:33,styles:{fontSize:7,overflow:"linebreak"},margin:{left:14,right:14},headStyles:{fillColor:[115,75,35]}});});doc.save("Matoer-Data-Void.pdf");}
}
