/**
 * La chaîne complète (cahier §7.1) : image → rôles → filtrage → mesures →
 * gestes → instrument → événements. C'est ce que le banc d'essai rejoue, et ce
 * que la page exécute en direct.
 *
 * Propriétés : AIR-P-09 (aucune note coincée), 10 (voix bornées), 11 (ordre et
 * causalité), 12 (déterminisme), et les exemples chiffrés du §7.14.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { MusicEvent, Take } from "./types.js";
import { processTake, TakeProcessor } from "./pipeline.js";
import { midiToFreq } from "./music.js";
import {
  frame,
  handLeavesTake,
  leftHandOnlyTake,
  linearTake,
  makeHand,
  poseFromPlay,
  sweepTake,
  tremorTake,
  withDroppedFrames,
  withHand,
} from "./takeGen.js";
import { HARPE, PHANTOM, reglages } from "./instrument-fixtures.js";

/**
 * Les notes entendues, sans répétition.
 *
 * Un thérémine est une voix CONTINUE dont la hauteur glisse (§7.8, glideMs 30) :
 * la liste des notes se lit donc dans les `noteOn` ET dans les contrôles de
 * hauteur, pas seulement dans les `noteOn`. C'est exactement ce que fait
 * `bench events` pour la recette du §18.
 */
function melodie(evenements: readonly MusicEvent[]): readonly number[] {
  const notes: number[] = [];
  for (const e of evenements) {
    const midi = e.type === "noteOn" ? e.midi : e.type === "control" && e.param === "pitch" ? e.value : null;
    if (midi === null) continue;
    if (notes.length === 0 || Math.abs(notes[notes.length - 1]! - midi) > 1e-9) notes.push(midi);
  }
  return notes;
}

function voixRestantes(evenements: readonly MusicEvent[]): Set<string> {
  const actives = new Set<string>();
  for (const e of evenements) {
    if (e.type === "noteOn") actives.add(e.voice);
    if (e.type === "noteOff") actives.delete(e.voice);
  }
  return actives;
}

function voixMax(evenements: readonly MusicEvent[]): number {
  const actives = new Set<string>();
  let max = 0;
  for (const e of evenements) {
    if (e.type === "noteOn") actives.add(e.voice);
    if (e.type === "noteOff") actives.delete(e.voice);
    max = Math.max(max, actives.size);
  }
  return max;
}

const FPS = 30;

function mainHauteur(u: number) {
  return makeHand(poseFromPlay(u, 0.5, { side: "right", scale: 0.08, open: 1, pinch: 1 }));
}

function mainVolume() {
  return makeHand(poseFromPlay(0.5, 0.75, { side: "left", scale: 0.08, open: 1, pinch: 1 }));
}

/**
 * La prise du thérémine (§7.14) : la main de hauteur va de u = 0,30 à u = 0,60
 * en trois secondes, à vitesse constante ; la main de volume reste à v = 0,75.
 * Une queue de 0,4 s à position constante suit le balayage : le filtrage retarde
 * le signal d'environ 80 ms (§7.14), et sans cette queue la dernière transition
 * (fa → sol à 2,917 s) tomberait après la dernière image.
 */
function priseTheremin(debutU = 0.3, finU = 0.6, duree = 3, queue = 0.4): Take {
  const n = Math.round(duree * FPS);
  const m = Math.round(queue * FPS);
  const frames = Array.from({ length: n + m + 1 }, (_, i) => {
    const k = Math.min(i, n) / n;
    const u = debutU + (finU - debutU) * k;
    return frame(i / FPS, [mainHauteur(u), mainVolume()]);
  });
  return { format: "thin-air-take/1", fps: FPS, frames };
}

