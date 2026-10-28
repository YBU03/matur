import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("../session", () => ({ getSession: m.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../supabase/server", () => ({ supabaseServer: async () => ({ from: () => ({ update: m.update, insert: m.insert }) }) }));
import { saveMaster } from "../master-actions";
beforeEach(() => {
 vi.clearAllMocks();m.session.mockResolvedValue({active:{role:"admin_gudang"}});
 const result={select:()=>({single:async()=>({data:{id:"v"},error:null})})};
 m.insert.mockReturnValue(result);m.update.mockReturnValue({eq:()=>result});
});
it("Gudang can save free and paid sugar choices",async()=>{
 for (const harga of ["", "0", "2.000"]) {
  expect(await saveMaster("varian",null,{menu_id:"m",grup:"Gula",nama:"Less Sugar",tambahan_harga:harga})).toEqual({});
 }
 expect(m.insert.mock.calls.map(c=>c[0].tambahan_harga)).toEqual([0,0,2000]);
});
it("editing only the name preserves existing additional price",async()=>{
 expect(await saveMaster("varian","v",{nama:"No Sugar"},["nama"])).toEqual({});
 expect(m.update).toHaveBeenCalledWith({nama:"No Sugar"});
});
it("rejects negative price and outlet staff changing modifier settings",async()=>{
 expect(await saveMaster("varian",null,{menu_id:"m",grup:"Gula",nama:"Less Sugar",tambahan_harga:"-1000"})).toHaveProperty("error");
 m.session.mockResolvedValue({active:{role:"barista"}});
 expect(await saveMaster("varian","v",{nama:"No Sugar"},["nama"])).toHaveProperty("error");
 expect(m.update).not.toHaveBeenCalled();expect(m.insert).not.toHaveBeenCalled();
});
