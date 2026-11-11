import { describe, expect, it } from "vitest";

import { fixed, formatBytes, formatSeconds, formatWithUnit } from "./format.js";

describe("mise en forme des nombres", () => {
  it("écrit la virgule décimale", () => {
    expect(fixed(0.139, 3)).toBe("0,139");
    expect(fixed(-12.345, 2)).toBe("−12,35");
  });

  it("donne un instant en secondes", () => {
    expect(formatSeconds(0.139)).toBe("0,139 s");
    expect(formatSeconds(0)).toBe("0,000 s");
  });

  it("ajoute l'unité demandée", () => {
    expect(formatWithUnit(33, "ms")).toBe("33,0 ms");
    expect(formatWithUnit(-13.4, "dB")).toBe("−13,40 dB");
    expect(formatWithUnit(0.2, "cents")).toBe("0,20 cents");
    expect(formatWithUnit(196, "Hz")).toBe("196,00 Hz");
    expect(formatWithUnit(144000, "échantillons")).toBe("144000 échantillons");
    expect(formatWithUnit(1, "images")).toBe("1 image");
    expect(formatWithUnit(2, "images")).toBe("2 images");
  });

  it("n'invente pas de nombre pour l'infini et le non-nombre", () => {
    expect(fixed(Number.NaN, 2)).toBe("indéfini");
    expect(fixed(Number.POSITIVE_INFINITY, 2)).toBe("+infini");
  });

  it("lit un poids en octets", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(26 * 1024)).toBe("26,0 Ko");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3,00 Mo");
  });
});
