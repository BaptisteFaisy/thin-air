/**
 * La main virtuelle (AIR-F-02, parcours P2) : une géométrie canonique à 21
 * points, dans l'ordre du modèle (§7.3), fabriquée autour d'un point d'écran.
 *
 * Ce fichier ne contient QUE de la géométrie — aucune note, aucune gamme,
 * aucun volume (cahier §11.1 : aucune logique musicale dans `vision`). Les
 * points produits sont au même format que ceux du modèle, donc le moteur en
 * aval est exactement le même qu'avec une caméra.
 *
 * Repère : les points sont en coordonnées d'IMAGE (x vers la droite, y vers le
 * bas), comme le modèle. L'écran, lui, est en miroir et `v` croît vers le haut
 * (§7.4) : `screenToImage` fait donc le retournement une seule fois, ici, et
 * le repère de jeu de `core` retrouve la position du curseur sans surprise.
 */
import { clamp01 } from "@thin-air/core";
import type { DetectedHand, HandPoint, HandSide } from "@thin-air/core";

/** Décalages bruts, en unités d'échelle de paume, y vers le bas. */
const BRUTS: readonly (readonly [number, number])[] = [
  [0.0, 0.85], //  0 poignet
  [0.28, 0.62], //  1 pouce, base haute
  [0.44, 0.4], //  2 pouce, articulation
  [0.52, 0.24], //  3 pouce, dernière phalange
  [0.58, 0.1], //  4 bout du pouce
  [0.02, 0.3], //  5 base de l'index
  [-0.01, 0.1], //  6 index, première phalange
  [-0.03, -0.05], //  7 index, deuxième phalange
  [-0.04, -0.18], //  8 bout de l'index
  [-0.14, 0.32], //  9 base du majeur
  [-0.17, 0.08], // 10
  [-0.19, -0.1], // 11
  [-0.2, -0.24], // 12 bout du majeur
  [-0.28, 0.36], // 13 base de l'annulaire
  [-0.32, 0.14], // 14
  [-0.34, -0.03], // 15
  [-0.35, -0.16], // 16 bout de l'annulaire
  [-0.4, 0.42], // 17 base de l'auriculaire
  [-0.45, 0.24], // 18
  [-0.47, 0.1], // 19
  [-0.48, -0.02], // 20 bout de l'auriculaire
];

/** Les cinq points dont la moyenne est le centre de la paume (§7.4). */
export const PAUME_INDEX = [0, 5, 9, 13, 17] as const;
/** Le bout de l'index, pointeur fin des gestes (§7.4). */
export const INDEX_INDEX = 8;

const NB_POINTS = 21;

function point(bruts: readonly (readonly [number, number])[], index: number): readonly [number, number] {
  return bruts[index] ?? [0, 0];
}

/** Translate les décalages pour que le point d'ancrage soit à l'origine. */
function ancrer(bruts: readonly (readonly [number, number])[], index: number) {
  const [ax, ay] = point(bruts, index);
  return bruts.map(([x, y]) => [x - ax, y - ay] as const);
}

function ancrerSurPaume(bruts: readonly (readonly [number, number])[]) {
  let sx = 0;
  let sy = 0;
  for (const index of PAUME_INDEX) {
    const [x, y] = point(bruts, index);
    sx += x;
    sy += y;
  }
  const n = PAUME_INDEX.length;
  return bruts.map(([x, y]) => [x - sx / n, y - sy / n] as const);
}

/** Décalages prêts à l'emploi, selon le point qui suit le curseur. */
export const OFFSETS_PALM = ancrerSurPaume(BRUTS);
export const OFFSETS_INDEX = ancrer(BRUTS, INDEX_INDEX);

export type HandAnchor = "palm" | "index";
/** Main ouverte, ou pincée (pouce et index réunis) : le clic du pointeur. */
export type HandPose = "open" | "pinch";

export interface VirtualHandOptions {
  readonly side?: HandSide;
  /** Taille de la main, en fraction de la hauteur de l'image. */
  readonly scale?: number;
  readonly anchor?: HandAnchor;
  readonly pose?: HandPose;
}

const ECHELLE_DEFAUT = 0.18;

