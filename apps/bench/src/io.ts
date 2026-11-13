/**
 * Lecture et écriture des fichiers du banc d'essai. Tout passe par ici : un
 * fichier illisible devient une erreur d'usage (code 2) qui dit le chemin et
 * la raison, jamais un silence.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

import { UsageError } from "./errors.js";

/**
 * Le nom d'une prise dans un rapport : le nom du fichier, sans extension.
 * Le chemin ne suit pas — un rapport ne porte pas de chemin personnel.
 */
export function takeLabel(path: string): string {
  return basename(path, extname(path));
}

/** Texte d'un fichier ; chemin et raison en cas d'échec. */
export function readTextFile(path: string): string {
  const absolute = resolve(path);
  try {
    return readFileSync(absolute, "utf8");
  } catch (error) {
    throw new UsageError(`fichier illisible : ${path}`, reasonOf(error));
  }
}

/** Objet JSON d'un fichier ; une syntaxe fautive est refusée en entier. */
export function readJsonFile(path: string): unknown {
  const text = readTextFile(path);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new UsageError(`JSON invalide : ${path}`, reasonOf(error));
  }
}

/** Crée un dossier (et ses parents) s'il manque ; rend son chemin absolu. */
export function ensureDir(dir: string): string {
  const absolute = resolve(dir);
  mkdirSync(absolute, { recursive: true });
  return absolute;
}

/** Crée le dossier du fichier, puis écrit le texte. Rend le chemin absolu. */
export function writeTextFile(path: string, text: string): string {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  try {
    writeFileSync(absolute, text, "utf8");
  } catch (error) {
    throw new UsageError(`écriture impossible : ${path}`, reasonOf(error));
  }
  return absolute;
}

/** Écrit un objet en JSON lisible, avec sa nouvelle ligne finale. */
export function writeJsonFile(path: string, value: unknown): string {
  return writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Écrit des octets bruts (un WAV, une prise compacte). Rend le chemin. */
export function writeBytesFile(path: string, bytes: Uint8Array): string {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  try {
    writeFileSync(absolute, bytes);
  } catch (error) {
    throw new UsageError(`écriture impossible : ${path}`, reasonOf(error));
  }
  return absolute;
}

/** Poids d'un fichier en octets. */
export function fileSize(path: string): number {
  return statSync(resolve(path)).size;
}

/** Vrai si le chemin existe. */
export function fileExists(path: string): boolean {
  return existsSync(resolve(path));
}

function reasonOf(error: unknown): string | undefined {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === undefined ? error.message : `${code} — ${error.message}`;
  }
  return undefined;
}