describe("pipeline — l'exemple du thérémine (§7.14)", () => {
  it("la montée de u = 0,30 à 0,60 donne les huit notes du cahier, dans l'ordre", () => {
    const ev = processTake(priseTheremin(), PHANTOM, { magnet: 1 });
    const notes = melodie(ev);
    // sol, la, si bémol, do dièse, ré, mi, fa, sol — ré mineur harmonique.
    expect(notes).toEqual([55, 57, 58, 61, 62, 64, 65, 67]);
    expect(midiToFreq(55)).toBeCloseTo(196.0, 2);
    expect(midiToFreq(67)).toBeCloseTo(392.0, 2);
  });

  it("les passages de notes tombent aux instants du §7.14, au retard du filtre près", () => {
    const ev = processTake(priseTheremin(), PHANTOM, { magnet: 1 });
    const instants: number[] = [];
    let precedente: number | null = null;
    for (const e of ev) {
      const midi = e.type === "noteOn" ? e.midi : e.type === "control" && e.param === "pitch" ? e.value : null;
      if (midi === null) continue;
      if (precedente === null || Math.abs(midi - precedente) > 1e-9) instants.push(e.t);
      precedente = midi;
    }
    // Instants du signal brut (§7.14) ; le filtrage les retarde d'environ 80 ms.
    const attendus = [0, 0.139, 0.514, 1.153, 1.625, 2.083, 2.458, 2.917];
    expect(instants).toHaveLength(attendus.length);
    instants.forEach((t, i) => {
      const ecart = t - (attendus[i] ?? 0);
      expect(ecart).toBeGreaterThanOrEqual(-2 / FPS); // jamais avant l'image
      expect(ecart).toBeLessThanOrEqual(0.16); // retard du filtre One Euro
    });
  });

  it("toutes les notes sont dans la gamme et dans l'étendue (AIR-P-05)", () => {
    const ev = processTake(priseTheremin(), PHANTOM, { magnet: 1 });
    for (const e of ev) {
      if (e.type !== "noteOn") continue;
      expect(e.midi).toBeGreaterThanOrEqual(PHANTOM.range!.low);
      expect(e.midi).toBeLessThanOrEqual(PHANTOM.range!.high);
      expect(PHANTOM.scale.steps).toContain((e.midi - PHANTOM.scale.root) % 12);
    }
  });

  it("le volume vient de l'autre main : v = 0,75 donne −12 dB", () => {
    const ev = processTake(priseTheremin(), PHANTOM, { magnet: 1 });
    const gains = ev.filter((e) => e.type === "control" && e.param === "gain").map((e) => (e as { value: number }).value);
    expect(gains.length).toBeGreaterThan(0);
    // −12 dB → 0,2512 ; le filtre converge, donc on regarde la fin de la prise.
    expect(gains[gains.length - 1]!).toBeCloseTo(0.2512, 2);
  });

  it("les instants des notes sont croissants et dans la durée de la prise (AIR-P-11)", () => {
    const ev = processTake(priseTheremin(), PHANTOM, { magnet: 1 });
    const instants = ev.filter((e) => e.type === "noteOn").map((e) => e.t);
    for (let i = 1; i < instants.length; i += 1) {
      expect(instants[i]!).toBeGreaterThanOrEqual(instants[i - 1]!);
    }
    expect(instants[0]!).toBeGreaterThanOrEqual(0);
    expect(instants[instants.length - 1]!).toBeLessThan(3.4);
  });
});

describe("pipeline — la harpe (§7.14)", () => {
  it("un balayage traverse les cordes dans l'ordre montant, une note par corde", () => {
    const ev = processTake(sweepTake(0.1, 0.5, { fps: 60, durationS: 0.5 }), HARPE, {});
    const notes = ev.filter((e) => e.type === "noteOn");
    expect(notes.length).toBeGreaterThan(3);
    const voix = notes.map((e) => e.voice);
    expect(new Set(voix).size).toBe(voix.length); // une note par corde, pas de doublon
    const index = voix.map((v) => Number(v.replace("string-", "")));
    expect(index).toEqual([...index].sort((a, b) => a - b)); // balayage montant
    // Les cordes successives suivent la gamme : ré mineur pentatonique.
    const midis = notes.map((e) => (e.type === "noteOn" ? e.midi : 0));
    for (let i = 1; i < midis.length; i += 1) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
  });

  it("la vélocité vient de la vitesse du geste, bornée entre 0,1 et 1", () => {
    const ev = processTake(sweepTake(0.1, 0.5, { fps: 60, durationS: 0.5 }), HARPE, {});
    for (const e of ev) {
      if (e.type !== "noteOn") continue;
      expect(e.velocity).toBeGreaterThanOrEqual(0.1);
      expect(e.velocity).toBeLessThanOrEqual(1);
    }
  });
});

