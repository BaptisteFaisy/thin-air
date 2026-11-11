/**
 * La pièce de démonstration (cahier §17.1, 0:40 – 1:25) : le rendu hors ligne
 * de `takes/pieces/seance-1min.json` dans `out/piece.wav`, avec les nombres
 * réels imprimés. Aucun son n'est émis (AIR-N-02) : les échantillons sont
 * calculés dans des tableaux, puis écrits dans un dossier ignoré.
 *
 * Tout vient des autres lots, rien n'est réécrit ici :
 *  - la boucle (déroulé des tours, longueur exacte) : `@thin-air/core` ;
 *  - le moteur de rendu, la chaîne §7.9 et le WAV : `@thin-air/audio` ;
 *  - la validation de la session : `@thin-air/schema`.
 *
 * Exécution (depuis la racine du dépôt) : `npx tsx apps/bench/src/piece.ts`
 */
import type { Instrument, LoopLayer, MusicEvent, Session } from "@thin-air/core";
import { SAMPLE_RATE, loopEventsAt, loopSamples, peakDb } from "@thin-air/core";
import {
  applyCeiling,
  applyMasterGain,
  createReverb,
  encodeWav,
  renderEvents,
} from "@thin-air/audio";
import { parseInstrument, parseSession } from "@thin-air/schema";

import { accept } from "./contracts.js";
import { ensureDir, readJsonFile, writeBytesFile } from "./io.js";

/** Chemins fixés : la pièce, les instruments, la sortie (dossier ignoré). */
export const PIECE_PATH = "takes/pieces/seance-1min.json";
export const INSTRUMENTS_DIR = "instruments";
export const OUT_WAV = "out/piece.wav";

/** Tours de boucle rendus : 6 × 10,67 s ≈ une minute (cahier §7.10). */
export const TOURS = 6;

/** Relâchement final ajouté avant la fin du rendu, en secondes. */
export const RELACHEMENT_FIN_S = 1;

/** La session de la pièce, validée par le schéma (lot A4). */
export function pieceSession(path: string = PIECE_PATH): Session {
  return accept(parseSession(readJsonFile(path)), path, "session");
}

/** Un instrument de `instruments/`, validé par le schéma. */
export function instrumentDe(nom: string): Instrument {
  const path = `${INSTRUMENTS_DIR}/${nom}.json`;
  return accept(parseInstrument(readJsonFile(path)), path, "instrument");
}

/** Durée totale du rendu : des tours entiers de boucle, en secondes exactes. */
export function dureePieceS(session: Session, tours: number = TOURS): number {
  const { tempo, bars, beatsPerBar } = session;
  return (tours * loopSamples(tempo, bars, beatsPerBar, SAMPLE_RATE)) / SAMPLE_RATE;
}

/** Les voix distinctes qu'une couche fait sonner. */
function voixDe(events: readonly MusicEvent[]): string[] {
  const voix = new Set<string>();
  for (const event of events) if (event.type === "noteOn") voix.add(event.voice);
  return [...voix].sort();
}

/**
 * Les événements d'une couche déroulés sur tout le rendu (la boucle de
 * `@thin-air/core`), plus un relâchement final : sans `noteOff` de fin, une
 * voix tenue serait tronquée net à la dernière mesure.
 */
export function derouleCouche(
  session: Session,
  layer: LoopLayer,
  dureeS: number,
): readonly MusicEvent[] {
  const uneCouche: Session = { ...session, layers: [layer] };
  const deroules = loopEventsAt(uneCouche, 0, dureeS);
  const fin = dureeS - RELACHEMENT_FIN_S;
  return [
    ...deroules,
    ...voixDe(deroules).map((voice) => ({ type: "noteOff", t: fin, voice }) as MusicEvent),
  ];
}

/**
 * Voix simultanées maximales, toutes couches confondues : parcours du flux
 * d'événements déroulé (noteOn ouvre une voix, noteOff la ferme). C'est le
 * modèle même du moteur (§7.9) ; par couche, le moteur rend son propre compte.
 */
export function maxVoicesSimultanees(session: Session, dureeS: number): number {
  const flux: Array<{ readonly t: number; readonly cle: string; readonly on: boolean }> = [];
  for (const layer of session.layers) {
    if (layer.muted) continue;
    for (const event of derouleCouche(session, layer, dureeS)) {
      if (event.type === "control") continue;
      flux.push({ t: event.t, cle: `${layer.id}:${event.voice}`, on: event.type === "noteOn" });
    }
  }
  flux.sort((a, b) => a.t - b.t);
  const actives = new Set<string>();
  let maximum = 0;
  for (const entree of flux) {
    if (entree.on) actives.add(entree.cle);
    else actives.delete(entree.cle);
    maximum = Math.max(maximum, actives.size);
  }
  return maximum;
}

