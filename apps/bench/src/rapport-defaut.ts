/**
 * Le rapport de défaut en un clic (cahier §7.11, §16) : UN fichier JSON
 * auto-suffisant, rejouable, sans image ni donnée personnelle.
 *
 * Le fichier porte la prise (les points, rien de plus), l'instrument, les
 * réglages effectifs, le rapport de rendu (le même que `report.json` du
 * banc), les mesures de retard, la version du dépôt, la date UTC, la
 * commande de rejeu et un résumé en clair. Il se relit : `parseDefectReport`
 * le revérifie avec les schémas existants (prise, instrument, rapport de
 * rendu), jamais avec des règles écrites ici.
 *
 * Rien de personnel : les chemins sont relatifs au dépôt (le nom du fichier
 * seul quand il est hors du dépôt), aucune image, aucun octet encodé.
 *
 * Le rendu passe par le banc (`renderedTake`) : aucune logique de rendu n'est
 * réécrite ici (règle 4 du contrat, zéro duplication).
 */
import type { Instrument, NoteMeasurement, RenderReport, Settings, Take } from "@thin-air/core";

import { loadInstrumentSchema, loadTakeSchema } from "./contracts.js";
import { effectiveSettings, noteSteps } from "./events.js";
import { formatReport, isRecord, parseReport } from "./report.js";
import { takeLabel } from "./io.js";
import type { RenderedTake } from "./render.js";
import { renderedTake } from "./render.js";
import { UsageError } from "./errors.js";

/** Le format du fichier, pour qu'un lecteur sache ce qu'il tient. */
export const RAPPORT_DEFAUT_FORMAT = "thin-air-defect-report/1";

/** Les chemins écrits dans le fichier : relatifs au dépôt, jamais absolus. */
export interface CheminsRapport {
  readonly prise: string;
  readonly instrument: string;
  readonly sortie: string;
}

/** Une composante du retard : mesurée, estimée, ou hors de portée ici. */
export interface RetardComposant {
  readonly composant: string;
  readonly valeurMs: number | null;
  readonly statut: "mesuré" | "estimé" | "non mesuré";
  readonly source: string;
}

/** Une note, du moment où elle est émise au moment où elle est mesurée. */
export interface RetardNote {
  readonly midi: number;
  readonly emissionMs: number;
  readonly mesureMs: number;
  readonly retardMs: number;
}

/** Les mesures de retard, en millisecondes. */
export interface MesuresRetard {
  readonly unite: "ms";
  readonly composants: readonly RetardComposant[];
  readonly notes: readonly RetardNote[];
  readonly retardMedianMs: number | null;
  readonly retardMaxMs: number | null;
  readonly extinctionMs: number;
}

/** Le fichier, tel qu'il est écrit sur le disque. */
export interface RapportDefaut {
  readonly format: string;
  readonly date: string;
  readonly version: string;
  readonly prise: Take;
  readonly instrument: Instrument;
  readonly reglages: Settings;
  readonly rapport: RenderReport;
  readonly retard: MesuresRetard;
  readonly chemins: CheminsRapport;
  readonly rejeu: string;
  readonly resume: string;
}

/** Ce qu'il faut pour écrire le rapport. */
export interface RapportDefautInput {
  readonly prise: Take;
  readonly instrument: Instrument;
  readonly reglages: Settings;
  readonly version: string;
  readonly date: string;
  readonly chemins: CheminsRapport;
}

/** Trois décimales : le millième de milliseconde ne dit rien de plus. */
function arrondi(valeur: number): number {
  return Number.isFinite(valeur) ? Number(valeur.toFixed(3)) : 0;
}

/** La médiane, ou `null` quand il n'y a rien à mesurer. */
function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  if (tri.length % 2 === 1) return tri[milieu] ?? null;
  return ((tri[milieu - 1] ?? 0) + (tri[milieu] ?? 0)) / 2;
}

/** La commande qui rejoue le rapport : la même, avec les mêmes entrées. */
export function replayCommand(chemins: CheminsRapport): string {
  return [
    "npx tsx scripts/rapport-defaut.mjs",
    `--prise ${chemins.prise}`,
    `--instrument ${chemins.instrument}`,
    `--out ${chemins.sortie}`,
  ].join(" ");
}

