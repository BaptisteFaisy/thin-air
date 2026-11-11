/**
 * Outillage partagé du fuzz nocturne et du budget de performance (lot t6).
 *
 * Rien ici n'ouvre de périphérique audio (AIR-N-02) : la chaîne est
 * `processTake` (événements) puis `renderEvents` (tableau d'échantillons),
 * exactement comme le banc d'essai. Tout est déterministe : le seul générateur
 * aléatoire est `alea(graine)` de `@thin-air/core` (mulberry32), jamais
 * `Math.random` (AIR-N-09).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Instrument, MusicEvent, Settings, Take } from "@thin-air/core";
import { DEFAULT_SETTINGS, withSettings } from "@thin-air/core";
import { linearTake, poseFromPlay } from "@thin-air/core";

/** Racine du dépôt, retrouvée depuis ce fichier (scripts/lib/ → ../..). */
export function racineDepot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** Un tirage dans une liste, deterministe via `rng`. */
export function choisir<T>(rng: () => number, liste: readonly T[]): T {
  return liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))]!;
}

/** Un réel dans [min, max[, déterministe via `rng`. */
export function reel(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Les instruments du dépôt (`instruments/*.json`), triés par nom. */
export function listerInstruments(): readonly string[] {
  const dossier = join(racineDepot(), "instruments");
  return readdirSync(dossier)
    .filter((nom) => nom.endsWith(".json"))
    .sort()
    .map((nom) => join("instruments", nom));
}

/** Charge un instrument `thin-air-instrument/1` (fichier du dépôt, déjà validé par la garde). */
export function chargerInstrument(cheminRelatif: string): Instrument {
  const brut = readFileSync(join(racineDepot(), cheminRelatif), "utf8");
  return JSON.parse(brut) as Instrument;
}

/**
 * Plafond de voix effectif d'un instrument : `instrument.ts` borne le
 * réservoir à `min(settings.maxVoices, instrument.voices)` (AIR-P-10).
 */
export function plafondVoix(instrument: Instrument, reglages: Partial<Settings>): number {
  const effectifs = withSettings({ ...instrument.defaults, ...reglages });
  return Math.min(effectifs.maxVoices, instrument.voices);
}

/** Réglages partiels aléatoires : les leviers qui changent le comportement. */
export function reglagesAleatoires(rng: () => number): Partial<Settings> {
  return {
    magnet: choisir<number | null>(rng, [null, 0, 0.5, 1]),
    oneHand: rng() < 0.15,
    hold: rng() < 0.15,
    leftHanded: rng() < 0.2,
    graceMs: choisir(rng, [0, 150, 400]),
  };
}

/** Options de rendu aléatoires (le plafond −1 dB reste celui des défauts). */
export function optionsRenduAleatoires(rng: () => number): { reverb: number; maxVoices: number } {
  return {
    reverb: choisir(rng, [0, DEFAULT_SETTINGS.reverb, 0.6]),
    maxVoices: choisir(rng, [2, DEFAULT_SETTINGS.maxVoices, DEFAULT_SETTINGS.maxVoices]),
  };
}

/**
 * La prise de référence du budget de performance : 3 s à 30 im/s, une main de
 * hauteur qui traverse la zone, une main de volume fixe — le cas d'usage
 * courant du thérémine (§7.14). Rendu à 48 kHz (`SAMPLE_RATE`).
 */
export function priseDeReference(): Take {
  const pose = { scale: 0.1, open: 1, pinch: 0.8, side: "right" as const };
  return linearTake(poseFromPlay(0.2, 0.5, pose), poseFromPlay(0.8, 0.5, pose), {
    fps: 30,
    durationS: 3,
  });
}

/** La main de volume de la prise de référence (v fixe). */
export function mainVolumeDeReference(): { x: number; y: number; side: "left"; open: number } {
  return { ...poseFromPlay(0.5, 0.75, { side: "left", open: 0.9 }), open: 0.9, side: "left" };
}

/** Les arguments du fuzz : `--runs N --seed S` (défauts : 100 et 1). */
export function lireArgs(argv: readonly string[]): { runs: number; seed: number; etalonner: boolean } {
  let runs = 100;
  let seed = 1;
  let etalonner = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--runs") runs = Number.parseInt(argv[++i] ?? "100", 10);
    else if (argv[i] === "--seed") seed = Number.parseInt(argv[++i] ?? "1", 10);
    else if (argv[i] === "--etalonner") etalonner = true;
  }
  if (!Number.isFinite(runs) || runs < 1) throw new Error(`--runs invalide : ${String(runs)}`);
  if (!Number.isFinite(seed)) throw new Error(`--seed invalide : ${String(seed)}`);
  return { runs, seed, etalonner };
}

/** Le type d'événement musical, pour les messages d'erreur. */
export function decrireEvenement(e: MusicEvent): string {
  return `${e.type} t=${String(e.t)} voice=${e.voice}`;
}
