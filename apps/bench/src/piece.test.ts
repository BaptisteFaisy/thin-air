/**
 * La pièce de démonstration, mesurée (cahier §7.10, §17.1, recette §18).
 * Aucun son émis (AIR-N-02) : tout se lit dans des tableaux d'échantillons et
 * des nombres. Le rendu complet (6 tours) vit dans `npx tsx apps/bench/src/piece.ts` ;
 * les tests rendent un seul tour pour rester rapides — les propriétés mesurées
 * sont les mêmes à chaque tour.
 */
import { describe, expect, it } from "vitest";
import { SAMPLE_RATE, loopSamples } from "@thin-air/core";
import { parseSession } from "@thin-air/schema";
import { encodeWav } from "@thin-air/audio";

import { readJsonFile } from "./io.js";
import {
  PIECE_PATH,
  RELACHEMENT_FIN_S,
  derouleCouche,
  dureePieceS,
  instrumentDe,
  maxVoicesSimultanees,
  notesParCouche,
  pieceSession,
  renderPiece,
} from "./piece.js";

const session = pieceSession();
const unTour = renderPiece(session, 1);

describe("la session de la pièce (takes/pieces/seance-1min.json)", () => {
  it("est acceptée en entier par parseSession", () => {
    const brut: unknown = readJsonFile(PIECE_PATH);
    expect(parseSession(brut).ok).toBe(true);
  });

  it("tempo 90, 4 mesures, 4 temps — la boucle de la recette §18", () => {
    expect(session.tempo).toBe(90);
    expect(session.bars).toBe(4);
    expect(session.beatsPerBar).toBe(4);
    expect(loopSamples(session.tempo, session.bars, session.beatsPerBar)).toBe(512_000);
  });

  it("quatre couches nommées d'après des instruments existants", () => {
    expect(session.layers).toHaveLength(4);
    for (const couche of session.layers) {
      expect(instrumentDe(couche.instrument).name.length).toBeGreaterThan(0);
    }
    expect(session.layers.map((couche) => couche.instrument).sort()).toEqual([
      "choir",
      "drone",
      "harp",
      "phantom",
    ]);
  });

  it("les notes par couche sont celles de la partition", () => {
    expect(notesParCouche(session)).toEqual([
      ["choir", 8],
      ["drone", 3],
      ["harp", 16],
      ["phantom", 15],
    ]);
  });
});

describe("le rendu hors ligne de la pièce", () => {
  it("un tour de boucle fait exactement 512 000 échantillons à 48 000 Hz", () => {
    expect(unTour.sampleRate).toBe(SAMPLE_RATE);
    expect(unTour.echantillons).toBe(512_000);
    expect(unTour.dureeS).toBeCloseTo(512_000 / SAMPLE_RATE, 9);
  });

  it("six tours font environ une minute : 3 072 000 échantillons, 64 s", () => {
    expect(dureePieceS(session, 6)).toBe(64);
  });

  it("AIR-P-13 — la crête reste sous le plafond de −1 dB", () => {
    expect(unTour.peakDb).toBeLessThanOrEqual(-1);
    expect(Number.isFinite(unTour.peakDb)).toBe(true);
  });

  it("les voix simultanées restent dans la borne du §7.9 (8 au plus)", () => {
    expect(unTour.maxVoices).toBeGreaterThan(0);
    expect(unTour.maxVoices).toBeLessThanOrEqual(session.settings.maxVoices);
    expect(maxVoicesSimultanees(session, dureePieceS(session, 6))).toBe(unTour.maxVoices);
  });

  it("AIR-N-09 — deux rendus donnent les mêmes échantillons, bit à bit", () => {
    const autre = renderPiece(session, 1);
    expect(autre.echantillons).toBe(unTour.echantillons);
    for (let i = 0; i < unTour.samples.length; i += 997) {
      expect(autre.samples[i]).toBe(unTour.samples[i]);
    }
  });

  it("chaque événement de la boucle rejoue exactement une fois par tour", () => {
    const drone = session.layers.find((couche) => couche.instrument === "drone");
    expect(drone).toBeDefined();
    const deroule = derouleCouche(session, drone!, dureePieceS(session, 6));
    const attaques = deroule.filter((event) => event.type === "noteOn");
    expect(attaques).toHaveLength(3 * 6);
    // Le relâchement final ajoute une extinction par voix, avant la fin du rendu.
    const fins = deroule.filter((event) => event.type === "noteOff");
    expect(fins.every((event) => event.t === dureePieceS(session, 6) - RELACHEMENT_FIN_S)).toBe(
      true,
    );
    expect(fins.length).toBeGreaterThan(0);
  });

  it("le WAV écrit est un RIFF 16 bits mono de la bonne taille", () => {
    const octets = encodeWav(unTour.samples, unTour.sampleRate);
    expect(octets.byteLength).toBe(44 + 2 * unTour.echantillons);
    const texte = (debut: number, longueur: number): string =>
      String.fromCharCode(...octets.slice(debut, debut + longueur));
    expect(texte(0, 4)).toBe("RIFF");
    expect(texte(8, 4)).toBe("WAVE");
  });
});