/** Les intervalles entre images, en ms : la cadence réelle de la prise. */
function intervallesPrise(prise: Take): number[] {
  const deltas: number[] = [];
  for (let index = 1; index < prise.frames.length; index += 1) {
    const courant = prise.frames[index]?.t ?? 0;
    const precedent = prise.frames[index - 1]?.t ?? 0;
    deltas.push((courant - precedent) * 1000);
  }
  return deltas;
}

/** La durée de la prise : le dernier horodatage, en secondes. */
function dureePrise(prise: Take): number {
  return prise.frames[prise.frames.length - 1]?.t ?? 0;
}

/** L'émission de la note : le palier qui l'a produite, le plus proche avant. */
function emissionDe(note: NoteMeasurement, paliers: readonly { t: number; midi: number }[]): number {
  const memes = paliers.filter((palier) => Math.round(palier.midi) === Math.round(note.midi));
  const avant = memes.filter((palier) => palier.t <= note.t + 1e-9);
  const retenu = avant.length > 0 ? avant[avant.length - 1] : memes[0];
  return retenu?.t ?? note.t;
}

/** Une ligne par note mesurée : l'émission, la mesure, l'écart. */
function notesRetard(
  notes: readonly NoteMeasurement[],
  paliers: readonly { t: number; midi: number }[],
): RetardNote[] {
  return notes.map((note) => {
    const emission = emissionDe(note, paliers);
    return {
      midi: Math.round(note.midi),
      emissionMs: arrondi(emission * 1000),
      mesureMs: arrondi(note.t * 1000),
      retardMs: arrondi((note.t - emission) * 1000),
    };
  });
}

/** Les composantes du retard, mesurées ici et estimées ailleurs (§5.1). */
function composantsRetard(
  intervalleMs: number | null,
  retardMedianMs: number | null,
  extinctionMs: number,
  reglages: Settings,
): RetardComposant[] {
  return [
    {
      composant: "intervalle entre images",
      valeurMs: intervalleMs,
      statut: "mesuré",
      source: "les horodatages de la prise",
    },
    {
      composant: "décalage des notes",
      valeurMs: retardMedianMs,
      statut: "mesuré",
      source: "l'émission de la note et sa mesure de justesse (garde de 80 ms incluse)",
    },
    {
      composant: "extinction du son",
      valeurMs: arrondi(extinctionMs),
      statut: "mesuré",
      source: "la durée du rendu moins la durée de la prise",
    },
    {
      composant: "caméra",
      valeurMs: reglages.cameraLatencyMs,
      statut: "estimé",
      source: "le réglage cameraLatencyMs (§7.13) ; la caméra ne se mesure pas dans un navigateur",
    },
    {
      composant: "analyse des mains",
      valeurMs: null,
      statut: "non mesuré",
      source: "mesuré dans le navigateur ; voir docs/latency.md",
    },
    {
      composant: "traitement",
      valeurMs: null,
      statut: "non mesuré",
      source: "mesuré dans le navigateur ; voir docs/latency.md",
    },
    {
      composant: "sortie audio",
      valeurMs: null,
      statut: "non mesuré",
      source: "mesuré dans le navigateur ; voir docs/latency.md",
    },
  ];
}

/**
 * Les mesures de retard de la prise et de son rendu.
 *
 * Mesurable ici : la cadence de la prise, le décalage entre l'émission d'une
 * note et sa mesure, la durée du son après la dernière image. Pas mesurable
 * ici : l'analyse, le traitement et la sortie audio — ils se relèvent dans
 * le navigateur (`docs/latency.md`), et le rapport le dit plutôt que de les
 * inventer.
 */
export function mesuresRetard(
  prise: Take,
  rendered: RenderedTake,
  reglages: Settings,
): MesuresRetard {
  const paliers = noteSteps(rendered.events, rendered.report.durationS);
  const notes = notesRetard(rendered.report.notes, paliers);
  const retards = notes.map((note) => note.retardMs);
  const intervalle = mediane(intervallesPrise(prise));
  const retardMedian = mediane(retards);
  const extinction = (rendered.report.durationS - dureePrise(prise)) * 1000;
  return {
    unite: "ms",
    composants: composantsRetard(
      intervalle === null ? null : arrondi(intervalle),
      retardMedian === null ? null : arrondi(retardMedian),
      extinction,
      reglages,
    ),
    notes,
    retardMedianMs: retardMedian === null ? null : arrondi(retardMedian),
    retardMaxMs: retards.length === 0 ? null : arrondi(Math.max(...retards)),
    extinctionMs: arrondi(extinction),
  };
}

