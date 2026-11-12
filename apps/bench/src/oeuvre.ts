#!/usr/bin/env -S tsx
/**
 * `oeuvre` — la chaîne d'une œuvre commandée (docs/commande-oeuvre.md).
 *
 *   npx tsx apps/bench/src/oeuvre.ts [--session <fichier>] [--out <wav>]
 *       [--report <json>] [--tours <n>] [--no-wav]
 *
 * Trois étapes, dans cet ordre :
 *  1. **valider** la session livrée par le compositeur — `parseSession`
 *     (`@thin-air/schema`) pour le format, `checkCommande` pour les règles de
 *     la commande (tempo, mesures, couches) ;
 *  2. **rendre** hors ligne en WAV dans `out/oeuvre-<nom>.wav` — le moteur de
 *     `renderPiece` (`./piece.ts`), donc `renderEvents` de `@thin-air/audio`,
 *     le même que les tests ;
 *  3. **mesurer** et écrire un rapport JSON — `buildReport` (`@thin-air/core`)
 *     plus les nombres par couche : c'est la preuve renvoyée au compositeur
 *     que sa pièce est jouable.
 *
 * AUCUN son n'est émis (AIR-N-02) : aucun périphérique audio n'est ouvert,
 * tout est calculé dans des tableaux puis écrit dans `out/`, dossier ignoré
 * par git — aucun fichier sonore n'est versionné (AIR-F-25).
 *
 * Codes de sortie : 0 conforme · 1 écart ou échec · 2 erreur d'usage.
 */
import { basename } from "node:path";
import type { RenderReport, Session } from "@thin-air/core";
import { buildReport, sessionLoopSeconds } from "@thin-air/core";
import { encodeWav } from "@thin-air/audio";
import { MAX_LAYERS } from "@thin-air/schema";

import { numberValue, optionalValue, parseArgs, wantsHelp } from "./args.js";
import type { Writers } from "./commands.js";
import { PROCESS_WRITERS } from "./commands.js";
import { BenchError, UsageError, describeError } from "./errors.js";
import { fixed } from "./format.js";
import { writeBytesFile, writeJsonFile } from "./io.js";
import type { PieceRender } from "./piece.js";
import { formatPiece, readInstrumentDirectory, readSessionFile, renderPiece } from "./piece.js";

/** Le gabarit livré au compositeur : une couche, quatre mesures. */
export const MODELE_SESSION = "takes/pieces/modele-commande.json";

/** Bornes de la commande (cahier §7.10, docs/commande-oeuvre.md). */
export const TEMPO_MIN = 60;
export const TEMPO_MAX = 140;
export const BARS_AUTORISEES: readonly number[] = [1, 2, 4];
export const DUREE_MIN_S = 60;
export const DUREE_MAX_S = 180;

/** Le rapport porte le nom de la pièce : deux œuvres ne s'écrasent pas. */
export const RAPPORT_SUFFIXE = ".report.json";

export const OEUVRE_HELP = `oeuvre — valide, rend et mesure une session commandée, hors ligne

  oeuvre [--session takes/pieces/modele-commande.json]
         [--out out/oeuvre-<nom>.wav] [--report out/oeuvre-<nom>.report.json]
         [--tours <n>] [--no-wav]

Écrit un WAV dans out/ (ignoré par git) et un rapport de mesures JSON : durée
exacte en échantillons, crête en dB, voix simultanées, notes par couche.
Code 0 si la commande est respectée et la crête sous le plafond.`;

/** Ce qu'une couche a joué, tel que mesuré sur le rendu. */
export interface OeuvreLayerReport {
  readonly id: number;
  readonly instrument: string;
  readonly notes: number;
  readonly maxVoices: number;
}

