import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { fr } from "./fr.js";
import { langFrom, messagesFor, messagePaths } from "./index.js";

describe("textes externalisés (AIR-N-14)", () => {
  it("le français couvre exactement les mêmes libellés que l'anglais", () => {
    expect([...messagePaths(fr)].sort()).toEqual([...messagePaths(en)].sort());
  });

  it("AIR-N-14 — l'anglais est la langue de soumission, et le défaut", () => {
    expect(langFrom("")).toBe("en");
    expect(langFrom("?lang=fr")).toBe("fr");
    expect(langFrom("?lang=de")).toBe("en");
    expect(messagesFor("en")).toBe(en);
    expect(messagesFor("fr")).toBe(fr);
  });

  it("§12.1 — chaque écran a ses libellés", () => {
    expect(en.home.start).toBe("Start");
    expect(en.home.playWithoutCamera).toBe("Play without a camera");
    expect(en.home.privacyLine).toBe("Your camera image never leaves this page.");
    for (const cle of ["stage", "instruments", "loop", "calibration", "editor", "physics", "settings"] as const) {
      expect(Object.keys(en[cle]).length).toBeGreaterThan(3);
    }
  });

  it("§5.4 — le retard se dit « measured » ou « estimated », jamais autrement", () => {
    expect(en.common.measured).toBe("measured");
    expect(en.common.estimated).toBe("estimated");
    expect(en.common.partial).toContain("partial");
    const textes = messagePaths(en);
    expect(textes.length).toBeGreaterThan(120);
  });

  it("AIR-F-33 — les textes composés gardent leurs variables", () => {
    expect(en.camera.modelLoading(42)).toContain("42");
    expect(en.loop.layerLabel(2, "Harp")).toContain("Harp");
    expect(fr.loop.full(6)).toContain("6");
  });
});