/** Le résumé en clair : ce qu'un humain lit en premier. */
function resumeText(rapport: RapportDefaut): string {
  const intervalle = rapport.retard.composants[0]?.valeurMs;
  const extinction = rapport.retard.extinctionMs;
  const lignes = [
    "Rapport de défaut — Thin Air",
    formatReport(rapport.rapport),
    `retard     intervalle entre images ${intervalle ?? "—"} ms (mesuré) · extinction ${extinction} ms (mesuré)`,
    `version    ${rapport.version}`,
    `date       ${rapport.date}`,
    `rejeu      ${rapport.rejeu}`,
  ];
  return lignes.join("\n");
}

/** La prise, arrondie comme l'écrit le schéma (§7.11), prête à être rejouée. */
async function priseComptee(prise: Take): Promise<Take> {
  const schema = await loadTakeSchema();
  return JSON.parse(schema.compactTakeJson(prise)) as Take;
}

/**
 * Le rapport complet : le rendu passe par le banc, le reste est de la mise en
 * forme. La prise est arrondie par le schéma, jamais réécrite ici.
 */
export async function renderDefectReport(input: RapportDefautInput): Promise<RapportDefaut> {
  const rendered = await renderedTake(input.prise, input.instrument, {
    settings: input.reglages,
    takeName: takeLabel(input.chemins.prise),
  });
  const retard = mesuresRetard(input.prise, rendered, input.reglages);
  const rapport: RapportDefaut = {
    format: RAPPORT_DEFAUT_FORMAT,
    date: input.date,
    version: input.version,
    prise: await priseComptee(input.prise),
    instrument: input.instrument,
    reglages: input.reglages,
    rapport: rendered.report,
    retard,
    chemins: input.chemins,
    rejeu: replayCommand(input.chemins),
    resume: "",
  };
  return { ...rapport, resume: resumeText(rapport) };
}

/** Les réglages effectifs d'un instrument : défauts, puis instrument, puis options. */
export function reglagesDe(
  instrument: Instrument,
  options?: { readonly settings?: Partial<Settings> },
): Settings {
  return effectiveSettings(instrument, options);
}

/**
 * Relit un rapport de défaut et le revérifie : la prise par le schéma (vie
 * privée), l'instrument par le schéma, le rapport de rendu par le banc. Un
 * fichier douteux est refusé en entier, avec les raisons.
 */
export async function parseDefectReport(json: unknown): Promise<RapportDefaut> {
  if (!isRecord(json)) {
    throw new UsageError("rapport de défaut invalide", "un objet JSON est attendu");
  }
  const raisons: string[] = [];
  if (json["format"] !== RAPPORT_DEFAUT_FORMAT) {
    raisons.push(`format : « ${RAPPORT_DEFAUT_FORMAT} » attendu`);
  }
  for (const cle of ["date", "version", "rejeu", "resume"] as const) {
    if (typeof json[cle] !== "string") raisons.push(`${cle} : une chaîne est attendue`);
  }
  const schema = await loadTakeSchema();
  const prise = schema.assertTakePrivacy(json["prise"]);
  if (!prise.ok) raisons.push(...prise.reasons.map((raison) => `prise : ${raison}`));
  const instrumentSchema = await loadInstrumentSchema();
  const instrument = instrumentSchema.parseInstrument(json["instrument"]);
  if (!instrument.ok) raisons.push(...instrument.reasons.map((raison) => `instrument : ${raison}`));
  try {
    parseReport(json["rapport"], "rapport de défaut");
  } catch (erreur) {
    raisons.push(erreur instanceof Error ? erreur.message : String(erreur));
  }
  if (raisons.length > 0) {
    throw new UsageError("rapport de défaut invalide", raisons.join("\n  - "));
  }
  return json as unknown as RapportDefaut;
}
