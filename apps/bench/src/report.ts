/**
 * Le rapport de rendu : validation à la lecture et mise en forme humaine.
 *
 * Forme du rapport : annexe B du cahier. Il ne porte aucune date : deux rendus
 * de la même prise donnent le même fichier (AIR-N-09), donc deux rapports
 * comparables au bit près. Si un jour une date est ajoutée, elle est
 * optionnelle et hors comparaison.
 */
import type { NoteMeasurement, RenderReport } from "@thin-air/core";

import { UsageError } from "./errors.js";
import { fixed, formatSeconds, formatWithUnit, pad } from "./format.js";

const CHAMPS_NUMERIQUES = ["sampleRate", "samples", "durationS", "peakDb", "rmsDb", "maxVoices", "silenceAfterMs"] as const;
const CHAMPS_NOTES = ["t", "midi", "expectedHz", "measuredHz", "cents"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkNotes(notes: unknown, reasons: string[]): void {
  if (!Array.isArray(notes)) {
    reasons.push("notes : un tableau est attendu");
    return;
  }
  notes.forEach((note, index) => {
    if (!isRecord(note)) {
      reasons.push(`notes[${index}] : un objet est attendu`);
      return;
    }
    for (const champ of CHAMPS_NOTES) {
      const valeur = note[champ];
      if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
        reasons.push(`notes[${index}].${champ} : un nombre fini est attendu, reçu ${JSON.stringify(valeur)}`);
      }
    }
  });
}

/** Refuse un rapport incomplet en entier, avec la liste des raisons. */
export function parseReport(json: unknown, source: string): RenderReport {
  if (!isRecord(json)) {
    throw new UsageError(`rapport invalide : ${source}`, "un objet JSON est attendu");
  }
  const reasons: string[] = [];
  for (const champ of ["take", "instrument"] as const) {
    if (typeof json[champ] !== "string") reasons.push(`${champ} : une chaîne est attendue`);
  }
  for (const champ of CHAMPS_NUMERIQUES) {
    const valeur = json[champ];
    if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
      reasons.push(`${champ} : un nombre fini est attendu, reçu ${JSON.stringify(valeur)}`);
    }
  }
  checkNotes(json["notes"], reasons);
  if (reasons.length > 0) {
    throw new UsageError(`rapport invalide : ${source}`, reasons.join("\n  - "));
  }
  return json as unknown as RenderReport;
}

/** Une note du rapport, sur une ligne : instant, note, fréquences, écart. */
export function formatNote(note: NoteMeasurement): string {
  const colonnes = [
    pad(formatSeconds(note.t), 10),
    pad(`midi ${note.midi}`, 10),
    pad(`${fixed(note.expectedHz, 2)} Hz`, 12),
    pad(`mesuré ${fixed(note.measuredHz, 2)} Hz`, 20),
    `${fixed(note.cents, 2)} cents`,
  ];
  return colonnes.join(" ");
}

/** Le rapport entier, en texte : ce que la CI attache au journal. */
export function formatReport(report: RenderReport): string {
  const lignes = [
    `prise      ${report.take}`,
    `instrument ${report.instrument}`,
    `rendu      ${formatWithUnit(report.samples, "échantillons")} à ${report.sampleRate} Hz, ${formatSeconds(report.durationS)}`,
    `crête      ${formatWithUnit(report.peakDb, "dB")} — niveau moyen ${formatWithUnit(report.rmsDb, "dB")}`,
    `voix       ${report.maxVoices} au plus`,
    `silence    ${formatWithUnit(report.silenceAfterMs, "ms")} à la fin`,
    "",
    `notes (${report.notes.length}) :`,
  ];
  for (const note of report.notes) lignes.push(`  ${formatNote(note)}`);
  return lignes.join("\n");
}
