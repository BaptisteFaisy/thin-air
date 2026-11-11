/**
 * Le tiroir d'instruments (AIR-F-43, 44, 45) : dupliquer, modifier, partager
 * par lien, et garder les instruments de l'utilisateur sur l'appareil.
 *
 * La validation appartient au lot A4 (`@thin-air/schema`) : ce module appelle
 * `parseInstrument`, `instrumentToFragment` et `instrumentFromFragment`, et ne
 * réécrit aucune règle. Un fichier refusé l'est EN ENTIER, avec ses raisons —
 * jamais de valeur par défaut silencieuse (AIR-F-43, §11.4).
 *
 * Aucune requête réseau : le lien de partage porte l'instrument dans le
 * fragment d'adresse, qui ne quitte jamais le navigateur (AIR-F-45, AIR-N-01).
 */
import { SCALES, type Instrument, type ScaleName, type SoundEngine } from "@thin-air/core";
import {
  instrumentFromFragment,
  instrumentToFragment,
  parseInstrument,
  type ParseResult,
} from "@thin-air/schema";
import { isBuiltInName } from "./library.js";

export { instrumentFromFragment, instrumentToFragment };

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

/** Le résultat du schéma A4 : accepté avec sa valeur, ou refusé avec ses raisons. */
export type AcceptResult = ParseResult<Instrument>;

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

function borne(valeur: number, min: number, max: number, defaut: number): number {
  if (!Number.isFinite(valeur)) return defaut;
  return valeur < min ? min : valeur > max ? max : valeur;
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
    suivant = withScale(suivant, patch.scaleName ?? scaleNameOf(suivant), patch.root ?? suivant.scale.root);
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
  return isBuiltInName(instrument.name);
}

/**
 * Le lien de partage (AIR-F-45, P8) : l'instrument entier dans le fragment.
 * Le fragment n'est jamais envoyé au serveur : c'est ce qui rend le partage
 * compatible avec « rien ne quitte ton navigateur ».
 * `origine` vient de la page, jamais d'une constante.
 */
export function shareLink(instrument: Instrument, origine: string, chemin = "/"): string {
  const base = origine.endsWith("/") ? origine.slice(0, -1) : origine;
  return `${base}${chemin}#i=${instrumentToFragment(instrument)}`;
}

/** Lecture du fragment de l'adresse courante, si elle porte un instrument. */
export function instrumentInLocation(hash: string): AcceptResult | null {
  const marqueur = hash.indexOf("#i=");
  if (marqueur < 0) return null;
  return instrumentFromFragment(hash.slice(marqueur + "#i=".length));
}

/** Ce que le chargement de la page retient de l'adresse (P8). */
export interface FragmentLecture {
  readonly instrument: Instrument;
  /** Les raisons du refus, quand le fragment porte un instrument illisible. */
  readonly refus: readonly string[] | null;
}

/**
 * Fragment absent : l'instrument par défaut, rien à signaler. Fragment valide :
 * il est sélectionné. Fragment invalide : le défaut s'applique, mais les
 * RAISONS sont rendues pour l'affichage — jamais de silence (AIR-F-43).
 */
export function lireFragment(hash: string, defaut: Instrument): FragmentLecture {
  const lu = instrumentInLocation(hash);
  if (lu === null) return { instrument: defaut, refus: null };
  if (lu.ok) return { instrument: lu.value, refus: null };
  return { instrument: defaut, refus: lu.reasons };
}

/**
 * Validation d'un fichier importé (AIR-F-43) : le schéma A4, seul juge.
 * Les raisons sont les phrases lisibles du schéma, en anglais (AIR-N-14).
 */
export function validate(raw: string): AcceptResult {
  let valeur: unknown;
  try {
    valeur = JSON.parse(raw);
  } catch {
    return { ok: false, reasons: ["the file is not readable JSON"] };
  }
  return parseInstrument(valeur);
}

/** Les instruments de l'utilisateur, gardés sur l'appareil (AIR-F-54). */
export function encodeMine(instruments: readonly Instrument[]): string {
  return JSON.stringify(instruments);
}

/**
 * Relecture du stockage : chaque entrée repasse par le schéma. Une entrée
 * abîmée est écartée, les autres restent — le tiroir ne casse jamais.
 */
export function decodeMine(raw: string | null): Instrument[] {
  if (raw === null) return [];
  let valeur: unknown;
  try {
    valeur = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(valeur)) return [];
  const gardes: Instrument[] = [];
  for (const entree of valeur) {
    const resultat = parseInstrument(entree);
    if (resultat.ok && !isBuiltInName(resultat.value.name)) gardes.push(resultat.value);
  }
  return gardes;
}

/** Un champ de l'éditeur, pour afficher chaque raison près de son champ. */
export type EditorField = "name" | "scale" | "root" | "range" | "count" | "snap" | "sound" | "form";

/** Une raison du schéma s'ouvre par son chemin : `scale.root: …`. */
export function reasonField(reason: string): EditorField {
  const chemin = reason.split(":")[0]?.trim() ?? "";
  if (chemin === "name") return "name";
  if (chemin === "scale.root" || chemin === "scale.steps.root") return "root";
  if (chemin.startsWith("scale")) return "scale";
  if (chemin.startsWith("range")) return "range";
  if (chemin.startsWith("strings") || chemin.startsWith("zones")) return "count";
  if (chemin === "snap") return "snap";
  if (chemin.startsWith("sound")) return "sound";
  return "form";
}

export type ReasonsByField = Readonly<Record<EditorField, readonly string[]>>;

const CHAMPS: readonly EditorField[] = ["name", "scale", "root", "range", "count", "snap", "sound", "form"];

/** Les raisons groupées par champ : l'éditeur valide en direct (AIR-F-44). */
export function reasonFields(reasons: readonly string[]): ReasonsByField {
  const groupes = Object.fromEntries(CHAMPS.map((champ) => [champ, [] as string[]])) as Record<EditorField, string[]>;
  for (const raison of reasons) groupes[reasonField(raison)].push(raison);
  return groupes;
}
