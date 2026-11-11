/**
 * La géométrie de la scène (cahier §11.8, §12.3) : ce qui est dessiné, sans
 * jamais toucher au canevas. Tout est pur, donc testable sans DOM.
 *
 * Trois couleurs seulement (nuit, os, teinte spectrale), aucune traîne ni
 * vibration quand le système demande moins de mouvement, et des niveaux qui
 * changent à vitesse bornée : rien ne peut clignoter plus de trois fois par
 * seconde (AIR-N-06).
 */
import type { HandRole, HandSide, Instrument, PlayRect, Settings } from "@thin-air/core";
import type { StageDisplay } from "../state/display.js";
import { shapeOf } from "../state/instruments.js";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface HandScene {
  readonly role: HandRole;
  readonly side: HandSide;
  readonly x: number;
  readonly y: number;
  /** Traîne légère : les dernières positions, de la plus ancienne à la plus récente. */
  readonly trail: readonly Vec2[];
}

export interface StringScene {
  /** Position horizontale, de 0 à 1 dans la zone de jeu. */
  readonly u: number;
  /** Énergie de vibration, de 0 à 1. */
  readonly energy: number;
}

export interface ZoneScene {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  /** Bougie : 0 éteinte, 1 allumée. */
  readonly candle: number;
}

export interface SceneModel {
  readonly width: number;
  readonly height: number;
  readonly hands: readonly HandScene[];
  readonly strings: readonly StringScene[];
  readonly zones: readonly ZoneScene[];
  /** Courbe de hauteur derrière la main du thérémine. */
  readonly curve: readonly Vec2[];
  readonly playRect: PlayRect;
  readonly reducedMotion: boolean;
  readonly showCamera: boolean;
  /** Corde ou zone visée par le pointeur, sans caméra (P2). */
  readonly hovered: number | null;
}

/** Longueur de la traîne, en points ; nulle quand le mouvement est réduit. */
export const TRAIL_MAX = 10;
/** Vitesse maximale d'un niveau (0→1 en un tiers de seconde) : borne le clignotement. */
export const LEVEL_SPEED = 3;
/** Demi-vie de l'énergie d'une corde, en secondes. */
export const STRING_HALF_LIFE_S = 0.35;

/**
 * Une main suivie, telle que la fournit le moteur (caméra, pointeur ou rejeu).
 * Les positions sont déjà dans la zone de jeu : 0 à 1 de large et de haut,
 * miroir compris (c'est la sortie de `core.space.toPlayPosition`).
 */
export interface HandInput {
  readonly role: HandRole;
  readonly side: HandSide;
  readonly u: number;
  readonly v: number;
}

export interface SceneInput {
  readonly width: number;
  readonly height: number;
  readonly hands: readonly HandInput[];
  readonly previous: SceneModel | null;
  readonly display: StageDisplay;
  readonly instrument: Instrument;
  readonly rect: PlayRect;
  readonly reducedMotion: boolean;
  readonly settings: Settings;
  readonly hovered: number | null;
  readonly dtS: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Un niveau qui monte ou descend sans à-coup : jamais plus vite que `LEVEL_SPEED`. */
export function moveLevel(previous: number, target: number, dtS: number): number {
  const depart = clamp01(previous);
  const vise = clamp01(target);
  const pas = LEVEL_SPEED * Math.max(0, Number.isFinite(dtS) ? dtS : 0);
  if (Math.abs(vise - depart) <= pas) return vise;
  return vise > depart ? depart + pas : depart - pas;
}

/** Énergie d'une corde : décroissance exponentielle, nulle sans mouvement. */
export function decayEnergy(previous: number, dtS: number, halfLifeS = STRING_HALF_LIFE_S): number {
  const depart = clamp01(previous);
  const secondes = Number.isFinite(dtS) ? Math.max(0, dtS) : 0;
  if (secondes === 0 || halfLifeS <= 0) return depart;
  return depart * Math.pow(0.5, secondes / halfLifeS);
}

/** Traîne : on ajoute le point courant, on coupe au-delà de `TRAIL_MAX`. */
export function pushTrail(trail: readonly Vec2[], point: Vec2, reducedMotion: boolean): readonly Vec2[] {
  if (reducedMotion) return [];
  const suivante = [...trail, point];
  return suivante.length > TRAIL_MAX ? suivante.slice(suivante.length - TRAIL_MAX) : suivante;
}

/** Positions des cordes dans la zone : la corde i est au centre de sa part. */
export function stringPositions(count: number): readonly number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => (index + 0.5) / count);
}

