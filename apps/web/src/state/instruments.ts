/**
 * Le tiroir d'instruments (AIR-F-43, 44, 45) : dupliquer, modifier, valider
 * un fichier importé, et produire le lien qui contient l'instrument dans le
 * fragment de l'adresse. Aucune requête réseau : le lien est local.
 *
 * La validation par schéma Zod appartient au lot A4 (`@thin-air/schema`) :
 * elle est appelée ici derrière une fonction, jamais au chargement du module.
 */
import { SCALES, type Instrument, type InstrumentSound, type ScaleName, type SoundEngine } from "@thin-air/core";
import { BUILT_IN } from "./presets.js";

export const SCALE_NAMES: readonly ScaleName[] = [
  "majorPentatonic",
  "minorPentatonic",
  "naturalMinor",
  "harmonicMinor",
  "hungarianMinor",
  "major",
  "wholeTone",
  "chromatic",
];

export const ENGINES: readonly SoundEngine[] = ["osc", "pluck", "fm", "drum"];

/** Raisons d'un refus, en codes : le texte vient de `i18n` (AIR-N-14). */
export type RejectCode = "json" | "format" | "name" | "scale" | "geometry" | "snap" | "voices" | "sound";

export type AcceptResult =
  | { readonly ok: true; readonly instrument: Instrument }
  | { readonly ok: false; readonly reasons: readonly RejectCode[] };

function borne(valeur: number, min: number, max: number, defaut: number): number {
  if (!Number.isFinite(valeur)) return defaut;
  return valeur < min ? min : valeur > max ? max : valeur;
}

/** Le nom d'une copie, pour le tiroir « les tiens ». */
export function copyName(name: string, suffix: (name: string) => string): string {
  return suffix(name.trim() === "" ? "Instrument" : name.trim());
}

/** Une copie modifiable d'un instrument livré (P8 : dupliquer Harp). */
export function duplicate(instrument: Instrument, suffix: (name: string) => string): Instrument {
  return { ...instrument, name: copyName(instrument.name, suffix) };
}

/** Les modifications de l'éditeur (AIR-F-44), borne par borne. */
export interface EditPatch {
  readonly name?: string;
  readonly scaleName?: ScaleName;
  readonly root?: number;
  readonly low?: number;
  readonly high?: number;
  readonly count?: number;
  readonly snap?: number;
  readonly engine?: SoundEngine;
}

function withScale(instrument: Instrument, scaleName: ScaleName, root: number): Instrument {
  return { ...instrument, scale: { root: borne(root, 0, 127, instrument.scale.root), steps: SCALES[scaleName] } };
}

function withRange(instrument: Instrument, low: number, high: number): Instrument {
  const bas = borne(Math.min(low, high), 0, 127, low);
  const haut = borne(Math.max(low, high), 0, 127, high);
  return { ...instrument, range: { low: bas, high: haut } };
}

function withCount(instrument: Instrument, count: number): Instrument {
  const nombre = Math.round(borne(count, 1, 32, 16));
  if (instrument.strings !== undefined) return { ...instrument, strings: { ...instrument.strings, count: nombre } };
  if (instrument.zones !== undefined) return { ...instrument, zones: resizeZones(instrument, nombre) };
  return { ...instrument, strings: { count: nombre, axis: "u" } };
}

/**
 * Redimensionne les zones d'un instrument : les existantes sont gardées dans
 * l'ordre, les nouvelles occupent la place restante en grille de quatre.
 */
function resizeZones(instrument: Instrument, count: number): NonNullable<Instrument["zones"]> {
  const existantes = instrument.zones?.zones ?? [];
  const gardee = existantes.slice(0, count);
  const colonnes = 4;
  const ajoutees = Array.from({ length: Math.max(0, count - gardee.length) }, (_, index) => {
    const numero = gardee.length + index;
    const largeur = 1 / colonnes;
    const ligne = Math.floor(numero / colonnes);
    return {
      id: `z${numero}`,
      u0: (numero % colonnes) * largeur,
      u1: ((numero % colonnes) + 1) * largeur,
      v0: ligne * 0.5,
      v1: (ligne + 1) * 0.5,
      degree: numero,
    };
  });
  return { zones: [...gardee, ...ajoutees] };
}

