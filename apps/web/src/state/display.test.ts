import { describe, expect, it } from "vitest";
import type { MusicEvent } from "@thin-air/core";
import { CHOIR, HARP, PHANTOM } from "./presets.js";
import {
  coreTools,
  emptyDisplay,
  PITCH_TRACE,
  reduceDisplay,
  stringForMidi,
  zoneForNote,
  sameDisplay,
  type MusicTools,
} from "./display.js";

/** Double de la musique du lot A3 : les tests n'attendent aucun corps livré. */
const outils: MusicTools = {
  noteName: (midi) => `note-${midi}`,
  midiToFreq: (midi) => midi * 2,
  gainToDb: (gain) => (gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY),
};

const noteOn = (voice: string, midi: number): MusicEvent => ({ type: "noteOn", t: 0, voice, midi, velocity: 0.8 });
const noteOff = (voice: string): MusicEvent => ({ type: "noteOff", t: 0, voice });
const gain = (value: number): MusicEvent => ({ type: "control", t: 0, voice: "v", param: "gain", value });

describe("réduction des événements vers l'affichage (AIR-F-51)", () => {
  it("rien ne sonne : l'affichage reste vide", () => {
    const affichage = reduceDisplay(emptyDisplay(), [], PHANTOM, outils);
    expect(affichage.midi).toBeNull();
    expect(affichage.voices).toBe(0);
    expect(affichage.note).toBe("");
  });

  it("une note : le nom et la fréquence viennent de la musique injectée", () => {
    const affichage = reduceDisplay(emptyDisplay(), [noteOn("v1", 62)], PHANTOM, outils);
    expect(affichage.midi).toBe(62);
    expect(affichage.note).toBe("note-62");
    expect(affichage.frequencyHz).toBe(124);
    expect(affichage.voices).toBe(1);
  });

  it("deux voix : la dernière note est celle affichée, les deux comptent", () => {
    const affichage = reduceDisplay(emptyDisplay(), [noteOn("v1", 50), noteOn("v2", 74)], CHOIR, outils);
    expect(affichage.midi).toBe(74);
    expect(affichage.voices).toBe(2);
  });

  it("note relâchée : plus aucune voix, plus aucune zone allumée", () => {
    const premier = reduceDisplay(emptyDisplay(), [noteOn("z0", 50)], CHOIR, outils);
    expect(premier.voices).toBe(1);
    const second = reduceDisplay(premier, [noteOff("z0")], CHOIR, outils);
    expect(second.voices).toBe(0);
    expect(second.midi).toBeNull();
    expect(second.litZones).toEqual([]);
  });

  it("chœur : la bougie s'allume dans la zone que la voix nomme", () => {
    const affichage = reduceDisplay(emptyDisplay(), [noteOn("z3", 57)], CHOIR, outils);
    expect(affichage.litZones).toEqual([3]);
  });

  it("harpe : la corde vibrante suit la place de la note dans l'étendue", () => {
    const affichage = reduceDisplay(emptyDisplay(), [noteOn("s8", 68)], HARP, outils);
    expect(affichage.pluckedStrings.length).toBe(1);
    expect(affichage.pluckedStrings[0]).toBe(stringForMidi(HARP, 68));
  });

  it("le gain suit les contrôleurs, borné entre 0 et 1", () => {
    const affichage = reduceDisplay(emptyDisplay(), [noteOn("v1", 60), gain(0.5)], PHANTOM, outils);
    expect(affichage.gain).toBe(0.5);
    expect(affichage.gainDb).toBeCloseTo(-6.02, 1);
    expect(reduceDisplay(affichage, [gain(4)], PHANTOM, outils).gain).toBe(1);
    expect(reduceDisplay(affichage, [gain(-2)], PHANTOM, outils).gain).toBe(0);
  });

  it("gain nul : aucun décibel affiché, la jauge reste à zéro", () => {
    const affichage = reduceDisplay(emptyDisplay(), [gain(0)], PHANTOM, outils);
    expect(affichage.gainDb).toBeNull();
  });

  it("la courbe de hauteur garde les dernières notes, et pas plus", () => {
    let affichage = emptyDisplay();
    for (let index = 0; index < PITCH_TRACE + 20; index += 1) {
      affichage = reduceDisplay(affichage, [noteOn(`v${index}`, 40 + index)], PHANTOM, outils);
    }
    expect(affichage.pitchTrace.length).toBe(PITCH_TRACE);
    expect(affichage.pitchTrace[PITCH_TRACE - 1]).toBe(40 + PITCH_TRACE + 19);
  });

  it("zone retrouvée par sa note absolue quand la voix ne la nomme pas", () => {
    const avecMidi = { ...CHOIR, zones: { zones: [{ id: "autre", u0: 0, u1: 1, v0: 0, v1: 1, midi: 55 }] } };
    expect(zoneForNote(avecMidi, "v1", 55)).toBe(0);
    expect(zoneForNote(avecMidi, "v1", 60)).toBeNull();
    expect(zoneForNote(PHANTOM, "v1", 60)).toBeNull();
  });

  it("sans étendue, aucune corde n'est calculée", () => {
    expect(stringForMidi(CHOIR, 60)).toBeNull();
    expect(stringForMidi({ ...HARP, range: undefined }, 60)).toBeNull();
  });

  it("deux affichages identiques se reconnaissent (rien à redessiner)", () => {
    const a = reduceDisplay(emptyDisplay(), [noteOn("v1", 60)], PHANTOM, outils);
    const b = reduceDisplay(emptyDisplay(), [noteOn("v1", 60)], PHANTOM, outils);
    expect(sameDisplay(a, b)).toBe(true);
    expect(sameDisplay(a, reduceDisplay(a, [noteOn("v2", 61)], PHANTOM, outils))).toBe(false);
  });

  it("les outils par défaut dégradent sans exception tant que le lot A3 est vide", () => {
    const affichage = reduceDisplay(emptyDisplay(), [noteOn("v1", 62)], PHANTOM, coreTools);
    expect(affichage.midi).toBe(62);
    expect(typeof affichage.note).toBe("string");
  });

  it.todo("AIR-P-03 — la note affichée suit la hauteur de la main — dépend du lot A3 (music)");
});
