import { it, expect } from "vitest";
import { sewaTahunan, sewaBulanan, sewaBulananLaporan, formatSewaBulanan } from "../sewa-perjanjian";
import { ENTITIES, parseForm } from "../master";
it('annual figures stay exact while monthly equivalents and accounting rounding are explicit', () => {
 const kominot={sewa_tahunan:17000000,sewa_bulanan:1416667};
 expect(sewaTahunan(kominot)).toBe(17000000);
 expect(sewaBulanan(kominot)).toBeCloseTo(1416666.6666667);
 expect(sewaBulananLaporan(kominot)).toBe(1416667);
 expect(formatSewaBulanan(17000000)).toBe('Rp 1.416.666,67');
 expect(formatSewaBulanan(25000000)).toBe('Rp 2.083.333,33');
 expect(sewaBulananLaporan({sewa_tahunan:25000000,sewa_bulanan:25000000})).toBe(2083333);
});
it('zero annual rent is authoritative; legacy monthly records keep their original meaning', () => {
 expect(sewaBulanan({sewa_tahunan:0,sewa_bulanan:1000000})).toBe(0);
 expect(sewaTahunan({sewa_bulanan:1000000})).toBe(12000000);
 expect(sewaBulanan({sewa_bulanan:1000000})).toBe(1000000);
 expect(formatSewaBulanan(0)).toBe('Rp 0,00');
});
it('master form accepts annual input and does not submit a second monthly value', () => {
 const fields=ENTITIES.perjanjian.fields.filter(f=>f.key.startsWith('sewa_') && f.type==='money');
 expect(fields.map(f=>f.key)).toEqual(['sewa_tahunan']);
 const {values,errors}=parseForm({...ENTITIES.perjanjian,fields},{sewa_tahunan:'25.000.000'});
 expect(errors).toEqual([]);expect(values).toEqual({sewa_tahunan:25000000});
});