/** L'éditeur appliqué : ce qui n'est pas demandé reste intact. */
export function edit(instrument: Instrument, patch: EditPatch): Instrument {
  let suivant = instrument;
  if (patch.name !== undefined) suivant = { ...suivant, name: patch.name };
  if (patch.scaleName !== undefined || patch.root !== undefined) {
    suivant = withScale(
      suivant,
      patch.scaleName ?? scaleNameOf(suivant),
      patch.root ?? suivant.scale.root,
    );
  }
  if (patch.low !== undefined || patch.high !== undefined) {
    const actuel = suivant.range ?? { low: suivant.scale.root, high: suivant.scale.root + 24 };
    suivant = withRange(suivant, patch.low ?? actuel.low, patch.high ?? actuel.high);
  }
  if (patch.count !== undefined) suivant = withCount(suivant, patch.count);
  if (patch.snap !== undefined) suivant = { ...suivant, snap: borne(patch.snap, 0, 1, 1) };
  if (patch.engine !== undefined) suivant = { ...suivant, sound: { ...suivant.sound, engine: patch.engine } };
  return suivant;
}

/** Nom de la gamme d'un instrument, retrouvé par ses écarts. */
export function scaleNameOf(instrument: Instrument): ScaleName {
  const trouve = SCALE_NAMES.find((nom) => SCALES[nom].join(",") === instrument.scale.steps.join(","));
  return trouve ?? "chromatic";
}

/** Ce que l'écran raconte d'un instrument : cordes, zones ou étendue. */
export interface InstrumentShape {
  readonly kind: "range" | "strings" | "zones";
  readonly count: number;
}

export function shapeOf(instrument: Instrument): InstrumentShape {
  if (instrument.strings !== undefined) return { kind: "strings", count: instrument.strings.count };
  if (instrument.zones !== undefined) return { kind: "zones", count: instrument.zones.zones.length };
  return { kind: "range", count: 0 };
}

export function isBuiltIn(instrument: Instrument): boolean {
  return BUILT_IN.some((livre) => livre.name === instrument.name);
}

/**
 * Le lien de partage : l'instrument entier dans le fragment (AIR-F-45).
 * Le fragment n'est jamais envoyé au serveur : c'est ce qui rend le partage
 * compatible avec « rien ne quitte ton navigateur ».
 */
export function instrumentToFragment(instrument: Instrument): string {
  const json = JSON.stringify(instrument);
  const bytes = new TextEncoder().encode(json);
  let binaire = "";
  for (const octet of bytes) binaire += String.fromCharCode(octet);
  return base64Url(btoa(binaire));
}

export function instrumentFromFragment(fragment: string): AcceptResult {
  const propre = fragment.replace(/^#/, "");
  if (propre === "") return { ok: false, reasons: ["json"] };
  try {
    const binaire = atob(debase64Url(propre));
    const bytes = Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0));
    return validate(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, reasons: ["json"] };
  }
}

function base64Url(texte: string): string {
  return texte.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function debase64Url(texte: string): string {
  return texte.replace(/-/g, "+").replace(/_/g, "/");
}

/** Lien complet, à copier (P8). `origin` vient de la page, jamais d'une constante. */
export function shareLink(instrument: Instrument, origin: string, chemin = "/"): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${base}${chemin}#i=${instrumentToFragment(instrument)}`;
}

/** Lecture du fragment de l'adresse courante, si elle porte un instrument. */
export function instrumentInLocation(hash: string): AcceptResult | null {
  const marqueur = hash.indexOf("#i=");
  if (marqueur < 0) return null;
  return instrumentFromFragment(hash.slice(marqueur + "#i=".length));
}

