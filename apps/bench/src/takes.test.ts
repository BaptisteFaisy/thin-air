/**
 * Les nombres de la recette §18, recopiés du cahier : ils sont vérifiés ici
 * tels quels, sans dépendre d'un rendu ni d'un autre lot.
 */
import type { Take } from "@thin-air/core";
import { describe, expect, it } from "vitest";

import {
  HARP_GEOMETRY,
  HARP_NOTES,
  LOOP_RECIPE,
  REFERENCE_TAKES,
  REFERENCE_TAKE_NAMES,
  THEREMIN_GEOMETRY,
  THEREMIN_NOTES,
  harpStringU,
  harpTimeForU,
  referenceTake,
  samplesFor,
  timeForU,
  uForMidi,
} from "./takes.js";
import { ANNOUNCED_JSON_BYTES_PER_SECOND, takeDurationS, weighTake } from "./weight.js";

describe("recette §18 — le thérémine (§7.14)", () => {
  it("donne huit notes, de sol à sol, dans l'ordre", () => {
    expect(THEREMIN_NOTES.map((note) => note.passage)).toEqual([
      "départ sur sol",
      "sol → la",
      "la → si bémol",
      "si bémol → do dièse",
      "do dièse → ré",
      "ré → mi",
      "mi → fa",
      "fa → sol",
    ]);
    expect(THEREMIN_NOTES).toHaveLength(8);
  });

  it("donne les instants de référence, croissants", () => {
    const instants = THEREMIN_NOTES.map((note) => note.t);
    expect(instants).toEqual([0, 0.139, 0.514, 1.153, 1.625, 2.083, 2.458, 2.917]);
    for (let i = 1; i < instants.length; i += 1) {
      expect(instants[i]).toBeGreaterThan(instants[i - 1] ?? -1);
    }
  });

  it("donne les fréquences attendues", () => {
    expect(THEREMIN_NOTES.map((note) => note.hz)).toEqual([
      196.0, 220.0, 233.08, 277.18, 293.66, 329.63, 349.23, 392.0,
    ]);
  });

  it("relie chaque position u à son instant par la vitesse constante du cahier", () => {
    expect(timeForU(THEREMIN_GEOMETRY.fromU)).toBeCloseTo(0, 6);
    expect(timeForU(THEREMIN_GEOMETRY.toU)).toBeCloseTo(3, 6);
    // Les positions de la table du cahier redonnent ses instants.
    for (const note of THEREMIN_NOTES) {
      expect(timeForU(note.u)).toBeCloseTo(note.t, 1);
    }
  });

  it("retrouve le seuil de note de chaque passage", () => {
    for (const note of THEREMIN_NOTES) {
      const midi = THEREMIN_GEOMETRY.lowMidi + (THEREMIN_GEOMETRY.highMidi - THEREMIN_GEOMETRY.lowMidi) * note.u;
      if (note.thresholdMidi === null) {
        // La première ligne du cahier n'a pas de seuil : c'est la note de départ.
        expect(midi).toBeCloseTo(55.8, 1);
        continue;
      }
      expect(midi).toBeCloseTo(note.thresholdMidi, 0);
    }
  });

  it("rapporte une position u à sa note, dans l'étendue 45 à 81", () => {
    expect(uForMidi(45, 45, 81)).toBe(0);
    expect(uForMidi(81, 45, 81)).toBe(1);
    expect(uForMidi(63, 45, 81)).toBeCloseTo(0.5, 6);
  });

  it("fait 144 000 échantillons à 48 kHz sur trois secondes", () => {
    expect(samplesFor(THEREMIN_GEOMETRY.durationS, 48_000)).toBe(144_000);
  });
});

