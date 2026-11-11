/**
 * Chargement des trois entrées du banc : la prise, l'instrument, les réglages.
 *
 * Les schémas font autorité (`@thin-air/schema`, lot A4) : le banc ne valide
 * pas à leur place, il rapporte leurs raisons. Un fichier refusé est refusé en
 * entier, avec la liste des raisons (code 2).
 */
import type { Instrument, Settings, Take } from "@thin-air/core";
import { DEFAULT_SETTINGS } from "@thin-air/core";

import { accept, loadInstrumentSchema, loadTakeSchema } from "./contracts.js";
import { UsageError } from "./errors.js";
import { readJsonFile } from "./io.js";

/** Une prise `thin-air-take/1`, validée par le schéma. */
export async function readTakeFile(path: string): Promise<Take> {
  const json = readJsonFile(path);
  const schema = await loadTakeSchema();
  return accept(schema.parseTake(json), path, "prise");
}

/** Un instrument `thin-air-instrument/1`, validé par le schéma. */
export async function readInstrumentFile(path: string): Promise<Instrument> {
  const json = readJsonFile(path);
  const schema = await loadInstrumentSchema();
  return accept(schema.parseInstrument(json), path, "instrument");
}

/**
 * Réglages dont la valeur par défaut est `null` mais qui acceptent un nombre :
 * `typeof null` vaut `"object"`, donc comparer au type du défaut refuserait
 * toute valeur utile. `magnet` est de ceux-là (§7.13 : `null` = « prendre
 * l'aimant de l'instrument »).
 */
const NOMBRE_OU_NUL = new Set(["magnet"]);

function defaultType(key: string): string {
  if (NOMBRE_OU_NUL.has(key)) return "nombre ou null";
  return typeof (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key];
}

function typeMismatch(key: string, value: unknown): boolean {
  if (NOMBRE_OU_NUL.has(key)) {
    if (value === null) return false;
    return typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1;
  }
  const attendu = defaultType(key);
  if (attendu === "number") return typeof value !== "number" || !Number.isFinite(value);
  return typeof value !== attendu;
}

/**
 * Réglages partiels, validés clé par clé contre `DEFAULT_SETTINGS` : une clé
 * inconnue ou un type faux est une erreur d'usage, jamais une valeur ignorée.
 */
export function parseSettingsJson(json: unknown, source: string): Partial<Settings> {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new UsageError(`réglages invalides : ${source}`, "un objet JSON est attendu");
  }
  const raisons: string[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
      raisons.push(`${key} : réglage inconnu`);
      continue;
    }
    if (key === "magnet" && value === null) continue;
    if (typeMismatch(key, value)) {
      raisons.push(`${key} : ${defaultType(key)} attendu, reçu ${JSON.stringify(value)}`);
    }
  }
  if (raisons.length > 0) {
    throw new UsageError(`réglages refusés : ${source}`, raisons.join("\n  - "));
  }
  return json as Partial<Settings>;
}

/** Réglages d'un fichier `--settings`, fusionnés plus tard sur les défauts. */
export function readSettingsFile(path: string): Partial<Settings> {
  return parseSettingsJson(readJsonFile(path), path);
}
