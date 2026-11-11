import { describe, expect, it } from "vitest";
import { parseInstrument } from "@thin-air/schema";
import { BUILT_IN, builtInByName, chargerLivres, isBuiltInName, premierLivre } from "./library.js";

describe("les instruments livrés, chargés des fichiers du dépôt (§7.8)", () => {
  it("la liste n'est pas vide : les instruments livrés valides sont embarqués", () => {
    // Un fichier refusé par le schéma n'entre pas dans la liste (AIR-F-43) :
    // à ce jour `grid-drums.json` est écarté, son `defaults.quantizeStrength`
    // dépasse la borne du schéma — écart signalé au compte rendu, pas réparé.
    expect(BUILT_IN.length).toBeGreaterThanOrEqual(5);
    const noms = BUILT_IN.map((instrument) => instrument.name);
    for (const attendu of ["Phantom", "Harp", "Choir", "Bells", "Drone"]) {
      expect(noms).toContain(attendu);
    }
    expect(noms[0]).toBe("Phantom");
  });

  it("chaque instrument livré passe le schéma du lot A4", () => {
    for (const instrument of BUILT_IN) {
      expect(parseInstrument(JSON.parse(JSON.stringify(instrument))).ok).toBe(true);
      expect(instrument.format).toBe("thin-air-instrument/1");
    }
  });

  it("le premier livré sert d'instrument par défaut", () => {
    expect(premierLivre()?.name).toBe("Phantom");
    expect(builtInByName("Harp")).not.toBeNull();
    expect(builtInByName("Inconnu")).toBeNull();
    expect(isBuiltInName("Harp")).toBe(true);
    expect(isBuiltInName("Harp (copy)")).toBe(false);
  });

  it("un fichier refusé par le schéma n'entre pas dans la liste, sans défaut silencieux", () => {
    const livres = chargerLivres({
      "a.json": JSON.parse(JSON.stringify(BUILT_IN[0]!)),
      "b.json": { format: "autre" },
    });
    expect(livres.map((instrument) => instrument.name)).toEqual(["Phantom"]);
    expect(chargerLivres({})).toEqual([]);
  });
});