describe("recette §18 — la harpe (§7.14)", () => {
  it("place la corde i à (i + 0,5) / 16", () => {
    expect(harpStringU(0)).toBeCloseTo(0.03125, 8);
    expect(harpStringU(3)).toBeCloseTo(0.21875, 8);
    expect(harpStringU(15)).toBeCloseTo(0.96875, 8);
  });

  it("donne quatre notes, la do ré fa, espacées de 125 ms", () => {
    expect(HARP_NOTES.map((note) => note.name)).toEqual(["la", "do", "ré", "fa"]);
    expect(HARP_NOTES.map((note) => note.hz)).toEqual([220.0, 261.63, 293.66, 349.23]);
    for (let i = 1; i < HARP_NOTES.length; i += 1) {
      const ecart = (HARP_NOTES[i]?.t ?? 0) - (HARP_NOTES[i - 1]?.t ?? 0);
      expect(ecart).toBeCloseTo(0.125, 3);
    }
  });

  it("retrouve l'instant de chaque corde par le balayage à vitesse constante", () => {
    for (const note of HARP_NOTES) {
      expect(harpStringU(note.string)).toBeCloseTo(note.u, 3);
      expect(harpTimeForU(note.u)).toBeCloseTo(note.t, 2);
    }
  });

  it("donne une force de 0,17 pour 0,5 largeur par seconde", () => {
    // Le cahier : une vitesse de 0,5 par seconde, divisée par 3 (lot B1).
    expect(HARP_GEOMETRY.velocity).toBeCloseTo(0.5 / 3, 2);
    expect(HARP_GEOMETRY.velocity).toBeCloseTo(0.17, 2);
  });
});

describe("recette §18 — la boucle", () => {
  it("fait 512 000 échantillons à 48 kHz pour quatre mesures à 90", () => {
    expect(LOOP_RECIPE.samples).toBe(512_000);
    expect(LOOP_RECIPE.durationS).toBeCloseTo(10.667, 3);
    expect(samplesFor(LOOP_RECIPE.durationS, LOOP_RECIPE.sampleRate)).toBe(512_000);
  });
});

describe("prises de référence (§13.3)", () => {
  it("déclare les sept prises du cahier, dans l'ordre", () => {
    expect(REFERENCE_TAKE_NAMES).toEqual([
      "left-hand-only",
      "two-hands-cross",
      "slow-rise",
      "harp-sweep",
      "tremor-at-boundary",
      "hand-leaves-mid-note",
      "fast-jab",
    ]);
  });

  it("donne à chaque prise un instrument et une description", () => {
    for (const spec of REFERENCE_TAKES) {
      expect(spec.instrument).toMatch(/^instruments\/.+\.json$/);
      expect(spec.description.length).toBeGreaterThan(10);
      expect(spec.durationS).toBeGreaterThan(0);
    }
  });

  it("retrouve une prise par son nom, et rien pour un nom inconnu", () => {
    expect(referenceTake("slow-rise")?.durationS).toBe(3);
    expect(referenceTake("inconnue")).toBeUndefined();
  });

  it("fait du thérémine la prise de trois secondes du §7.14", () => {
    const spec = referenceTake("slow-rise");
    expect(spec?.instrument).toBe("instruments/phantom.json");
    expect(THEREMIN_GEOMETRY.fromU).toBe(0.3);
    expect(THEREMIN_GEOMETRY.toU).toBe(0.6);
    expect(THEREMIN_GEOMETRY.volumeV).toBe(0.75);
  });

  it("fait de la harpe la prise d'une demi-seconde du §7.14", () => {
    const spec = referenceTake("harp-sweep");
    expect(spec?.instrument).toBe("instruments/harp.json");
    expect(spec?.durationS).toBe(0.5);
    expect(HARP_GEOMETRY.fromU).toBe(0.2);
    expect(HARP_GEOMETRY.toU).toBe(0.45);
  });
});

describe("poids d'une prise (§7.11)", () => {
  const take = (frames: number, fps = 30): Take => ({
    format: "thin-air-take/1",
    fps,
    frames: Array.from({ length: frames }, (_, i) => ({ t: i / fps, hands: [] })),
  });

  it("mesure la durée d'une prise par sa dernière image", () => {
    expect(takeDurationS(take(91, 30))).toBeCloseTo(3.033, 3);
    expect(takeDurationS(take(0))).toBe(0);
  });

  it("trouve une prise de 3 s dans l'ordre de grandeur annoncé quand elle pèse 26 Ko/s", () => {
    const poids = ANNOUNCED_JSON_BYTES_PER_SECOND * 3;
    const verdict = weighTake(take(90), poids);
    expect(verdict.within).toBe(true);
    expect(verdict.ratio).toBeCloseTo(1, 2);
  });

  it("signale l'écart quand le poids quadruple", () => {
    const verdict = weighTake(take(90), ANNOUNCED_JSON_BYTES_PER_SECOND * 3 * 4);
    expect(verdict.within).toBe(false);
    expect(verdict.ratio).toBeGreaterThan(2);
  });
});
