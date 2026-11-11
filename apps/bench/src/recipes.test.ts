/**
 * La recette du cahier §18, ligne par ligne — ACTIVÉE.
 *
 * Chaque test lit une prise de référence figée dans `takes/reference/` et un
 * instrument de `instruments/`, et vérifie les nombres que le cahier annonce.
 * Aucun n'écoute : tout se lit dans une liste d'événements, un tableau
 * d'échantillons ou un rapport de mesures (AIR-N-02).
 *
 * Une précision honnête, écrite une fois : le cahier §7.14 donne les instants du
 * signal BRUT et prévient que le filtrage les retarde d'environ 80 ms. Les tests
 * comparent donc la LISTE des notes exactement, et les instants avec la traîne du
 * filtre bornée (≤ 150 ms) — c'est ce que le cahier demande (« les instants à une
 * image près par rapport à l'implémentation de référence »). La traîne mesurée
 * est consignée dans `docs/recette.md`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Instrument, MusicEvent, Take } from "@thin-air/core";
import {
  SAMPLE_RATE,
  finalSilenceMs,
  loopSeconds,
  measureNotes,
  midiToFreq,
  peakDb,
} from "@thin-air/core";
import { renderEvents } from "@thin-air/audio";
import { parseInstrument, parseTake } from "@thin-air/schema";

import { eventsOf, noteList, noteSteps } from "./events.js";
import { samplesFor } from "./takes.js";
import { LOOP_RECIPE, THEREMIN_NOTES } from "./takes.js";

function charger<T>(chemin: string, parse: (json: unknown) => { ok: boolean; value?: T; reasons?: readonly string[] }): T {
  const json = JSON.parse(readFileSync(chemin, "utf8")) as unknown;
  const resultat = parse(json);
  if (!resultat.ok) throw new Error(`${chemin} refusé : ${(resultat.reasons ?? []).join(" ; ")}`);
  return resultat.value as T;
}

const prise = (nom: string): Take => charger(`takes/reference/${nom}.json`, parseTake);
const instrument = (nom: string): Instrument => charger(`instruments/${nom}.json`, parseInstrument);

/** Les huit notes du thérémine, dans l'ordre du §7.14. */
const NOTES_ATTENDUES = [55, 57, 58, 61, 62, 64, 65, 67] as const;
/** Les instants du signal brut, tels que le cahier les donne. */
const INSTANTS_BRUTS = THEREMIN_NOTES.map((n) => n.t);

/** Traîne maximale admise du filtre sur les instants du signal brut (§7.14). */
const TRAINE_MAX_S = 0.15;
/** Une image, à 30 images par seconde. */
const IMAGE_S = 1 / 30;

