/**
 * Le mapping des réglages de l'écran vers `Settings` (cahier §7.13, §12.1).
 * Aucune valeur par défaut n'est recopiée : tout est relu depuis
 * `DEFAULT_SETTINGS`, qui reste la seule source de vérité.
 */
import { DEFAULT_SETTINGS, withSettings, type Instrument, type Settings } from "@thin-air/core";

export type SettingKey = keyof Settings;

export interface NumberControl {
  readonly key: SettingKey;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/**
 * Les curseurs de la page. Les bornes viennent du cahier (§7.10 pour le tempo
 * et le retard supposé de la caméra, §5.3 pour l'aimant), les défauts de
 * `DEFAULT_SETTINGS`.
 */
export const NUMBER_CONTROLS: readonly NumberControl[] = [
  { key: "tempo", min: 60, max: 140, step: 1 },
  { key: "cameraLatencyMs", min: 0, max: 120, step: 1 },
  { key: "reverb", min: 0, max: 1, step: 0.05 },
  { key: "masterGainDb", min: -60, max: 0, step: 1 },
];

export function controlFor(key: SettingKey): NumberControl | null {
  return NUMBER_CONTROLS.find((control) => control.key === key) ?? null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Une seule façon de changer un réglage : borné, sans effet de bord. */
export function patchSettings(settings: Settings, patch: Partial<Settings>): Settings {
  const suivant: Record<string, unknown> = { ...settings, ...patch };
  for (const control of NUMBER_CONTROLS) {
    const valeur = patch[control.key];
    if (typeof valeur === "number") suivant[control.key] = clamp(valeur, control.min, control.max);
  }
  return suivant as unknown as Settings;
}

/** Aimant effectif : celui des réglages s'il est posé, sinon celui du fichier. */
export function effectiveMagnet(settings: Settings, instrument: Instrument): number {
  return clamp(settings.magnet ?? instrument.snap, 0, 1);
}

/** Le volume général, en dB, tel que réglé (défaut : −12 dB, lu de `DEFAULT_SETTINGS`). */
export function masterGainDb(settings: Settings): number {
  return settings.masterGainDb;
}

export function defaultMasterGainDb(): number {
  return DEFAULT_SETTINGS.masterGainDb;
}

export function ceilingDb(settings: Settings): number {
  return settings.ceilingDb;
}

/**
 * Force du filtrage (AIR-N-06) : 0 laisse la main vive, 1 la calme au maximum.
 * Elle agit sur la coupure minimale du filtre adaptatif, qui vit dans
 * `Settings` — pas sur une constante de la page.
 */
export const FILTER_MIN_HZ = 0.5;
export const FILTER_MAX_HZ = 4;

export function filterStrength(settings: Settings): number {
  const portee = FILTER_MAX_HZ - FILTER_MIN_HZ;
  return clamp((FILTER_MAX_HZ - settings.fcMin) / portee, 0, 1);
}

export function withFilterStrength(settings: Settings, strength: number): Settings {
  const force = clamp(strength, 0, 1);
  const portee = FILTER_MAX_HZ - FILTER_MIN_HZ;
  return patchSettings(settings, { fcMin: FILTER_MAX_HZ - force * portee });
}

/** Persistance sur l'appareil : une chaîne, aucune requête (AIR-N-01). */
export function encodeSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

/** Un stockage illisible rend les défauts, jamais une moitié de réglages. */
export function decodeSettings(raw: string | null): Settings {
  if (raw === null || raw.trim() === "") return withSettings(undefined);
  try {
    const valeur = JSON.parse(raw) as unknown;
    if (typeof valeur !== "object" || valeur === null) return withSettings(undefined);
    return withSettings(valeur as Partial<Settings>);
  } catch {
    return withSettings(undefined);
  }
}

/** Les réglages affichés dans le panneau, dans l'ordre du cahier §12.1. */
export const BOOLEAN_KEYS: readonly SettingKey[] = [
  "leftHanded",
  "oneHand",
  "hold",
  "showCamera",
];
