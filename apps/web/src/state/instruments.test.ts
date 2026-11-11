import { describe, expect, it } from "vitest";
import { SCALES } from "@thin-air/core";
import { BUILT_IN, HARP, PHANTOM } from "./presets.js";
import {
  copyName,
  duplicate,
  edit,
  instrumentFromFragment,
  instrumentInLocation,
  instrumentToFragment,
  isBuiltIn,
  scaleNameOf,
  shapeOf,
  shareLink,
  validate,
} from "./instruments.js";

const suffixe = (nom: string) => `${nom} (copy)`;

describe("tiroir d'instruments (AIR-F-21, 43, 44, 45)", () => {
  it("les trois indispensables sont livrés, dans l'ordre du cahier", () => {
    expect(BUILT_IN.slice(0, 3).map((i) => i.name)).toEqual(["Phantom", "Harp", "Choir"]);
    expect(BUILT_IN.every((i) => i.format === "thin-air-instrument/1")).toBe(true);
  });

  it("chaque instrument livré a une géométrie lisible par la scène", () => {
    expect(shapeOf(PHANTOM)).toEqual({ kind: "range", count: 0 });
    expect(shapeOf(HARP)).toEqual({ kind: "strings", count: 16 });
    expect(shapeOf(BUILT_IN[2]!)).toEqual({ kind: "zones", count: 8 });
  });

  it("P8 — dupliquer donne une copie modifiable, les livrés restent en lecture seule", () => {
    const copie = duplicate(HARP, suffixe);
    expect(copie.name).toBe("Harp (copy)");
    expect(isBuiltIn(copie)).toBe(false);
    expect(isBuiltIn(HARP)).toBe(true);
    expect(copyName("  ", suffixe)).toBe("Instrument (copy)");
  });

  it("P8 — douze cordes en gamme par tons", () => {
    const copie = duplicate(HARP, suffixe);
    const modifie = edit(copie, { scaleName: "wholeTone", count: 12 });
    expect(shapeOf(modifie)).toEqual({ kind: "strings", count: 12 });
    expect(modifie.scale.steps).toEqual(SCALES.wholeTone);
  });

  it("AIR-F-44 — gamme, fondamentale, étendue, aimant et son se règlent", () => {
    const modifie = edit(PHANTOM, { root: 57, low: 48, high: 84, snap: 0.25, engine: "fm" });
    expect(modifie.scale.root).toBe(57);
    expect(modifie.range).toEqual({ low: 48, high: 84 });
    expect(modifie.snap).toBe(0.25);
    expect(modifie.sound.engine).toBe("fm");
    expect(modifie.sound.wave).toBe(PHANTOM.sound.wave);
  });

  it("l'éditeur borne tout : rien ne sort des numéros de notes ni de l'aimant", () => {
    const modifie = edit(PHANTOM, { root: 400, low: 90, high: 10, snap: 9, count: 999 });
    expect(modifie.scale.root).toBe(127);
    expect(modifie.range).toEqual({ low: 10, high: 90 });
    expect(modifie.snap).toBe(1);
  });

  it("redimensionner les zones garde les existantes et complète en grille", () => {
    const choeur = BUILT_IN[2]!;
    const agrandi = edit(choeur, { count: 10 });
    expect(shapeOf(agrandi).count).toBe(10);
    expect(agrandi.zones?.zones[8]?.id).toBe("z8");
  });

  it("AIR-F-43 — un fichier invalide est refusé EN ENTIER, avec ses raisons", () => {
    const illisible = validate("{ pas du JSON");
    expect(illisible.ok).toBe(false);
    const refus = validate('{"format":"autre","name":"","scale":{},"snap":3,"voices":0,"sound":{}}');
    expect(refus.ok).toBe(false);
    if (!refus.ok) {
      expect(refus.reasons).toEqual(
        expect.arrayContaining(["format", "name", "scale", "geometry", "snap", "voices", "sound"]),
      );
    }
  });

  it("AIR-F-43 — un fichier complet est accepté tel quel", () => {
    const accepte = validate(JSON.stringify(HARP));
    expect(accepte.ok).toBe(true);
    if (accepte.ok) expect(accepte.instrument.name).toBe("Harp");
  });

  it("AIR-F-45 — P8 : l'instrument tient dans le fragment, et en ressort identique", () => {
    const copie = edit(duplicate(HARP, suffixe), { scaleName: "wholeTone", count: 12 });
    const fragment = instrumentToFragment(copie);
    expect(fragment).not.toContain("#");
    const relu = instrumentFromFragment(fragment);
    expect(relu.ok).toBe(true);
    if (relu.ok) expect(relu.instrument).toEqual(copie);
  });

  it("AIR-F-45 — un fragment abîmé est refusé, pas accepté à moitié", () => {
    expect(instrumentFromFragment("!!!").ok).toBe(false);
    expect(instrumentFromFragment("").ok).toBe(false);
    expect(instrumentInLocation("#autre=chose")).toBeNull();
    const lu = instrumentInLocation(`#i=${instrumentToFragment(PHANTOM)}`);
    expect(lu?.ok).toBe(true);
  });

  it("AIR-N-01 — le lien reste sur la même origine, aucune requête tierce", () => {
    const lien = shareLink(PHANTOM, "https://exemple.test/thin-air/");
    expect(lien.startsWith("https://exemple.test/thin-air/#i=")).toBe(true);
    expect(lien.split("#").length).toBe(2);
  });

  it("la gamme d'un instrument se retrouve par son nom", () => {
    expect(scaleNameOf(HARP)).toBe("minorPentatonic");
    expect(scaleNameOf(edit(PHANTOM, { scaleName: "chromatic" }))).toBe("chromatic");
  });

  it.todo("AIR-P-19 — le schéma Zod refuse les mêmes fichiers que la page — dépend du lot A4 (schema)");
  it.todo("AIR-P-20 — un instrument rechargé du fragment passe le schéma — dépend du lot A4 (schema)");
});