/** Écran (u vers la droite, v vers le haut) → image (x vers la droite, y vers le bas). */
export function screenToImage(u: number, v: number): readonly [number, number] {
  return [clamp01(1 - u), clamp01(1 - v)];
}

/** Position du curseur dans un rectangle d'écran, en u/v d'écran. */
export function normalisePointer(
  clientX: number,
  clientY: number,
  rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
): { readonly u: number; readonly v: number } {
  const largeur = rect.width > 0 ? rect.width : 1;
  const hauteur = rect.height > 0 ? rect.height : 1;
  return {
    u: clamp01((clientX - rect.left) / largeur),
    v: clamp01(1 - (clientY - rect.top) / hauteur),
  };
}

function decales(anchor: HandAnchor, pose: HandPose) {
  const base = anchor === "palm" ? OFFSETS_PALM : OFFSETS_INDEX;
  if (pose !== "pinch") return base;
  // Pince : le pouce rejoint le bout de l'index, le reste ne bouge pas.
  const cible = point(base, INDEX_INDEX);
  return base.map((offset, index) => (index === 4 ? cible : offset));
}

/**
 * Une main de 21 points ancrée sur (x, y) en coordonnées d'image. Pure et
 * déterministe : mêmes entrées, exactement mêmes points.
 */
export function virtualHand(x: number, y: number, options: VirtualHandOptions = {}): DetectedHand {
  const echelle = options.scale ?? ECHELLE_DEFAUT;
  const offsets = decales(options.anchor ?? "index", options.pose ?? "open");
  const points: HandPoint[] = offsets.map(([dx, dy]) => [
    clamp01(x + dx * echelle),
    clamp01(y + dy * echelle),
    0,
  ]);
  return { side: options.side ?? "right", score: 1, points };
}

/** Vérifie qu'une main virtuelle est conforme au contrat du modèle. */
export function isWellFormed(hand: DetectedHand): boolean {
  return (
    hand.points.length === NB_POINTS &&
    (hand.side === "left" || hand.side === "right") &&
    hand.points.every(
      (point) =>
        point.length === 3 &&
        point.every((valeur) => Number.isFinite(valeur) && valeur >= 0 && valeur <= 1),
    )
  );
}

/** État du jeu au clavier, en coordonnées d'écran (u à droite, v en haut). */
export interface KeyboardPosition {
  readonly u: number;
  readonly v: number;
}

export const POSITION_DEPART: KeyboardPosition = { u: 0.5, v: 0.5 };

/**
 * Rangée de touches qui « joue » en posant la main sur une colonne : c'est le
 * moteur en aval qui en fait une note, ici ce n'est qu'une position (§11.1).
 */
export const NOTE_KEYS: readonly string[] = [
  "KeyA", "KeyW", "KeyS", "KeyE", "KeyD", "KeyF", "KeyT",
  "KeyG", "KeyY", "KeyH", "KeyU", "KeyJ", "KeyK",
];

export const POSITION_DEFAUT: KeyboardPosition = POSITION_DEPART;

/** La colonne d'une touche de la rangée, de 0 à 1 ; `null` si absente. */
export function keyToU(code: string, keys: readonly string[] = NOTE_KEYS): number | null {
  const index = keys.indexOf(code);
  if (index < 0 || keys.length < 2) return null;
  return clamp01(index / (keys.length - 1));
}

/**
 * Déplace la position au clavier : les flèches bougent la main, la rangée de
 * notes la pose sur une colonne. Toute autre touche ne change rien.
 */
export function applyKey(
  position: KeyboardPosition,
  code: string,
  step = 0.05,
  keys: readonly string[] = NOTE_KEYS,
): KeyboardPosition {
  const pas = Number.isFinite(step) && step > 0 ? step : 0.05;
  switch (code) {
    case "ArrowLeft":
      return { ...position, u: clamp01(position.u - pas) };
    case "ArrowRight":
      return { ...position, u: clamp01(position.u + pas) };
    case "ArrowUp":
      return { ...position, v: clamp01(position.v + pas) };
    case "ArrowDown":
      return { ...position, v: clamp01(position.v - pas) };
    default: {
      const colonne = keyToU(code, keys);
      return colonne === null ? position : { ...position, u: colonne };
    }
  }
}