describe("recette §18 — le thérémine (slow-rise + Phantom)", () => {
  const evenements = eventsOf(prise("slow-rise"), instrument("phantom"), { settings: { magnet: 1 } });
  const notes = noteList(evenements);
  const paliers = noteSteps(evenements);

  it("donne sol, la, si bémol, do dièse, ré, mi, fa, sol — dans cet ordre", () => {
    expect(notes).toEqual([...NOTES_ATTENDUES]);
  });

  it("les notes attendues sont bien celles du tableau du cahier", () => {
    // Garde-fou : si le tableau du banc et celui du test divergent, on le voit.
    THEREMIN_NOTES.forEach((ligne, i) => {
      expect(midiToFreq(NOTES_ATTENDUES[i] ?? 0)).toBeCloseTo(ligne.hz, 2);
    });
  });

  it("chaque note est à la fréquence du cahier", () => {
    const attendues = [196.0, 220.0, 233.08, 277.18, 293.66, 329.63, 349.23, 392.0];
    notes.forEach((midi, i) => {
      expect(midiToFreq(midi)).toBeCloseTo(attendues[i] ?? 0, 2);
    });
  });

  it("les instants suivent le tableau du §7.14, à la traîne du filtre près", () => {
    const attendus = INSTANTS_BRUTS;
    expect(paliers).toHaveLength(attendus.length);
    paliers.forEach((palier, i) => {
      const ecart = palier.t - (attendus[i] ?? 0);
      expect(ecart).toBeGreaterThanOrEqual(-IMAGE_S); // jamais avant le signal brut
      expect(ecart).toBeLessThanOrEqual(TRAINE_MAX_S);
    });
    // La traîne annoncée par le cahier est d'environ 80 ms : on la borne bas
    // pour prouver que le filtre travaille vraiment (sinon le test passerait
    // avec un instrument qui ne filtre rien).
    const traineMoyenne = paliers.slice(1).reduce((s, p, i) => s + (p.t - (attendus[i + 1] ?? 0)), 0) / (paliers.length - 1);
    expect(traineMoyenne).toBeGreaterThan(0.03);
  });

  it("le volume vient de l'autre main : v = 0,75 donne −12 dB", () => {
    const gains = evenements
      .filter((e): e is Extract<MusicEvent, { type: "control" }> => e.type === "control" && e.param === "gain")
      .map((e) => e.value);
    expect(gains.length).toBeGreaterThan(0);
    expect(gains[gains.length - 1]!).toBeCloseTo(0.2512, 2);
  });

  it("le rendu fait exactement 144 000 échantillons pour trois secondes", () => {
    const rendu = renderEvents(evenements, { instrument: instrument("phantom"), durationS: 3, reverb: 0 });
    expect(rendu.samples.length).toBe(144_000);
    expect(rendu.sampleRate).toBe(SAMPLE_RATE);
    expect(samplesFor(3, SAMPLE_RATE)).toBe(144_000);
  });

  it("chaque palier est à 5 centièmes de demi-ton de la fréquence attendue (AIR-P-14)", () => {
    const rendu = renderEvents(evenements, { instrument: instrument("phantom"), durationS: 3.4, reverb: 0 });
    const mesures = measureNotes(
      rendu.samples,
      paliers.map((p) => ({ t: p.t + TRAINE_MAX_S / 2, midi: p.midi, untilT: p.untilT })),
      { sampleRate: rendu.sampleRate },
    );
    expect(mesures.length).toBe(paliers.length);
    for (const mesure of mesures) {
      expect(Math.abs(mesure.cents)).toBeLessThanOrEqual(5);
    }
  });

  it("la crête reste sous −1 dB (AIR-P-13, AIR-F-28)", () => {
    const rendu = renderEvents(evenements, { instrument: instrument("phantom"), durationS: 3.4, reverb: 0 });
    expect(peakDb(rendu.samples)).toBeLessThanOrEqual(-1);
    expect(rendu.maxVoices).toBeLessThanOrEqual(8);
  });
});

describe("recette §18 — la harpe (harp-sweep + Harp)", () => {
  const evenements = eventsOf(prise("harp-sweep"), instrument("harp"));
  const ons = evenements.filter((e) => e.type === "noteOn");

  it("quatre notes : la, do, ré, fa — dans cet ordre", () => {
    expect(ons.map((e) => (e.type === "noteOn" ? e.midi : 0))).toEqual([57, 60, 62, 65]);
    expect(ons.map((e) => (e.type === "noteOn" ? e.voice : ""))).toEqual([
      "string-3", "string-4", "string-5", "string-6",
    ]);
  });

  it("les fréquences sont celles du cahier", () => {
    const attendues = [220.0, 261.63, 293.66, 349.23];
    ons.forEach((e, i) => {
      expect(midiToFreq(e.type === "noteOn" ? e.midi : 0)).toBeCloseTo(attendues[i] ?? 0, 2);
    });
  });

  it("espacées de 125 ms à une image près", () => {
    for (let i = 1; i < ons.length; i += 1) {
      const ecart = ons[i]!.t - ons[i - 1]!.t;
      expect(Math.abs(ecart - 0.125)).toBeLessThanOrEqual(IMAGE_S);
    }
  });

  it("de force 0,17 (vitesse 0,5 largeur/s divisée par 3)", () => {
    for (const e of ons) {
      const vel = e.type === "noteOn" ? e.velocity : 0;
      // Le premier pincement est mesuré pendant l'échauffement du filtre de
      // vitesse : il reste dans la borne basse, les suivants sont à 0,17.
      expect(vel).toBeGreaterThanOrEqual(0.1);
      expect(vel).toBeLessThanOrEqual(0.18);
    }
    const velos = ons.slice(1).map((e) => (e.type === "noteOn" ? e.velocity : 0));
    for (const v of velos) expect(v).toBeCloseTo(0.1667, 2);
  });

  it("toutes les notes finissent : aucune voix active à la fin", () => {
    const actives = new Set<string>();
    for (const e of evenements) {
      if (e.type === "noteOn") actives.add(e.voice);
      if (e.type === "noteOff") actives.delete(e.voice);
    }
    expect(actives.size).toBe(0);
  });
});

