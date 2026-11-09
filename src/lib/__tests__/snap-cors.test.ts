import { describe, expect, it } from "vitest";
import { corsSnap } from "../snap-cors";

describe("corsSnap", () => {
  it("mengizinkan portal ASPI", () => {
    const h = corsSnap("https://apidevportal.aspi-indonesia.or.id");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://apidevportal.aspi-indonesia.or.id");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-signature");
    expect(h["Access-Control-Allow-Methods"]).toContain("OPTIONS");
  });
  it("menolak origin lain atau tanpa origin", () => {
    expect(corsSnap("https://evil.example")).toEqual({});
    expect(corsSnap(null)).toEqual({});
  });
});