/** Le rapport renvoyé au compositeur : que des nombres mesurés. */
export interface OeuvreReport {
  readonly source: string;
  readonly tempo: number;
  readonly bars: number;
  readonly beatsPerBar: number;
  readonly loopSeconds: number;
  readonly tours: number;
  readonly ceilingDb: number;
  readonly peakConforme: boolean;
  readonly dureeCibleS: { readonly min: number; readonly max: number };
  readonly dureeConforme: boolean;
  /** Les mesures du mélange, au format `RenderReport` du dépôt. */
  readonly mesures: RenderReport;
  readonly couches: readonly OeuvreLayerReport[];
  readonly couchesMuettes: number;
  readonly notesTotal: number;
}

/** Les couches : une couche sans événement ne se livre pas, une couche qui
 * déborde la boucle non plus (la boucle la replierait en silence). */
function checkCouches(session: Session, loopS: number): string[] {
  const raisons: string[] = [];
  for (const couche of session.layers) {
    if (couche.events.length === 0) {
      raisons.push(
        `couche ${couche.id} (${couche.instrument}) : aucun événement — une couche muette ne se livre pas`,
      );
      continue;
    }
    const dehors = couche.events.filter((evenement) => evenement.t >= loopS).length;
    if (dehors > 0) {
      raisons.push(
        `couche ${couche.id} (${couche.instrument}) : ${dehors} événement(s) à ou après la fin de la boucle (${fixed(loopS, 3)} s)`,
      );
    }
  }
  return raisons;
}

/**
 * Les règles de la commande, au-delà du schéma : la liste des refus, vide si
 * la session est livrable. Le schéma (`parseSession`) borne déjà les couches à
 * six et le tempo au positif ; la commande resserre sur le jouable (§7.10).
 */
export function checkCommande(session: Session): readonly string[] {
  const raisons: string[] = [];
  if (session.tempo < TEMPO_MIN || session.tempo > TEMPO_MAX) {
    raisons.push(`tempo ${session.tempo} : hors de ${TEMPO_MIN}–${TEMPO_MAX} battements par minute`);
  }
  if (!BARS_AUTORISEES.includes(session.bars)) {
    raisons.push(`bars ${session.bars} : ${BARS_AUTORISEES.join(", ")} mesures seulement`);
  }
  if (session.layers.length === 0) raisons.push("aucune couche : l'œuvre n'a rien à jouer");
  if (session.layers.length > MAX_LAYERS) {
    raisons.push(`${session.layers.length} couches : ${MAX_LAYERS} au plus`);
  }
  raisons.push(...checkCouches(session, sessionLoopSeconds(session)));
  return raisons;
}

/**
 * Le nombre de tours par défaut : le plus petit qui atteint la durée visée
 * (une à trois minutes), sans jamais la dépasser. Déterministe, calculé sur la
 * longueur de la boucle seule.
 */
export function defaultTours(loopS: number): number {
  if (!(loopS > 0)) return 1;
  const minimum = Math.max(1, Math.ceil(DUREE_MIN_S / loopS));
  const maximum = Math.max(minimum, Math.floor(DUREE_MAX_S / loopS));
  return Math.min(minimum, maximum);
}

/** Le rapport de l'œuvre : le mélange mesuré par `buildReport`, plus le détail
 * par couche que seul le rendu complet connaît. */
export function buildOeuvreReport(source: string, session: Session, render: PieceRender): OeuvreReport {
  const jouees = session.layers.filter((couche) => !couche.muted);
  const couches: OeuvreLayerReport[] = jouees.map((couche, index) => ({
    id: couche.id,
    instrument: couche.instrument,
    notes: render.layers[index]?.notes ?? 0,
    maxVoices: render.layers[index]?.maxVoices ?? 0,
  }));
  const mesures = buildReport({
    take: source,
    instrument: couches.map((couche) => couche.instrument).join(" + "),
    samples: render.samples,
    sampleRate: render.sampleRate,
    notes: [],
    maxVoices: render.voicesTotal,
  });
  return {
    source,
    tempo: session.tempo,
    bars: session.bars,
    beatsPerBar: session.beatsPerBar,
    loopSeconds: mesures.durationS / Math.max(1, render.tours),
    tours: render.tours,
    ceilingDb: render.ceilingDb,
    peakConforme: render.peakDb <= render.ceilingDb,
    dureeCibleS: { min: DUREE_MIN_S, max: DUREE_MAX_S },
    dureeConforme: render.durationS >= DUREE_MIN_S && render.durationS <= DUREE_MAX_S,
    mesures,
    couches,
    couchesMuettes: session.layers.length - jouees.length,
    notesTotal: couches.reduce((somme, couche) => somme + couche.notes, 0),
  };
}

