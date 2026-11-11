import { describe, expect, it } from "vitest";

import { optionalValue, parseArgs, numberValue, requireValue, wantsHelp } from "./args.js";
import { UsageError } from "./errors.js";

const SPEC = {
  command: "bench events",
  values: ["take", "instrument"],
  flags: ["one-hand", "json"],
} as const;

describe("analyse des arguments", () => {
  it("lit une option et sa valeur", () => {
    const args = parseArgs(["--take", "a.json", "--instrument", "i.json"], SPEC);
    expect(args.values.get("take")).toBe("a.json");
    expect(args.values.get("instrument")).toBe("i.json");
  });

  it("accepte la forme --nom=valeur", () => {
    const args = parseArgs(["--take=a.json"], SPEC);
    expect(optionalValue(args, "take")).toBe("a.json");
  });

  it("lit un drapeau", () => {
    const args = parseArgs(["--one-hand", "--json"], SPEC);
    expect(args.flags.has("one-hand")).toBe(true);
    expect(args.flags.has("json")).toBe(true);
  });

  it("refuse une option inconnue, en la nommant", () => {
    expect(() => parseArgs(["--bogus", "x"], SPEC)).toThrow(UsageError);
    expect(() => parseArgs(["--bogus", "x"], SPEC)).toThrow(/option inconnue : --bogus/);
  });

  it("liste les options acceptées dans le refus", () => {
    try {
      parseArgs(["--bogus"], SPEC);
    } catch (error) {
      expect((error as UsageError).hint).toContain("--take");
      expect((error as UsageError).hint).toContain("--one-hand");
      return;
    }
    throw new Error("le refus aurait dû lever");
  });

  it("refuse une valeur manquante", () => {
    expect(() => parseArgs(["--take"], SPEC)).toThrow(/valeur manquante pour --take/);
  });

  it("refuse une valeur vide", () => {
    expect(() => parseArgs(["--take="], SPEC)).toThrow(/valeur vide/);
  });

  it("refuse une option répétée", () => {
    expect(() => parseArgs(["--take", "a", "--take", "b"], SPEC)).toThrow(/option répétée/);
  });

  it("refuse une valeur sur un drapeau", () => {
    expect(() => parseArgs(["--json=1"], SPEC)).toThrow(/ne prend pas de valeur/);
  });

  it("refuse un argument en trop quand aucun n'est attendu", () => {
    expect(() => parseArgs(["libre"], SPEC)).toThrow(/argument en trop/);
  });

  it("accepte les paramètres positionnels dans la limite annoncée", () => {
    const args = parseArgs(["a", "b"], { command: "bench compare", values: [], flags: [], positionals: 2 });
    expect(args.positionals).toEqual(["a", "b"]);
    expect(() => parseArgs(["a", "b", "c"], { command: "bench compare", values: [], flags: [], positionals: 2 })).toThrow(
      /argument en trop/,
    );
  });

  it("accepte --help et --aide partout, sans valeur", () => {
    for (const drapeau of ["--help", "--aide"]) {
      const args = parseArgs([drapeau], SPEC);
      expect(wantsHelp(args)).toBe(true);
    }
  });

  it("requireValue refuse une option obligatoire absente", () => {
    const args = parseArgs([], SPEC);
    expect(() => requireValue(args, "take")).toThrow(/option obligatoire manquante : --take/);
  });

  it("numberValue traduit et refuse le non numérique", () => {
    const spec = { command: "bench synth", values: ["fps"], flags: [] };
    expect(numberValue(parseArgs(["--fps", "60"], spec), "fps")).toBe(60);
    expect(numberValue(parseArgs([], spec), "fps")).toBeUndefined();
    expect(() => numberValue(parseArgs(["--fps", "soixante"], spec), "fps")).toThrow(/valeur numérique attendue/);
  });

  it("ne prend pas pour valeur une option qui suit", () => {
    expect(() => parseArgs(["--take", "--json"], SPEC)).toThrow(/valeur manquante pour --take/);
  });
});
