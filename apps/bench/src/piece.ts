#!/usr/bin/env -S tsx
/**
 * `piece` — le rendu hors ligne de la pièce de démonstration (cahier §7.10,
 * §17.1, recette §18).
 *
 *   npx tsx apps/bench/src/piece.ts [--session <fichier>] [--out <wav>]
 *       [--tours <n>] [--no-wav]
 *
 * Lit une `Session` (par défaut `takes/pieces/seance-1min.json`), la déroule
 * sur toute la pièce avec la boucle de `@thin-air/core` (`loopEventsAt`),
 * rend chaque couche avec le moteur hors ligne de `@thin-air/audio`
 * (`renderEvents` — le même que les tests), mélange, applique le gain général
 * et le plafond du §7.9, puis écrit un WAV et imprime les nombres réels :
 * durée en échantillons, crête en dB, voix maximales, notes par couche.
 *
 * AUCUN son n'est émis (AIR-N-02) : aucun périphérique audio n'est ouvert,
 * tout est calculé dans des tableaux et écrit dans `out/`, dossier ignoré
 * par git — aucun fichier sonore n'est versionné (AIR-F-25).
 *
 * Codes de sortie : 0 conforme · 1 écart ou échec · 2 erreur d'usage.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Instrument, LoopLayer, MusicEvent, Session } from "@thin-air/core";
import { SAMPLE_RATE, loopEventsAt, peakDb, sessionLoopSeconds } from "@thin-air/core";
import { applyCeiling, applyMasterGain, encodeWav, renderEvents, samplesForDuration } from "@thin-air/audio";
import { parseInstrument, parseSession } from "@thin-air/schema";

import { numberValue, optionalValue, parseArgs, wantsHelp } from "./args.js";
import type { Writers } from "./commands.js";
import { PROCESS_WRITERS } from "./commands.js";
import { accept } from "./contracts.js";
import { BenchError, UsageError, describeError } from "./errors.js";
import { fixed } from "./format.js";
import { readJsonFile, writeBytesFile } from "./io.js";

export const PIECE_SESSION = "takes/pieces/seance-1min.json";
export const PIECE_WAV = "out/piece.wav";
export const INSTRUMENTS_DIR = "instruments";
/** Six tours de 10,667 s = 64 s : la pièce de la vidéo dure environ une minute. */
export const TOURS_PAR_DEFAUT = 6;
/** Fondu de fin d'export : un WAV ne se coupe pas en pleine onde. */
export const FADING_MS = 20;
/** Plafond par couche : le vrai plafond (§7.9) s'applique une fois, sur le mélange. */
const PLAFOND_COUCHE_DB = 12;

export const PIECE_HELP = `piece — rend la pièce de démonstration hors ligne, sans aucun son émis

  piece [--session takes/pieces/seance-1min.json] [--out out/piece.wav]
        [--tours 6] [--no-wav]

Imprime les nombres réels : durée en échantillons, crête en dB, voix
maximales, notes par couche. Code 0 si la crête tient sous le plafond.`;

/** Les mesures d'une couche sur tout le rendu. */
export interface LayerMeasurement {
  readonly instrument: string;
  readonly notes: number;
  readonly maxVoices: number;
}

export interface PieceRender {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly durationS: number;
  readonly tours: number;
  readonly peakDb: number;
  readonly ceilingDb: number;
  readonly layers: readonly LayerMeasurement[];
  /** Borne supérieure des voix simultanées : la somme des maxima par couche. */
  readonly voicesTotal: number;
}

export interface PieceOptions {
  readonly tours?: number;
  readonly sampleRate?: number;
}

/** La session d'un fichier, validée en entier par `parseSession` (lot A4). */
export function readSessionFile(path: string): Session {
  return accept(parseSession(readJsonFile(path)), path, "la session de la pièce");
}

/** Le dossier des instruments : ceux qui passent le schéma, et les refus dits. */
export interface InstrumentDirectory {
  readonly parNom: ReadonlyMap<string, Instrument>;
  /** `chemin : raisons` — un fichier refusé n'est jamais ignoré en silence. */
  readonly refus: readonly string[];
}

