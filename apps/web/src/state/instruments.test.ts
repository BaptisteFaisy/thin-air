import { describe, expect, it } from "vitest";
import { SCALES } from "@thin-air/core";
import { parseInstrument } from "@thin-air/schema";
import { BUILT_IN, PHANTOM } from "./presets.js";
import { builtInByName } from "./library.js";
import {
  copyName,
  decodeMine,
  duplicate,
  edit,
  encodeMine,
  instrumentFromFragment,
  instrumentInLocation,
  instrumentToFragment,
  isBuiltIn,
  lireFragment,
  reasonField,
  reasonFields,
  scaleNameOf,
  shapeOf,
  shareLink,
  validate,
} from "./instruments.js";

const suffixe = (nom: string) => `${nom} (copy)`;

describe("tiroir d'instruments (AIR-F-21, 43, 44, 45)", () => {
  it("P8 — dupliquer donne une copie modifiable, les livrés restent en lecture seule", () => {
    const harpe = builtInByName("Harp");
    expect(harpe).not.toBeNull();
    const copie = duplicate(harpe!, suffixe);
    expect(copie.name).toBe("Harp (copy)");
    expect(isBuiltIn(copie)).toBe(false);
    expect(isBuiltIn(harpe!)).toBe(true);
    expect(copyName("  ", suffixe)).toBe("Instrument (copy)");
  });

  it("chaque instrument livré a une géométrie lisible par la scène", () => {
    expect(shapeOf(PHANTOM)).toEqual({ kind: "range", count: 0 });
    expect(shapeOf(builtInByName("Harp")!)).toEqual({ kind: "strings", count: 16 });
    expect(shapeOf(builtInByName("Choir")!)).toEqual({ kind: "zones", count: 8 });
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

  it("la gamme d'un instrument se retrouve par son nom", () => {
    expect(scaleNameOf(builtInByName("Harp")!)).toBe("minorPentatonic");
    expect(scaleNameOf(edit(PHANTOM, { scaleName: "chromatic" }))).toBe("chromatic");
  });
});

describe("AIR-F-43 — la validation est celle du schéma, refus en entier avec ses raisons", () => {
  it("un fichier illisible est refusé avec une raison, jamais accepté à moitié", () => {
    const illisible = validate("{ pas du JSON");
    expect(illisible.ok).toBe(false);
    if (!illisible.ok) expect(illisible.reasons.length).toBeGreaterThan(0);
  });

  it("un fichier invalide est refusé EN ENTIER, champs nommés dans les raisons", () => {
    const refus = validate('{"format":"autre","name":"","scale":{},"snap":3,"voices":0,"sound":{}}');
    expect(refus.ok).toBe(false);
    if (!refus.ok) {
      const texte = refus.reasons.join(" | ");
      for (const champ of ["format", "name", "scale", "snap", "sound"]) {
        expect(texte).toContain(champ);
      }
    }
  });

  it("AIR-P-19 — la page et le schéma refusent exactement les mêmes fichiers", () => {
    const fichiers = [
      '{"format":"autre","name":"","scale":{},"snap":3,"voices":0,"sound":{}}',
      JSON.stringify({ ...PHANTOM, snap: 4 }),
      JSON.stringify({ ...PHANTOM, champInconnu: 1 }),
      JSON.stringify(PHANTOM),
    ];
    for (const brut of fichiers) {
      const page = validate(brut);
      const schema = parseInstrument(JSON.parse(brut));
      expect(page.ok).toBe(schema.ok);
      if (!page.ok && !schema.ok) expect(page.reasons).toEqual(schema.reasons);
    }
  });

  it("un fichier complet est accepté tel quel, sans rien réparer", () => {
    const accepte = validate(JSON.stringify(builtInByName("Harp")));
    expect(accepte.ok).toBe(true);
    if (accepte.ok) expect(accepte.value.name).toBe("Harp");
  });

  it("les raisons se rangent près du champ concerné (éditeur en direct)", () => {
    expect(reasonField("name: too short")).toBe("name");
    expect(reasonField("scale.root: expected a number")).toBe("root");
    expect(reasonField("scale.steps.2: a step is a whole number")).toBe("scale");
    expect(reasonField("range.low: too small")).toBe("range");
    expect(reasonField("strings.count: too large")).toBe("count");
    expect(reasonField("zones.zones.0.u0: u0 must be at most u1")).toBe("count");
    expect(reasonField("snap: out of bounds")).toBe("snap");
    expect(reasonField("sound.engine: unknown engine")).toBe("sound");
    expect(reasonField("(root): an instrument needs at least one of range, strings or zones")).toBe("form");
    const groupes = reasonFields(["snap: a", "snap: b", "name: c"]);
    expect(groupes.snap).toEqual(["snap: a", "snap: b"]);
    expect(groupes.name).toEqual(["name: c"]);
    expect(groupes.form).toEqual([]);
  });
});

describe("AIR-F-45 — le lien de partage (P8)", () => {
  it("P8 — dupliquer Harp, douze cordes en gamme par tons, lien, relecture identique", () => {
    const harpe = builtInByName("Harp")!;
    const copie = duplicate(harpe, suffixe);
    const modifie = edit(copie, { scaleName: "wholeTone", count: 12 });
    expect(shapeOf(modifie)).toEqual({ kind: "strings", count: 12 });
    expect(modifie.scale.steps).toEqual(SCALES.wholeTone);
    const lien = shareLink(modifie, "https://exemple.test/thin-air/");
    const relu = instrumentInLocation(`#${lien.split("#")[1]}`);
    expect(relu?.ok).toBe(true);
    if (relu?.ok) expect(relu.value).toEqual(modifie);
  });

  it("AIR-P-20 — un instrument rechargé du fragment repasse le schéma", () => {
    const fragment = instrumentToFragment(PHANTOM);
    expect(fragment).not.toContain("#");
    const relu = instrumentFromFragment(fragment);
    expect(relu.ok).toBe(true);
    if (relu.ok) expect(parseInstrument(relu.value).ok).toBe(true);
    if (relu.ok) expect(relu.value).toEqual(PHANTOM);
  });

  it("AIR-N-01 — le lien reste sur la même origine, l'instrument est dans le fragment", () => {
    const lien = shareLink(PHANTOM, "https://exemple.test/thin-air/");
    expect(lien.startsWith("https://exemple.test/thin-air/#i=")).toBe(true);
    expect(lien.split("#").length).toBe(2);
    expect(lien.length).toBeLessThan(2500);
  });

  it("fragment invalide : les RAISONS du refus sont rendues, jamais de défaut silencieux", () => {
    const refus = instrumentInLocation("#i=!!!");
    expect(refus?.ok).toBe(false);
    const lu = lireFragment("#i=!!!", PHANTOM);
    expect(lu.instrument).toBe(PHANTOM);
    expect(lu.refus).not.toBeNull();
    expect(lu.refus!.length).toBeGreaterThan(0);
  });

  it("fragment absent : rien ne casse, le défaut s'applique sans message", () => {
    expect(instrumentInLocation("#autre=chose")).toBeNull();
    expect(instrumentInLocation("")).toBeNull();
    const lu = lireFragment("", PHANTOM);
    expect(lu.instrument).toBe(PHANTOM);
    expect(lu.refus).toBeNull();
  });

  it("fragment valide : l'instrument du lien est sélectionné", () => {
    const copie = edit(duplicate(PHANTOM, suffixe), { snap: 0.3 });
    const lu = lireFragment(`#i=${instrumentToFragment(copie)}`, PHANTOM);
    expect(lu.refus).toBeNull();
    expect(lu.instrument).toEqual(copie);
  });
});

describe("les instruments de l'utilisateur, gardés sur l'appareil (AIR-F-54)", () => {
  it("écrire puis relire redonne les mêmes instruments", () => {
    const copie = edit(duplicate(PHANTOM, suffixe), { snap: 0.4 });
    const brut = encodeMine([copie]);
    expect(decodeMine(brut)).toEqual([copie]);
  });

  it("une entrée abîmée ou un nom livré est écarté, les autres restent", () => {
    const copie = edit(duplicate(PHANTOM, suffixe), { snap: 0.4 });
    const brut = JSON.stringify([copie, { format: "autre" }, PHANTOM]);
    expect(decodeMine(brut)).toEqual([copie]);
    expect(decodeMine(null)).toEqual([]);
    expect(decodeMine("{ illisible")).toEqual([]);
    expect(decodeMine(JSON.stringify({ pas: "une liste" }))).toEqual([]);
  });
});