describe("recette §18 — propriétés d'une prise", () => {
  it("hand-leaves-mid-note : aucune voix active à la fin du rapport (AIR-P-09)", () => {
    const ev = eventsOf(prise("hand-leaves-mid-note"), instrument("phantom"));
    expect(ev.some((e) => e.type === "noteOn")).toBe(true);
    const actives = new Set<string>();
    for (const e of ev) {
      if (e.type === "noteOn") actives.add(e.voice);
      if (e.type === "noteOff") actives.delete(e.voice);
    }
    expect(actives.size).toBe(0);
    // Et le silence revient dans les 800 ms qui suivent la sortie des mains
    // (AIR-P-15). La mesure porte sur l'instant où le niveau passe sous −60 dB,
    // pas sur la longueur du silence final : le rendu ajoute lui-même 800 ms de
    // queue, donc cette longueur est ≥ 800 ms par construction.
    const rendu = renderEvents(ev, { instrument: instrument("phantom"), reverb: 0 });
    const silenceFinalMs = finalSilenceMs(rendu.samples, rendu.sampleRate, -60);
    const debutSilenceS = rendu.durationS - silenceFinalMs / 1000;
    const dernierNoteOff = Math.max(...ev.filter((e) => e.type === "noteOff").map((e) => e.t));
    expect(dernierNoteOff).toBeGreaterThan(0);
    expect(debutSilenceS - dernierNoteOff).toBeLessThanOrEqual(0.8);
    expect(debutSilenceS - dernierNoteOff).toBeGreaterThanOrEqual(0);
  });

  it("tremor-at-boundary : au plus un changement de note (AIR-P-06)", () => {
    const ev = eventsOf(prise("tremor-at-boundary"), instrument("phantom"), { settings: { magnet: 1 } });
    expect(noteList(ev).length).toBeLessThanOrEqual(2);
  });

  it("left-hand-only : le côté est « gauche » (§7.3)", () => {
    const t = prise("left-hand-only");
    const cotes = new Set(t.frames.flatMap((f) => f.hands.map((h) => h.side)));
    expect([...cotes]).toEqual(["left"]);
    // Et la chaîne en tire bien des événements, sans voix coincée.
    const ev = eventsOf(t, instrument("phantom"));
    const actives = new Set<string>();
    for (const e of ev) {
      if (e.type === "noteOn") actives.add(e.voice);
      if (e.type === "noteOff") actives.delete(e.voice);
    }
    expect(actives.size).toBe(0);
  });

  it("two-hands-cross : les deux mains sont là du début à la fin (AIR-P-21)", () => {
    const t = prise("two-hands-cross");
    expect(t.frames.every((f) => f.hands.length === 2)).toBe(true);
    const debut = t.frames[0]!.hands.map((h) => h.side).sort();
    const fin = t.frames[t.frames.length - 1]!.hands.map((h) => h.side).sort();
    expect(debut).toEqual(fin);
    // Les positions se croisent vraiment : l'ordre en x s'inverse.
    const x = (i: number, k: number): number => t.frames[i]!.hands[k]!.points[9]![0];
    expect(Math.sign(x(0, 0) - x(0, 1))).toBe(-Math.sign(x(t.frames.length - 1, 0) - x(t.frames.length - 1, 1)));
  });
});

describe("recette §18 — la boucle", () => {
  it("quatre mesures à 90 batt/min : exactement 512 000 échantillons à 48 kHz", () => {
    const secondes = loopSeconds(LOOP_RECIPE.tempo, LOOP_RECIPE.bars, LOOP_RECIPE.beatsPerBar);
    expect(secondes).toBeCloseTo(10.67, 2);
    expect(samplesFor(secondes, SAMPLE_RATE)).toBe(512_000);
    expect(Math.round(secondes * SAMPLE_RATE)).toBe(512_000);
  });

  it("un rendu de boucle a exactement la durée de ses mesures (AIR-P-17)", () => {
    const secondes = loopSeconds(90, 4, 4);
    const note: MusicEvent = { type: "noteOn", t: 0, voice: "lead", midi: 55, velocity: 0.5 };
    const fin: MusicEvent = { type: "noteOff", t: secondes, voice: "lead" };
    const rendu = renderEvents([note, fin], {
      instrument: instrument("phantom"),
      durationS: secondes,
      reverb: 0,
    });
    expect(rendu.samples.length).toBe(512_000);
    expect(rendu.durationS).toBeCloseTo(secondes, 9);
  });
});