/**
 * Les instruments du dépôt, par nom. Un fichier que `parseInstrument` refuse
 * est écarté avec ses raisons ; il ne fait échouer le rendu que si une couche
 * de la session réclame cet instrument — le reste de la pièce n'a pas à payer
 * un fichier tiers en mauvais état.
 */
export function readInstrumentDirectory(dir: string = INSTRUMENTS_DIR): InstrumentDirectory {
  const parNom = new Map<string, Instrument>();
  const refus: string[] = [];
  const fichiers = readdirSync(dir).filter((nom) => nom.endsWith(".json")).sort();
  for (const fichier of fichiers) {
    const chemin = join(dir, fichier);
    const resultat = parseInstrument(readJsonFile(chemin));
    if (resultat.ok) parNom.set(resultat.value.name, resultat.value);
    else refus.push(`${chemin} : ${resultat.reasons.join(" ; ")}`);
  }
  return { parNom, refus };
}

/**
 * Les événements d'UNE couche déroulés sur tout le rendu : la boucle vient de
 * `@thin-air/core` (`loopEventsAt`), jamais recodée ici. Une couche seule est
 * rendue comme une session à une couche : chaque couche a son instrument.
 */
export function layerEvents(
  session: Session,
  layer: LoopLayer,
  durationS: number,
): readonly MusicEvent[] {
  return loopEventsAt({ ...session, layers: [layer] }, 0, durationS);
}

/** Fondu de fin : le dernier `FADING_MS` descend en cosinus vers zéro. */
export function fadeOut(samples: Float32Array, sampleRate: number): void {
  const n = Math.min(samples.length, Math.round((FADING_MS / 1000) * sampleRate));
  if (n < 2) return;
  for (let j = 0; j < n; j += 1) {
    const facteur = 0.5 * (1 + Math.cos(Math.PI * (j / (n - 1))));
    const i = samples.length - n + j;
    samples[i] = (samples[i] ?? 0) * facteur;
  }
}

function renderLayer(
  session: Session,
  layer: LoopLayer,
  instrument: Instrument,
  sampleRate: number,
  durationS: number,
  mix: Float32Array,
): LayerMeasurement {
  const events = layerEvents(session, layer, durationS);
  const rendu = renderEvents(events, {
    instrument,
    sampleRate,
    durationS,
    reverb: session.settings.reverb,
    maxVoices: session.settings.maxVoices,
    paramTauMs: session.settings.paramTauMs,
    // Gain général et plafond se appliquent une fois, sur le mélange (§7.9).
    masterGainDb: 0,
    ceilingDb: PLAFOND_COUCHE_DB,
  });
  for (let i = 0; i < mix.length; i += 1) mix[i] = (mix[i] ?? 0) + (rendu.samples[i] ?? 0);
  const notes = events.filter((event) => event.type === "noteOn").length;
  return { instrument: layer.instrument, notes, maxVoices: rendu.maxVoices };
}

/**
 * Le rendu complet de la pièce : une passe par couche (son instrument, sa
 * réverbération), le mélange, puis la fin de la chaîne du §7.9 — gain général,
 * plafond — et le fondu d'export. Déterministe : aucun aléa, aucune horloge.
 */
export function renderPiece(
  session: Session,
  instruments: InstrumentDirectory,
  options: PieceOptions = {},
): PieceRender {
  const tours = Math.max(1, Math.round(options.tours ?? TOURS_PAR_DEFAUT));
  const sampleRate = options.sampleRate ?? SAMPLE_RATE;
  const durationS = tours * sessionLoopSeconds(session);
  const mix = new Float32Array(samplesForDuration(durationS, sampleRate));
  const layers: LayerMeasurement[] = [];
  for (const layer of session.layers) {
    if (layer.muted) continue;
    const instrument = instruments.parNom.get(layer.instrument);
    if (instrument === undefined) {
      const refus = instruments.refus.length > 0 ? `\n  fichiers refusés :\n  - ${instruments.refus.join("\n  - ")}` : "";
      throw new BenchError(
        `couche ${layer.id} : instrument « ${layer.instrument} » introuvable dans ${INSTRUMENTS_DIR}/${refus}`,
      );
    }
    layers.push(renderLayer(session, layer, instrument, sampleRate, durationS, mix));
  }
  applyMasterGain(mix, session.settings.masterGainDb);
  applyCeiling(mix, session.settings.ceilingDb);
  fadeOut(mix, sampleRate);
  return {
    samples: mix,
    sampleRate,
    durationS: mix.length / sampleRate,
    tours,
    peakDb: peakDb(mix),
    ceilingDb: session.settings.ceilingDb,
    layers,
    voicesTotal: layers.reduce((somme, couche) => somme + couche.maxVoices, 0),
  };
}