/** Notes par couche (nombre de `noteOn` dans la boucle), triées par couche. */
export function notesParCouche(session: Session): ReadonlyArray<[string, number]> {
  return session.layers
    .map((layer) => [
      layer.instrument,
      layer.events.filter((event) => event.type === "noteOn").length,
    ] as [string, number])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** Le mélange des tiges sèches, puis la chaîne du §7.9 (ordre du moteur). */
function chaineSurMelange(melange: Float32Array, session: Session): Float32Array {
  const { reverb, masterGainDb, ceilingDb } = session.settings;
  let sortie = melange;
  if (reverb > 0) {
    const humide = new Float32Array(melange.length);
    createReverb({ sampleRate: SAMPLE_RATE, amount: reverb }).process(melange, humide);
    sortie = humide;
  }
  applyMasterGain(sortie, masterGainDb);
  applyCeiling(sortie, ceilingDb);
  return sortie;
}

/** Une tige : la couche rendue sèche (gain 0 dB, plafond 0 dB, sans écho). */
function tigeSeche(session: Session, layer: LoopLayer, dureeS: number): Float32Array {
  const { maxVoices, paramTauMs } = session.settings;
  const rendu = renderEvents(derouleCouche(session, layer, dureeS), {
    instrument: instrumentDe(layer.instrument),
    sampleRate: SAMPLE_RATE,
    durationS: dureeS,
    masterGainDb: 0,
    ceilingDb: 0,
    reverb: 0,
    maxVoices,
    paramTauMs,
  });
  return rendu.samples;
}

/** Le rendu complet de la pièce : échantillons mélangés et nombres mesurés. */
export function renderPiece(
  session: Session,
  tours: number = TOURS,
): {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  readonly dureeS: number;
  readonly echantillons: number;
  readonly peakDb: number;
  readonly maxVoices: number;
  readonly notes: ReadonlyArray<[string, number]>;
} {
  const dureeS = dureePieceS(session, tours);
  const melange = new Float32Array(Math.round(dureeS * SAMPLE_RATE));
  for (const layer of session.layers) {
    if (layer.muted) continue;
    const tige = tigeSeche(session, layer, dureeS);
    for (let i = 0; i < melange.length; i++) melange[i] = (melange[i] ?? 0) + (tige[i] ?? 0);
  }
  const sortie = chaineSurMelange(melange, session);
  return {
    samples: sortie,
    sampleRate: SAMPLE_RATE,
    dureeS: sortie.length / SAMPLE_RATE,
    echantillons: sortie.length,
    peakDb: peakDb(sortie),
    maxVoices: maxVoicesSimultanees(session, dureeS),
    notes: notesParCouche(session),
  };
}

/** Écrit le WAV de la pièce (16 bits mono) et rend son chemin. */
export function writePieceWav(samples: Float32Array, out: string = OUT_WAV): string {
  ensureDir("out");
  return writeBytesFile(out, encodeWav(samples, SAMPLE_RATE));
}

/** `npx tsx apps/bench/src/piece.ts` : rendu, écriture, nombres réels. */
export function main(): void {
  const session = pieceSession();
  const rendu = renderPiece(session);
  const chemin = writePieceWav(rendu.samples);
  const notes = rendu.notes.map(([couche, n]) => `${couche} ${n}`).join(", ");
  const lignes = [
    `pièce                : ${PIECE_PATH} — ${TOURS} tours de boucle`,
    `échantillons         : ${rendu.echantillons} à ${rendu.sampleRate} Hz`,
    `durée                : ${rendu.dureeS.toFixed(3)} s`,
    `crête                : ${rendu.peakDb.toFixed(2)} dB (plafond ${session.settings.ceilingDb} dB)`,
    `voix simultanées max : ${rendu.maxVoices}`,
    `notes par couche     : ${notes}`,
    `WAV                  : ${chemin}`,
  ];
  for (const ligne of lignes) process.stdout.write(`${ligne}\n`);
}

const lance = process.argv[1]?.endsWith("piece.ts") ?? false;
if (lance) main();
