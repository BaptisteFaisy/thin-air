/**
 * Les instruments livrés (cahier §7.8, AIR-F-21, AIR-F-22), comme données.
 * Un instrument est un fichier : ces objets ont exactement la forme du
 * contrat `Instrument` de `@thin-air/core`, et le tiroir les traite comme
 * ceux qu'un utilisateur importe ou duplique.
 */
import type { Instrument } from "@thin-air/core";

/** Phantom : le thérémine, ré mineur harmonique, 110 à 880 Hz (§7.8). */
export const PHANTOM: Instrument = {
  format: "thin-air-instrument/1",
  name: "Phantom",
  pointer: "palm",
  scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 11] },
  range: { low: 45, high: 81 },
  snap: 0.6,
  voices: 1,
  controls: [
    { hand: "pitch", feature: "u", to: "pitch" },
    { hand: "volume", feature: "v", to: "gain", curve: "db48" },
    { hand: "pitch", feature: "pinch", to: "vibrato", from: [0.4, 0.1], into: [0, 40] },
  ],
  gestures: [{ hand: "volume", gesture: "fist", do: "mute" }],
  oneHand: [
    { feature: "u", to: "pitch" },
    { feature: "open", to: "gain", curve: "db48" },
  ],
  sound: { engine: "osc", wave: "sine", second: 0.15, attackMs: 60, releaseMs: 250, glideMs: 30 },
};

/** Harp : seize cordes verticales, ré mineur pentatonique sur trois octaves. */
export const HARP: Instrument = {
  format: "thin-air-instrument/1",
  name: "Harp",
  pointer: "index",
  scale: { root: 50, steps: [0, 3, 5, 7, 10] },
  strings: { count: 16, axis: "u" },
  range: { low: 50, high: 86 },
  snap: 1,
  voices: 4,
  gestures: [
    { hand: "any", gesture: "cross", do: "pluck", velocity: "speed" },
    { hand: "any", gesture: "pinch", do: "damp" },
  ],
  sound: { engine: "pluck", decay: 0.996, brightness: { feature: "v", into: [0.2, 0.9] } },
};

/** Choir : huit zones tenues, une bougie par zone (§12.3). */
function zones(count: number): Instrument["zones"] {
  const colonnes = 4;
  const liste = Array.from({ length: count }, (_, index) => {
    const colonne = index % colonnes;
    const ligne = Math.floor(index / colonnes);
    const largeur = 1 / colonnes;
    return {
      id: `z${index}`,
      u0: colonne * largeur,
      u1: (colonne + 1) * largeur,
      v0: ligne * 0.5,
      v1: (ligne + 1) * 0.5,
      degree: index,
    };
  });
  return { zones: liste };
}

export const CHOIR: Instrument = {
  format: "thin-air-instrument/1",
  name: "Choir",
  pointer: "palm",
  scale: { root: 50, steps: [0, 2, 3, 5, 7, 8, 10] },
  zones: zones(8),
  snap: 1,
  voices: 2,
  controls: [{ hand: "pitch", feature: "open", to: "cutoff" }],
  gestures: [{ hand: "any", gesture: "dwell", do: "hold" }],
  oneHand: [{ feature: "u", to: "pitch" }],
  sound: { engine: "osc", wave: "sawtooth", detuneCents: 8, attackMs: 300, releaseMs: 800 },
};

/** Bells : zones frappées par un passage vers le bas. */
export const BELLS: Instrument = {
  format: "thin-air-instrument/1",
  name: "Bells",
  pointer: "index",
  scale: { root: 62, steps: [0, 2, 4, 7, 9] },
  zones: zones(4),
  snap: 1,
  voices: 3,
  gestures: [{ hand: "any", gesture: "cross", do: "strike", velocity: "speed" }],
  sound: { engine: "fm", fmRatio: 3.5, fmIndex: 4, attackMs: 5, releaseMs: 1800 },
};

/** Drone : quatre notes graves tenues, choisies par la hauteur de la main. */
export const DRONE: Instrument = {
  format: "thin-air-instrument/1",
  name: "Drone",
  pointer: "palm",
  scale: { root: 38, steps: [0, 7] },
  range: { low: 33, high: 45 },
  snap: 1,
  voices: 2,
  controls: [{ hand: "pitch", feature: "u", to: "pitch" }],
  oneHand: [{ feature: "u", to: "pitch" }],
  sound: { engine: "osc", wave: "triangle", detuneCents: 5, attackMs: 400, releaseMs: 900 },
};

/** Le tiroir « livrés », dans l'ordre du cahier : indispensables puis souhaitables. */
export const BUILT_IN: readonly Instrument[] = [PHANTOM, HARP, CHOIR, BELLS, DRONE];

export function builtInByName(name: string): Instrument | null {
  return BUILT_IN.find((instrument) => instrument.name === name) ?? null;
}