/** Le compte rendu imprimé : uniquement des nombres mesurés, jamais devinés. */
export function formatPiece(
  render: PieceRender,
  loopS: number,
  source: string,
  written?: { readonly path: string; readonly bytes: number },
): string {
  const ligneVoix = render.layers.map((c) => `${c.instrument} ${c.maxVoices}`).join(", ");
  const ligneNotes = render.layers.map((c) => `${c.instrument} ${c.notes}`).join(", ");
  const totalNotes = render.layers.reduce((somme, c) => somme + c.notes, 0);
  const conforme = render.peakDb <= render.ceilingDb;
  const lignes = [
    `pièce : ${source}`,
    `boucle : ${fixed(loopS, 3)} s × ${render.tours} tours = ${fixed(render.durationS, 3)} s`,
    `durée : ${render.samples.length} échantillons à ${render.sampleRate} Hz`,
    `crête : ${fixed(render.peakDb, 2)} dB (plafond ${fixed(render.ceilingDb, 2)} dB) — ${conforme ? "conforme" : "ÉCART"}`,
    `voix maximales : ${render.voicesTotal} au total (par couche : ${ligneVoix})`,
    `notes par couche : ${ligneNotes} — ${totalNotes} au total`,
    written === undefined
      ? "WAV non écrit (--no-wav)"
      : `WAV : ${written.path} (${written.bytes} octets)`,
    "aucun son émis : rendu hors ligne dans un fichier (AIR-N-02)",
  ];
  return lignes.join("\n");
}

/** Point d'entrée testable : rend le code de sortie, jamais `process.exit`. */
export function main(argv: readonly string[], writers: Writers = PROCESS_WRITERS): number {
  const args = parseArgs(argv, {
    command: "piece",
    values: ["session", "out", "tours"],
    flags: ["no-wav"],
  });
  if (wantsHelp(args)) {
    writers.out(PIECE_HELP);
    return 0;
  }
  try {
    const source = optionalValue(args, "session") ?? PIECE_SESSION;
    const destination = optionalValue(args, "out") ?? PIECE_WAV;
    const tours = numberValue(args, "tours") ?? TOURS_PAR_DEFAUT;
    if (tours < 1) throw new UsageError(`--tours attend un entier ≥ 1 : « ${tours} »`);
    const session = readSessionFile(source);
    const render = renderPiece(session, readInstrumentDirectory(), { tours });
    let written: { path: string; bytes: number } | undefined;
    if (!args.flags.has("no-wav")) {
      const wav = encodeWav(render.samples, render.sampleRate);
      written = { path: writeBytesFile(destination, wav), bytes: wav.length };
    }
    writers.out(formatPiece(render, sessionLoopSeconds(session), source, written));
    return render.peakDb <= render.ceilingDb ? 0 : 1;
  } catch (error) {
    if (error instanceof UsageError) {
      writers.err(`usage : ${error.message}`);
      if (error.hint !== undefined) for (const ligne of error.hint.split("\n")) writers.err(`  - ${ligne}`);
      return 2;
    }
    if (error instanceof BenchError) {
      writers.err(`échec : ${error.message}`);
      return 1;
    }
    writers.err(`échec inattendu : ${describeError(error)}`);
    return 1;
  }
}

const directRun = import.meta.url === `file://${process.argv[1]}`;
if (directRun) process.exit(main(process.argv.slice(2)));