describe("pipeline — AIR-P-09 : aucune note coincée", () => {
  it("la main qui sort en pleine note ne laisse aucune voix active", () => {
    const prise = handLeavesTake(poseFromPlay(0.4, 0.5, { side: "right", scale: 0.08 }), 1, { fps: 30, durationS: 2 });
    const avecVolume = withHand(prise, (t) => (t < 1 ? mainVolume() : null));
    const ev = processTake(avecVolume, PHANTOM, {});
    expect(ev.some((e) => e.type === "noteOn")).toBe(true);
    expect(voixRestantes(ev).size).toBe(0);
  });

  it("toute prise, même trouée, se termine sans voix active", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.double({ min: 0.2, max: 0.8, noNaN: true }),
        (pas, u) => {
          const prise = withDroppedFrames(
            linearTake(poseFromPlay(u, 0.5, { side: "right" }), poseFromPlay(1 - u, 0.5, { side: "right" }), { fps: 30, durationS: 2 }),
            pas,
          );
          const ev = processTake(withHand(prise, () => mainVolume()), PHANTOM, {});
          expect(voixRestantes(ev).size).toBe(0);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("`finish()` ajoute la grâce, le relâchement et l'extinction", () => {
    const prise = linearTake(poseFromPlay(0.3, 0.5, { side: "right" }), poseFromPlay(0.6, 0.5, { side: "right" }), { fps: 30, durationS: 1 });
    const processeur = new TakeProcessor(PHANTOM, reglages());
    for (const image of prise.frames) processeur.push(image);
    const fin = processeur.finish();
    const tous = [...processeur.allEvents];
    expect(voixRestantes(tous).size).toBe(0);
    // Sans `finish`, la note resterait en cours : c'est tout l'intérêt.
    const brut = processTake(prise, PHANTOM, {}, { finish: false });
    expect(voixRestantes(brut).size).toBeGreaterThan(0);
    expect(fin.length).toBeGreaterThanOrEqual(0);
  });
});

describe("pipeline — AIR-P-10, 11, 12", () => {
  it("les voix restent sous le plafond, quelle que soit la prise", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 0.9, noNaN: true }), fc.integer({ min: 1, max: 4 }), (u, duree) => {
        const prise = linearTake(
          poseFromPlay(u, 0.4, { side: "right" }),
          poseFromPlay(1 - u, 0.6, { side: "right" }),
          { fps: 30, durationS: duree },
        );
        const ev = processTake(prise, HARPE, {});
        expect(voixMax(ev)).toBeLessThanOrEqual(Math.min(8, HARPE.voices));
      }),
      { numRuns: 30 },
    );
  });

  it("AIR-P-12 : la même prise et le même instrument donnent la même liste, au bit près", () => {
    const prise = priseTheremin(0.25, 0.7, 2);
    const a = processTake(prise, PHANTOM, { magnet: 1 });
    const b = processTake(prise, PHANTOM, { magnet: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBeGreaterThan(0);
  });

  it("les instants ne décroissent jamais sur toute la chaîne", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.15, max: 0.85, noNaN: true }), (u) => {
        const prise = linearTake(poseFromPlay(u, 0.5, { side: "right" }), poseFromPlay(1 - u, 0.5, { side: "right" }), { fps: 30, durationS: 1 });
        const ev = processTake(withHand(prise, () => mainVolume()), PHANTOM, {});
        let precedent = -Infinity;
        for (const e of ev) {
          expect(e.t).toBeGreaterThanOrEqual(precedent);
          precedent = e.t;
        }
      }),
      { numRuns: 30 },
    );
  });
});

describe("pipeline — tremblement et prises de référence (§13.3)", () => {
  it("un tremblement sous la marge ne fait pas battre la note (AIR-P-06)", () => {
    // Frontière entre sol (55) et la (57) : u ≈ 0,314 avec l'étendue 45..81.
    const prise = tremorTake(poseFromPlay(0.314, 0.5, { side: "right", scale: 0.08 }), 0.002, { fps: 30, durationS: 3, seed: 11 });
    const ev = processTake(withHand(prise, () => mainVolume()), PHANTOM, { magnet: 1 });
    expect(melodie(ev).length).toBeLessThanOrEqual(2);
  });

  it("la prise main gauche seule produit des événements, sans voix coincée", () => {
    const ev = processTake(leftHandOnlyTake({ fps: 30, durationS: 2 }), PHANTOM, {});
    expect(voixRestantes(ev).size).toBe(0);
    expect(ev.every((e) => Number.isFinite(e.t))).toBe(true);
  });

  it("une prise vide ne produit rien et ne casse pas", () => {
    const vide: Take = { format: "thin-air-take/1", fps: 30, frames: [] };
    expect(processTake(vide, PHANTOM, {})).toEqual([]);
  });

  it("les réglages de l'instrument passent au-dessus des défauts, et les réglages appelés au-dessus", () => {
    const prise = priseTheremin(0.3, 0.6, 1);
    const avecAimant = processTake(prise, PHANTOM, { magnet: 1 });
    const sansAimant = processTake(prise, { ...PHANTOM, snap: 0 }, { magnet: 0 });
    // Aimant à 1 : notes entières. Aimant à 0 : hauteurs continues.
    expect(melodie(avecAimant).every((m) => Number.isInteger(m))).toBe(true);
    expect(melodie(sansAimant).some((m) => !Number.isInteger(m))).toBe(true);
  });
});