function toScreenX(u: number, width: number, rect: PlayRect): number {
  return (rect.u0 + clamp01(u) * (rect.u1 - rect.u0)) * width;
}

function toScreenY(v: number, height: number, rect: PlayRect): number {
  return (1 - (rect.v0 + clamp01(v) * (rect.v1 - rect.v0))) * height;
}

/** La courbe de hauteur : les dernières notes, de gauche à droite. */
export function curvePoints(
  trace: readonly number[],
  low: number,
  high: number,
  width: number,
  height: number,
  rect: PlayRect,
  reducedMotion: boolean,
): readonly Vec2[] {
  if (reducedMotion || trace.length < 2 || high <= low) return [];
  const pas = (rect.u1 - rect.u0) / (trace.length - 1);
  return trace.map((midi, index) => {
    const u = rect.u0 + pas * index;
    const v = clamp01((midi - low) / (high - low));
    return { x: u * width, y: (1 - v) * height };
  });
}

function handScenes(input: SceneInput): readonly HandScene[] {
  const avant = input.previous?.hands ?? [];
  return input.hands.map((main) => {
    const x = toScreenX(main.u, input.width, input.rect);
    const y = toScreenY(main.v, input.height, input.rect);
    const precedent = avant.find((ancienne) => ancienne.side === main.side && ancienne.role === main.role);
    return {
      role: main.role,
      side: main.side,
      x,
      y,
      trail: pushTrail(precedent?.trail ?? [], { x, y }, input.reducedMotion),
    };
  }).slice(0, indexMax(input.settings));
}

function indexMax(settings: Settings): number {
  return settings.oneHand ? 1 : 2;
}

function stringScenes(input: SceneInput): readonly StringScene[] {
  const forme = shapeOf(input.instrument);
  if (forme.kind !== "strings") return [];
  const avant = input.previous?.strings ?? [];
  const allumees = new Set(input.display.pluckedStrings);
  if (input.hovered !== null) allumees.add(input.hovered);
  return stringPositions(forme.count).map((u, index) => {
    const precedente = avant[index]?.energy ?? 0;
    const cible = allumees.has(index) ? 1 : 0;
    const energie = input.reducedMotion ? cible : Math.max(decayEnergy(precedente, input.dtS), cible);
    return { u, energy: clamp01(energie) };
  });
}

function zoneScenes(input: SceneInput): readonly ZoneScene[] {
  const zones = input.instrument.zones?.zones ?? [];
  const avant = input.previous?.zones ?? [];
  const allumees = new Set(input.display.litZones);
  if (input.hovered !== null && zones.length > 0) allumees.add(input.hovered);
  return zones.map((zone, index) => {
    const precedente = avant[index]?.candle ?? 0;
    const cible = allumees.has(index) ? 1 : 0;
    return {
      u0: zone.u0,
      u1: zone.u1,
      v0: zone.v0,
      v1: zone.v1,
      candle: moveLevel(precedente, cible, input.dtS),
    };
  });
}

/** Le modèle complet d'une image : une seule fonction, aucun état caché. */
export function buildScene(input: SceneInput): SceneModel {
  const etendue = input.instrument.range ?? { low: 45, high: 81 };
  return {
    width: input.width,
    height: input.height,
    hands: handScenes(input),
    strings: stringScenes(input),
    zones: zoneScenes(input),
    curve: curvePoints(
      input.display.pitchTrace,
      etendue.low,
      etendue.high,
      input.width,
      input.height,
      input.rect,
      input.reducedMotion,
    ),
    playRect: input.rect,
    reducedMotion: input.reducedMotion,
    showCamera: input.settings.showCamera,
    hovered: input.hovered,
  };
}

/** Corde ou zone sous le pointeur (jeu sans caméra, P2). */
export function hoveredIndex(model: Pick<SceneModel, "strings" | "zones">, u: number, v: number): number | null {
  if (model.strings.length > 0) {
    const positions = model.strings.map((corde) => corde.u);
    return nearestIndex(positions, u);
  }
  const zone = model.zones.findIndex(
    (candidate) => u >= candidate.u0 && u <= candidate.u1 && v >= candidate.v0 && v <= candidate.v1,
  );
  return zone < 0 ? null : zone;
}

function nearestIndex(positions: readonly number[], valeur: number): number | null {
  if (positions.length === 0) return null;
  let meilleur = 0;
  let ecart = Math.abs((positions[0] ?? 0) - valeur);
  for (let index = 1; index < positions.length; index += 1) {
    const courant = Math.abs((positions[index] ?? 0) - valeur);
    if (courant < ecart) {
      ecart = courant;
      meilleur = index;
    }
  }
  return meilleur;
}