/** Le compte rendu imprimé : les lignes mesurées de `formatPiece`, plus le
 * verdict de la commande et le chemin du rapport. */
export function formatOeuvre(
  report: OeuvreReport,
  render: PieceRender,
  source: string,
  reportPath: string,
  written?: { readonly path: string; readonly bytes: number },
): string {
  const lignes = formatPiece(render, report.loopSeconds, source, written).split("\n");
  lignes.push(
    `rapport : ${reportPath}`,
    `durée visée : ${report.dureeCibleS.min}–${report.dureeCibleS.max} s — ${report.dureeConforme ? "tenue" : "ÉCART"}`,
    `commande : tempo ${report.tempo}, ${report.bars} mesure(s), ${report.couches.length} couche(s) jouée(s) — conforme`,
  );
  return lignes.join("\n");
}

/** Les chemins de sortie, dérivés du nom de la session livrée. */
export function oeuvrePaths(source: string): { readonly nom: string; readonly wav: string; readonly rapport: string } {
  const nom = basename(source).replace(/\.json$/i, "");
  return { nom, wav: `out/oeuvre-${nom}.wav`, rapport: `out/oeuvre-${nom}${RAPPORT_SUFFIXE}` };
}

/** Rendu + écritures : ce que `main` fait une fois la session validée. */
function produire(
  source: string,
  session: Session,
  tours: number,
  wavPath: string,
  reportPath: string,
  noWav: boolean,
  writers: Writers,
): number {
  const render = renderPiece(session, readInstrumentDirectory(), { tours });
  const report = buildOeuvreReport(source, session, render);
  writeJsonFile(reportPath, report);
  let written: { path: string; bytes: number } | undefined;
  if (!noWav) {
    const wav = encodeWav(render.samples, render.sampleRate);
    written = { path: writeBytesFile(wavPath, wav), bytes: wav.length };
  }
  writers.out(formatOeuvre(report, render, source, reportPath, written));
  return report.peakConforme ? 0 : 1;
}

/** Point d'entrée testable : rend le code de sortie, jamais `process.exit`. */
export function main(argv: readonly string[], writers: Writers = PROCESS_WRITERS): number {
  const args = parseArgs(argv, {
    command: "oeuvre",
    values: ["session", "out", "report", "tours"],
    flags: ["no-wav"],
  });
  if (wantsHelp(args)) {
    writers.out(OEUVRE_HELP);
    return 0;
  }
  try {
    const source = optionalValue(args, "session") ?? MODELE_SESSION;
    const chemins = oeuvrePaths(source);
    const session = readSessionFile(source);
    const raisons = checkCommande(session);
    if (raisons.length > 0) {
      throw new BenchError(`session hors commande : ${source}\n  - ${raisons.join("\n  - ")}`);
    }
    const tours = numberValue(args, "tours") ?? defaultTours(sessionLoopSeconds(session));
    if (tours < 1) throw new UsageError(`--tours attend un entier ≥ 1 : « ${tours} »`);
    return produire(
      source,
      session,
      tours,
      optionalValue(args, "out") ?? chemins.wav,
      optionalValue(args, "report") ?? chemins.rapport,
      args.flags.has("no-wav"),
      writers,
    );
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