/**
 * Validation d'un fichier importé : refusé EN ENTIER avec ses raisons, jamais
 * de valeur par défaut silencieuse (AIR-F-43).
 */
export function validate(raw: string): AcceptResult {
  let valeur: unknown;
  try {
    valeur = JSON.parse(raw);
  } catch {
    return { ok: false, reasons: ["json"] };
  }
  return validateValue(valeur);
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return typeof valeur === "object" && valeur !== null ? (valeur as Record<string, unknown>) : null;
}

export function validateValue(valeur: unknown): AcceptResult {
  const objet_ = objet(valeur);
  if (objet_ === null) return { ok: false, reasons: ["json"] };
  const raisons: RejectCode[] = [];
  if (objet_.format !== "thin-air-instrument/1") raisons.push("format");
  if (typeof objet_.name !== "string" || objet_.name.trim() === "") raisons.push("name");
  if (!scaleValide(objet(objet_.scale))) raisons.push("scale");
  if (!geometryValide(objet_)) raisons.push("geometry");
  if (!nombreDans(objet_.snap, 0, 1)) raisons.push("snap");
  if (!nombreDans(objet_.voices, 1, 32)) raisons.push("voices");
  if (!soundValide(objet(objet_.sound))) raisons.push("sound");
  if (raisons.length > 0) return { ok: false, reasons: raisons };
  return { ok: true, instrument: objet_ as unknown as Instrument };
}

function scaleValide(scale: Record<string, unknown> | null): boolean {
  if (scale === null) return false;
  if (!nombreDans(scale.root, 0, 127)) return false;
  const steps = scale.steps;
  return Array.isArray(steps) && steps.length > 0 && steps.every((pas) => nombreDans(pas, 0, 11));
}

function geometryValide(instrument: Record<string, unknown>): boolean {
  const range = objet(instrument.range);
  const strings = objet(instrument.strings);
  const zones = objet(instrument.zones);
  if (range !== null) return nombreDans(range.low, 0, 127) && nombreDans(range.high, 0, 127);
  if (strings !== null) return nombreDans(strings.count, 1, 32);
  if (zones !== null) return Array.isArray(zones.zones) && zones.zones.length > 0;
  return false;
}

function soundValide(sound: Record<string, unknown> | null): boolean {
  if (sound === null) return false;
  return typeof sound.engine === "string" && (ENGINES as readonly string[]).includes(sound.engine);
}

function nombreDans(valeur: unknown, min: number, max: number): boolean {
  return typeof valeur === "number" && Number.isFinite(valeur) && valeur >= min && valeur <= max;
}

/**
 * Le schéma Zod du lot A4, quand il existe. Le module `@thin-air/schema` pose
 * ses constantes au chargement : il n'est donc jamais importé ici, seulement
 * demandé au moment où l'utilisateur importe un fichier.
 */
export async function validateWithSchema(raw: string): Promise<AcceptResult> {
  let valeur: unknown;
  try {
    valeur = JSON.parse(raw);
  } catch {
    return { ok: false, reasons: ["json"] };
  }
  try {
    const schema = await import("@thin-air/schema");
    const resultat = schema.parseInstrument(valeur);
    return resultat.ok
      ? { ok: true, instrument: resultat.value }
      : { ok: false, reasons: resultat.reasons.map((raison) => codeFrom(raison)) };
  } catch {
    return validateValue(valeur);
  }
}

/** Une raison Zod n'est pas un code de refus : on la ramène au plus proche. */
function codeFrom(reason: string): RejectCode {
  const minuscule = reason.toLowerCase();
  for (const code of ["format", "name", "scale", "snap", "voices", "sound"] as const) {
    if (minuscule.includes(code)) return code;
  }
  return minuscule.includes("range") || minuscule.includes("strings") || minuscule.includes("zones")
    ? "geometry"
    : "json";
}
