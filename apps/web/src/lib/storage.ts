/**
 * Persistance locale (AIR-F-09, AIR-F-54) : réglages et zone calibrée restent
 * sur l'appareil. Aucune requête réseau, aucun stockage distant (AIR-N-01).
 */
import { defaultPlayRect, type PlayRect, type Settings } from "@thin-air/core";
import type { Instrument } from "@thin-air/core";
import { decodeSettings, encodeSettings } from "../state/settings.js";
import { decodeMine, encodeMine } from "../state/instruments.js";

export const KEY_SETTINGS = "thin-air.settings";
export const KEY_RECT = "thin-air.playRect";
export const KEY_INSTRUMENTS = "thin-air.instruments";

interface Stockage {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

function acces(): Stockage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function lire(cle: string): string | null {
  try {
    return acces()?.getItem(cle) ?? null;
  } catch {
    return null;
  }
}

export function ecrire(cle: string, valeur: string): void {
  try {
    acces()?.setItem(cle, valeur);
  } catch {
    /* stockage privé ou plein : les réglages restent en mémoire */
  }
}

export function lireSettings(): Settings {
  return decodeSettings(lire(KEY_SETTINGS));
}

export function ecrireSettings(settings: Settings): void {
  ecrire(KEY_SETTINGS, encodeSettings(settings));
}

/** Les instruments de l'utilisateur (le tiroir « les tiens »), sur l'appareil. */
export function lireMine(): Instrument[] {
  return decodeMine(lire(KEY_INSTRUMENTS));
}

export function ecrireMine(instruments: readonly Instrument[]): void {
  ecrire(KEY_INSTRUMENTS, encodeMine(instruments));
}

/** La zone calibrée, relue depuis l'appareil ; par défaut les 80 % centraux. */
export function lireRect(): PlayRect {
  const brut = lire(KEY_RECT);
  if (brut === null) return defaultPlayRect();
  try {
    const valeur = JSON.parse(brut) as Partial<PlayRect>;
    if (
      typeof valeur.u0 !== "number" ||
      typeof valeur.u1 !== "number" ||
      typeof valeur.v0 !== "number" ||
      typeof valeur.v1 !== "number"
    ) {
      return defaultPlayRect();
    }
    return {
      u0: valeur.u0,
      u1: valeur.u1,
      v0: valeur.v0,
      v1: valeur.v1,
      calibratedAt: typeof valeur.calibratedAt === "number" ? valeur.calibratedAt : null,
    };
  } catch {
    return defaultPlayRect();
  }
}

export function ecrireRect(rect: PlayRect): void {
  ecrire(KEY_RECT, JSON.stringify(rect));
}
