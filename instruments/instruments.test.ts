/**
 * Les six instruments-fichiers (cahier §7.8, annexe B ; AIR-F-21, 22, 23, 43).
 *
 * Un instrument est un fichier : ce banc lit les JSON de `instruments/` et
 * vérifie les chiffres du cahier. Il ne fait rien sonner (AIR-N-02) : la
 * preuve est un nombre, une clé, une formule.
 *
 * Les formules de §7.7 sont recopiées ici parce que leur implémentation est
 * le lot A3 (`packages/core/src/music.ts`, encore un squelette) : ce banc
 * épingle les nombres du cahier, l'implémentation devra les reproduire.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Instrument } from "@thin-air/core";

const DOSSIER = fileURLToPath(new URL(".", import.meta.url));
const SIX = ["phantom", "harp", "choir", "bells", "drone", "grid-drums"];
const FORMAT = "thin-air-instrument/1";

function lire(nom: string): Instrument {
  return JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8")) as Instrument;
}

/** §7.7 : f = 440 × 2^((m − 69) / 12). */
function frequence(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** §7.7 : le degré k donne root + 12 × ⌊k / n⌋ + steps[k mod n]. */
function degreVersMidi(root: number, steps: readonly number[], degre: number): number {
  return root + 12 * Math.floor(degre / steps.length) + (steps[degre % steps.length] ?? 0);
}

/** §7.7 : hauteur continue m(u) = low + (high − low) × u. */
function hauteurContinue(u: number, low: number, high: number): number {
  return low + (high - low) * u;
}

describe("les six instruments existent et portent le format", () => {
  it.each(SIX)("%s.json se lit et porte « thin-air-instrument/1 »", (nom) => {
    const instrument = lire(nom);
    expect(instrument.format).toBe(FORMAT);
    expect(instrument.name.length).toBeGreaterThan(0);
  });

  it("AIR-F-21/22/23 — les six fichiers du §7.8 sont là, pas un de plus", () => {
    const presents = readdirSync(DOSSIER)
      .filter((nom) => nom.endsWith(".json"))
      .map((nom) => nom.replace(/\.json$/, ""))
      .sort();
    expect(presents).toEqual([...SIX].sort());
  });

  it.each(SIX)("AIR-F-27 — %s ne dépasse pas maxVoices (8, §7.13)", (nom) => {
    expect(lire(nom).voices).toBeLessThanOrEqual(8);
    expect(lire(nom).voices).toBeGreaterThanOrEqual(1);
  });

  it.each(SIX)("%s — aimant entre 0 et 1, pointeur connu", (nom) => {
    const instrument = lire(nom);
    expect(instrument.snap).toBeGreaterThanOrEqual(0);
    expect(instrument.snap).toBeLessThanOrEqual(1);
    expect(["index", "palm"]).toContain(instrument.pointer);
  });
});

describe("Phantom — le thérémine (§7.8, §7.14, §11.4)", () => {
  const phantom = lire("phantom");

  it("gamme ré mineur harmonique, fondamentale ré 3 (50)", () => {
    expect(phantom.scale).toEqual({ root: 50, steps: [0, 2, 3, 5, 7, 8, 11] });
  });

  it("étendue 45 à 81 : 110 Hz à 880 Hz, trois octaves", () => {
    expect(phantom.range).toEqual({ low: 45, high: 81 });
    expect(frequence(45)).toBeCloseTo(110, 2);
    expect(frequence(81)).toBeCloseTo(880, 2);
  });

  it("§7.14 — un quart, la moitié, les trois quarts de la largeur", () => {
    const { low, high } = phantom.range!;
    expect(frequence(hauteurContinue(0.25, low, high))).toBeCloseTo(185.0, 1);
    expect(frequence(hauteurContinue(0.5, low, high))).toBeCloseTo(311.13, 1);
    expect(frequence(hauteurContinue(0.75, low, high))).toBeCloseTo(523.25, 1);
  });

  it("aimant à 0,6, une seule voix, pointeur paume", () => {
    expect(phantom.snap).toBe(0.6);
    expect(phantom.voices).toBe(1);
    expect(phantom.pointer).toBe("palm");
  });

  it("la main de hauteur choisit la note par u, la main de volume règle le gain en dB48", () => {
    expect(phantom.controls).toContainEqual({ hand: "pitch", feature: "u", to: "pitch" });
    expect(phantom.controls).toContainEqual({ hand: "volume", feature: "v", to: "gain", curve: "db48" });
  });

  it("pincer la main de hauteur ajoute du vibrato, de 0 à 40 centièmes", () => {
    const vibrato = phantom.controls?.find((carte) => carte.to === "vibrato");
    expect(vibrato).toEqual({ hand: "pitch", feature: "pinch", to: "vibrato", from: [0.4, 0.1], into: [0, 40] });
  });

  it("le poing de la main de volume coupe le son", () => {
    expect(phantom.gestures).toEqual([{ hand: "volume", gesture: "fist", do: "mute" }]);
  });

  it("AIR-F-10 — à une main : u pour la hauteur, open pour le volume", () => {
    expect(phantom.oneHand).toEqual([
      { feature: "u", to: "pitch" },
      { feature: "open", to: "gain", curve: "db48" },
    ]);
  });

  it("son : sinusoïde, harmonique 2 à 0,15, attaque 60 ms, extinction 250 ms, glissement 30 ms", () => {
    expect(phantom.sound).toEqual({
      engine: "osc",
      wave: "sine",
      second: 0.15,
      attackMs: 60,
      releaseMs: 250,
      glideMs: 30,
    });
  });
});

describe("Harp — seize cordes pincées (§7.8, §7.14, annexe B)", () => {
  const harp = lire("harp");
  const cordes = harp.strings!.count;

  it("ré mineur pentatonique, pointeur index, seize cordes sur l'axe u", () => {
    expect(harp.scale).toEqual({ root: 50, steps: [0, 3, 5, 7, 10] });
    expect(harp.pointer).toBe("index");
    expect(harp.strings).toEqual({ count: 16, axis: "u" });
  });

  it("trois octaves : du ré 146,83 Hz au ré 1 174,66 Hz", () => {
    const { root, steps } = harp.scale;
    expect(frequence(degreVersMidi(root, steps, 0))).toBeCloseTo(146.83, 2);
    expect(frequence(degreVersMidi(root, steps, cordes - 1))).toBeCloseTo(1174.66, 2);
  });

  it("§7.14 — la corde i est à u = (i + 0,5) / 16", () => {
    const positions = [3, 4, 5, 6].map((i) => (i + 0.5) / cordes);
    expect(positions.map((u) => Number(u.toFixed(3)))).toEqual([0.219, 0.281, 0.344, 0.406]);
  });

  it("§7.14 — cordes 3, 4, 5, 6 : la 220, do 261,63, ré 293,66, fa 349,23", () => {
    const { root, steps } = harp.scale;
    const attendues = [220.0, 261.63, 293.66, 349.23];
    const obtenues = [3, 4, 5, 6].map((i) => frequence(degreVersMidi(root, steps, i)));
    obtenues.forEach((hz, index) => expect(hz).toBeCloseTo(attendues[index]!, 2));
  });

  it("§7.14 — balayage de u = 0,20 à 0,45 en 0,5 s : quatre notes à 125 ms", () => {
    const instants = [3, 4, 5, 6].map((i) => ((i + 0.5) / cordes - 0.2) / 0.5);
    // Le tableau du §7.14 donne 0,038 / 0,163 / 0,288 / 0,413 s, à la
    // milliseconde : le calcul exact tombe sur 0,0375 s, arrondi au-dessus.
    [0.038, 0.163, 0.288, 0.413].forEach((attendu, index) => {
      expect(instants[index]!).toBeCloseTo(attendu, 2);
    });
    const ecarts = instants.slice(1).map((t, index) => (t - instants[index]!) * 1000);
    ecarts.forEach((ms) => expect(ms).toBeCloseTo(125, 1));
  });

  it("§7.6 — la force vient de la vitesse : 0,5 largeur/s donne 0,17", () => {
    expect(Math.min(1, Math.max(0.1, 0.5 / 3))).toBeCloseTo(0.17, 2);
  });

  it("traversée → pincement avec la vitesse ; pince → étouffement", () => {
    expect(harp.gestures).toEqual([
      { hand: "any", gesture: "cross", do: "pluck", velocity: "speed" },
      { hand: "any", gesture: "pinch", do: "damp" },
    ]);
  });

  it("son : corde pincée, coefficient 0,996, brillance sur v de 0,2 à 0,9", () => {
    expect(harp.sound).toEqual({
      engine: "pluck",
      decay: 0.996,
      brightness: { feature: "v", into: [0.2, 0.9] },
    });
  });
});

describe("Choir — huit zones tenues (§7.8, AIR-F-12)", () => {
  const choir = lire("choir");

  it("huit zones, deux mains donc deux voix", () => {
    expect(choir.zones!.zones).toHaveLength(8);
    expect(choir.voices).toBe(2);
  });

  it("les zones couvrent la zone de jeu sans trou ni chevauchement", () => {
    const zones = choir.zones!.zones;
    expect(zones.map((zone) => zone.id)).toEqual(["z0", "z1", "z2", "z3", "z4", "z5", "z6", "z7"]);
    expect(zones.map((zone) => zone.degree)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const zone of zones) {
      expect(zone.u1 - zone.u0).toBeCloseTo(0.25, 6);
      expect(zone.v1 - zone.v0).toBeCloseTo(0.5, 6);
    }
  });

  it("l'ouverture de la main règle la brillance (coupure du filtre)", () => {
    expect(choir.controls).toEqual([{ feature: "open", to: "cutoff" }]);
  });

  it("maintien : 400 ms dans une zone verrouille la note (§7.13 dwellMs)", () => {
    expect(choir.gestures).toEqual([{ hand: "any", gesture: "dwell", do: "hold", value: 400 }]);
    expect(choir.defaults).toEqual({ dwellMs: 400 });
  });

  it("son : dents de scie désaccordées de 7 centièmes, attaque 300 ms, extinction 800 ms", () => {
    expect(choir.sound).toEqual({
      engine: "osc",
      wave: "sawtooth",
      detuneCents: 7,
      attackMs: 300,
      releaseMs: 800,
    });
  });
});

describe("Bells, Drone, Grid drums (§7.8)", () => {
  const bells = lire("bells");
  const drone = lire("drone");
  const drums = lire("grid-drums");

  it("Bells — quatre zones frappées par un passage, modulation de fréquence, longue résonance", () => {
    expect(bells.zones!.zones).toHaveLength(4);
    expect(bells.gestures).toEqual([{ hand: "any", gesture: "cross", do: "strike" }]);
    expect(bells.sound.engine).toBe("fm");
    expect(bells.sound.fmRatio).toBeGreaterThan(0);
    expect(bells.sound.fmIndex).toBeGreaterThan(0);
    expect(bells.sound.releaseMs).toBeGreaterThanOrEqual(3000);
  });

  it("Drone — quatre notes graves tenues, deux oscillateurs désaccordés", () => {
    const { root, steps } = drone.scale;
    const notes = [0, 1, 2, 3].map((degre) => degreVersMidi(root, steps, degre));
    expect(notes).toEqual([33, 36, 40, 43]);
    expect(frequence(33)).toBeCloseTo(55, 2);
    expect(frequence(43)).toBeCloseTo(98, 2);
    expect(drone.range).toEqual({ low: 33, high: 44 });
    expect(drone.sound.engine).toBe("osc");
    expect(drone.sound.detuneCents).toBeGreaterThan(0);
    expect(drone.controls).toEqual([{ feature: "u", to: "pitch" }]);
  });

  it("Drone — la quatrième note de l'étendue reste dans la gamme (AIR-P-05)", () => {
    const { root, steps } = drone.scale;
    const haute = degreVersMidi(root, steps, 3);
    expect(steps).toContain(haute - root);
    expect(haute).toBeLessThanOrEqual(drone.range!.high);
  });

  it("Grid drums — quatre zones, bruit et corps sinusoïdal, frappes sur la grille", () => {
    expect(drums.zones!.zones).toHaveLength(4);
    expect(drums.sound.engine).toBe("drum");
    expect(drums.sound.noiseMs).toBeGreaterThan(0);
    expect(drums.sound.toneHz).toBeGreaterThan(0);
    expect(drums.gestures).toEqual([{ hand: "any", gesture: "cross", do: "strike", velocity: "speed" }]);
  });

  it("Grid drums — les frappes sont replacées sur la grille (§7.10, §7.13)", () => {
    expect(drums.defaults).toEqual({ quantize: "sixteenth", quantizeStrength: 100 });
  });
});

describe("ce qui dépend d'un autre lot", () => {
  it.todo("AIR-P-19 — le schéma Zod accepte les six fichiers et refuse un fichier altéré — dépend du lot A4 (packages/schema)");
  it.todo("AIR-P-04 — midiToFreq donne 440 Hz pour la note 69 — dépend du lot A3 (packages/core/src/music.ts)");
  it.todo("AIR-P-05 — avec l'aimant à 1, toute note émise est dans la gamme de l'instrument — dépend du lot A3");
  it.todo("AIR-P-03 — la hauteur est monotone en u pour Phantom et Drone — dépend du lot A3");
});
