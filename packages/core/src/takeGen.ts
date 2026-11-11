/**
 * Générateurs de prises de synthèse (cahier §7.11, §13.3).
 *
 * Ce sont elles qui nourrissent les propriétés de la section 13 : aucune caméra
 * réelle n'est utilisée en CI (AIR-N-10), et rien ici ne contient d'image —
 * seulement des instants, des côtés, des scores et des points (AIR-F-47).
 *
 * **Convention de coordonnées.** Une prise de synthèse est écrite dans les
 * MÊMES coordonnées qu'une prise réelle : x de 0 à 1 vers la droite de l'IMAGE
 * brute, y de 0 à 1 vers le bas. Le miroir est appliqué en aval par
 * `space.toPlayPosition` (AIR-F-05), jamais ici. Pour placer une main à une
 * position `u`/`v` de la zone de jeu, on passe par `uToImageX` / `vToImageY`,
 * qui font la conversion inverse du §7.4 — c'est ce qui permet de rejouer
 * exactement l'exemple chiffré de la harpe (§7.14).
 *
 * **Géométrie de la main.** Les 21 points sont posés dans un repère local de la
 * main, en unités de l'échelle `s` (distance poignet → base du majeur), puis
 * translatés et mis à l'échelle. Le repère local est centré sur la moyenne des
 * cinq points de la paume (0, 5, 9, 13, 17) : `palmCenter` retrouve donc la pose
 * au bit près, et `palmScale` retrouve `s` au bit près. Le pouce est posé à
 * `pinch × s` du bout de l'index : `pinchValue` retrouve `pinch` exactement.
 * L'ouverture allonge les doigts : `openValue` croît strictement avec `open`.
 */
import type { DetectedHand, HandPoint, HandSide, Take, TakeFrame } from "./types.js";
import { defaultPlayRect } from "./defaults.js";
import type { PlayRect } from "./types.js";
import { clamp01 } from "./space.js";

export interface HandPose {
  /** Position du centre de la paume, en coordonnées d'image brute 0..1. */
  readonly x: number;
  readonly y: number;
  /** Distance poignet-base du majeur, en fraction de l'image. */
  readonly scale?: number;
  /** 0 = poing, 1 = main à plat. */
  readonly open?: number;
  /** 0 = pince serrée, 1 = pouce et index écartés. */
  readonly pinch?: number;
  readonly side?: HandSide;
  readonly score?: number;
}

export interface SynthOptions {
  readonly fps?: number;
  readonly durationS?: number;
  readonly seed?: number;
  /** Hauteur dans la zone de jeu, pour les balayages (0,5 par défaut). */
  readonly v?: number;
}

export const FPS_DEFAUT = 30;
export const DUREE_DEFAUT = 3;
export const SCALE_DEFAUT = 0.12;
export const OPEN_DEFAUT = 0.8;
export const PINCH_DEFAUT = 0.6;
const POINTS_PAR_MAIN = 21;

type Vec = readonly [number, number];

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const norme = (a: Vec): number => Math.hypot(a[0], a[1]);
function unitaire(a: Vec): Vec {
  const n = norme(a);
  return n > 0 ? [a[0] / n, a[1] / n] : [0, 0];
}
/** Perpendiculaire tournée vers le côté du pouce (dépend du côté de la main). */
const perpendiculaire = (a: Vec, cote: number): Vec => [a[1] * cote, -a[0] * cote];
function interpole(a: Vec, b: Vec, k: number): Vec {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/**
 * Les cinq points de la paume, en unités de `s`, dans un repère où le poignet
 * est en bas (y positif vers le bas de l'image) et les doigts en haut.
 * Index : 0 poignet, 1 base de l'index, 2 base du majeur, 3 base de
 * l'annulaire, 4 base de l'auriculaire.
 */
const PAUME: readonly Vec[] = [
  [0, 0.55],
  [-0.3, -0.45],
  [-0.1, -0.5],
  [0.1, -0.48],
  [0.28, -0.4],
];

/** Les cinq points de référence du contrat : poignet et bases des doigts. */
const INDEX_PAUME = [0, 5, 9, 13, 17] as const;

/** Centre du repère local : la moyenne des cinq points de la paume. */
const CENTRE_PAUME: Vec = (() => {
  const somme = PAUME.reduce((acc, p) => add(acc, p), [0, 0] as Vec);
  return mul(somme, 1 / PAUME.length);
})();

/** Distance poignet → base du majeur dans le repère local, pour normaliser à `s`. */
const UNITE_PAUME = norme(sub(PAUME[2]!, PAUME[0]!));

/** Longueurs de doigt, en unités de `s` : index, majeur, annulaire, auriculaire. */
const LONGUEURS: readonly number[] = [0.95, 1.05, 0.95, 0.8];
/** Position des trois phalanges le long du doigt, en fraction de sa longueur. */
const PHALANGES: readonly number[] = [0.45, 0.75, 1];
/** Repli vers la paume pour chaque phalange, quand la main est fermée. */
const REPLI: readonly number[] = [0.2, 0.3, 0.42];

/** Un doigt : sa base locale et son axe, pour les trois phalanges. */
function doigt(base: Vec, poignet: Vec, longueur: number, open: number, cote: number): Vec[] {
  const axe = unitaire(sub(base, poignet));
  const vers = perpendiculaire(axe, cote);
  return PHALANGES.map((fraction, i) => {
    const tendu = add(base, mul(axe, longueur * fraction));
    const replie = add(add(base, mul(axe, longueur * fraction * (1 - REPLI[i]!))),
      mul(vers, longueur * fraction * REPLI[i]!));
    return interpole(replie, tendu, open);
  });
}

/**
 * Le pouce : trois articulations libres, puis le bout posé à `pinch × s` du
 * bout de l'index, perpendiculairement au doigt. L'écart est exact : comme
 * `palmScale` vaut `s`, `pinchValue` retrouve `pinch` au bit près.
 */
function pouce(poignet: Vec, boutIndex: Vec, pinch: number, cote: number): Vec[] {
  const axe = unitaire(sub(boutIndex, poignet));
  const versLePouce = perpendiculaire(axe, -cote);
  const cmc = add(poignet, mul(versLePouce, 0.3));
  const mcp = add(poignet, add(mul(axe, 0.3), mul(versLePouce, 0.45)));
  const bout = add(boutIndex, mul(versLePouce, Math.max(0, pinch) * UNITE_PAUME));
  const ip = interpole(mcp, bout, 0.6);
  return [cmc, mcp, ip, bout];
}

/**
 * Fabrique les 21 points d'une main plausible pour une pose donnée.
 * Déterministe : mêmes arguments, exactement mêmes nombres.
 */
export function makeHand(pose: HandPose): DetectedHand {
  const cote: HandSide = pose.side ?? "right";
  const miroir = cote === "left" ? -1 : 1;
  const s = pose.scale ?? SCALE_DEFAUT;
  const open = clamp01(pose.open ?? OPEN_DEFAUT);
  const pinch = Math.max(0, pose.pinch ?? PINCH_DEFAUT);

  // Paume dans le repère local (miroir pour une main gauche) : poignet + 4 bases.
  const paume = PAUME.map((p) => [p[0]! * miroir, p[1]!] as Vec);
  const poignet = paume[0]!;
  // Chaque doigt : trois phalanges (PIP, DIP, bout) dans le repère local.
  const doigts = [1, 2, 3, 4].map((i, d) =>
    doigt(paume[i]!, poignet, LONGUEURS[d]!, open, miroir));
  const pouces = pouce(poignet, doigts[0]![2]!, pinch, miroir);

  // Placement dans les 21 emplacements du contrat (§7.3).
  const local: Vec[] = new Array(POINTS_PAR_MAIN).fill([0, 0] as Vec);
  local[0] = poignet;
  INDEX_PAUME.forEach((emplacement, k) => {
    local[emplacement] = paume[k]!;
  });
  doigts.forEach((phalanges, d) => {
    phalanges.forEach((point, k) => {
      local[6 + 4 * d + k] = point; // 6,7,8 · 10,11,12 · 14,15,16 · 18,19,20
    });
  });
  pouces.forEach((point, k) => {
    local[1 + k] = point; // 1, 2, 3, 4
  });

  // Repère local → image : centré sur la paume (miroir inclus), normalisé par s.
  const centreLocal: Vec = [CENTRE_PAUME[0]! * miroir, CENTRE_PAUME[1]!];
  const points: HandPoint[] = local.map((p, i) => {
    const centre = [(p[0] - centreLocal[0]) / UNITE_PAUME,
      (p[1] - centreLocal[1]) / UNITE_PAUME] as Vec;
    const z = i === 0 ? 0 : -Math.min(0.9, (norme(sub(p, poignet)) * s) / 2);
    return [clamp01(pose.x + centre[0] * s), clamp01(pose.y + centre[1] * s), z];
  });
  return { side: cote, score: pose.score ?? 0.97, points };
}

/** Conversion inverse du §7.4 : une position `u` de la zone de jeu en x d'image. */
export function uToImageX(u: number, rect: PlayRect = defaultPlayRect()): number {
  return clamp01(1 - (rect.u0 + u * (rect.u1 - rect.u0)));
}

/** Conversion inverse du §7.4 : une position `v` de la zone de jeu en y d'image. */
export function vToImageY(v: number, rect: PlayRect = defaultPlayRect()): number {
  return clamp01(1 - (rect.v0 + v * (rect.v1 - rect.v0)));
}

/** Pose exprimée dans la zone de jeu plutôt que dans l'image. */
export function poseFromPlay(u: number, v: number, reste?: Omit<HandPose, "x" | "y">): HandPose {
  return { x: uToImageX(u), y: vToImageY(v), ...(reste ?? {}) };
}

export function frame(t: number, hands: readonly DetectedHand[]): TakeFrame {
  return { t, hands };
}

function images(options?: SynthOptions): number {
  const fps = options?.fps ?? FPS_DEFAUT;
  const duree = options?.durationS ?? DUREE_DEFAUT;
  return Math.max(1, Math.round(duree * fps) + 1);
}

function horodatage(i: number, fps: number): number {
  return i / fps;
}

/** Main qui avance à vitesse constante d'une pose à l'autre. */
export function linearTake(from: HandPose, to: HandPose, options?: SynthOptions): Take {
  const fps = options?.fps ?? FPS_DEFAUT;
  const n = images(options);
  const frames = Array.from({ length: n }, (_, i) => {
    const k = n > 1 ? i / (n - 1) : 0;
    const pose: HandPose = {
      x: from.x + (to.x - from.x) * k,
      y: from.y + (to.y - from.y) * k,
      scale: (from.scale ?? SCALE_DEFAUT) + ((to.scale ?? SCALE_DEFAUT) - (from.scale ?? SCALE_DEFAUT)) * k,
      open: (from.open ?? OPEN_DEFAUT) + ((to.open ?? OPEN_DEFAUT) - (from.open ?? OPEN_DEFAUT)) * k,
      pinch: (from.pinch ?? PINCH_DEFAUT) + ((to.pinch ?? PINCH_DEFAUT) - (from.pinch ?? PINCH_DEFAUT)) * k,
      side: from.side ?? to.side ?? "right",
    };
    return frame(horodatage(i, fps), [makeHand(pose)]);
  });
  return { format: "thin-air-take/1", fps, frames };
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : jamais `Math.random`. */
export function alea(seed: number): () => number {
  let etat = seed >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Main qui tremble autour d'une position. L'amplitude est une fraction de la
 * largeur de l'image ; le tremblement est la somme de deux sinusoïdes et d'un
 * bruit à graine, donc reproductible.
 */
export function tremorTake(center: HandPose, amplitude: number, options?: SynthOptions): Take {
  const fps = options?.fps ?? FPS_DEFAUT;
  const n = images(options);
  const tirage = alea(options?.seed ?? 12345);
  const bruit = Array.from({ length: n }, () => tirage() - 0.5);
  const frames = Array.from({ length: n }, (_, i) => {
    const t = horodatage(i, fps);
    const dx = amplitude * (0.6 * Math.sin(2 * Math.PI * 7 * t) + 0.4 * bruit[i]!);
    const dy = amplitude * (0.5 * Math.sin(2 * Math.PI * 5.3 * t + 1) + 0.3 * bruit[i]!);
    return frame(t, [makeHand({ ...center, x: clamp01(center.x + dx), y: clamp01(center.y + dy) })]);
  });
  return { format: "thin-air-take/1", fps, frames };
}

/**
 * Index qui traverse des cordes : balayage de `fromU` à `toU` (positions de la
 * ZONE DE JEU, converties en image), main ouverte, à hauteur constante.
 */
export function sweepTake(fromU: number, toU: number, options?: SynthOptions): Take {
  const v = options?.v ?? 0.5;
  return linearTake(
    poseFromPlay(fromU, v, { open: 1, pinch: 1, side: "right" }),
    poseFromPlay(toU, v, { open: 1, pinch: 1, side: "right" }),
    options?.durationS === undefined ? { ...options, durationS: 0.5 } : options,
  );
}

/** Main qui sort du cadre : plus aucune main après `leaveAtS`. */
export function handLeavesTake(pose: HandPose, leaveAtS: number, options?: SynthOptions): Take {
  const fps = options?.fps ?? FPS_DEFAUT;
  const n = images(options);
  const frames = Array.from({ length: n }, (_, i) => {
    const t = horodatage(i, fps);
    return frame(t, t < leaveAtS ? [makeHand(pose)] : []);
  });
  return { format: "thin-air-take/1", fps, frames };
}

/**
 * Deux mains qui se croisent sans jamais disparaître (AIR-P-21) : elles
 * partent des deux bords et échangent leurs positions à mi-chemin.
 */
export function crossingHandsTake(options?: SynthOptions): Take {
  const fps = options?.fps ?? FPS_DEFAUT;
  const n = images(options);
  const v = 0.5;
  const frames = Array.from({ length: n }, (_, i) => {
    const k = n > 1 ? i / (n - 1) : 0;
    const uGauche = 0.15 + 0.7 * k;
    const uDroite = 0.85 - 0.7 * k;
    return frame(horodatage(i, fps), [
      makeHand(poseFromPlay(uGauche, v, { side: "left", open: 0.9, pinch: 0.8 })),
      makeHand(poseFromPlay(uDroite, v, { side: "right", open: 0.9, pinch: 0.8 })),
    ]);
  });
  return { format: "thin-air-take/1", fps, frames };
}

/** Une seule main gauche levée : fixe la convention de côté du §7.3. */
export function leftHandOnlyTake(options?: SynthOptions): Take {
  const fps = options?.fps ?? FPS_DEFAUT;
  const n = images(options);
  const frames = Array.from({ length: n }, (_, i) =>
    frame(horodatage(i, fps), [makeHand(poseFromPlay(0.4, 0.5, { side: "left" }))]));
  return { format: "thin-air-take/1", fps, frames };
}

/**
 * Images manquantes : retire une image toutes les `every` images SANS réécrire
 * les horodatages restants — la cadence devient irrégulière, c'est le cas
 * limite « images manquantes » du §14.6.
 */
export function withDroppedFrames(take: Take, every: number, options?: SynthOptions): Take {
  void options;
  if (every < 2) return take;
  const frames = take.frames.filter((_, i) => i % every !== every - 1);
  return { format: take.format, fps: take.fps, frames };
}

/** Ajoute (ou remplace) une main sur chaque image d'une prise existante. */
export function withHand(take: Take, hand: (t: number) => DetectedHand | null): Take {
  const frames = take.frames.map((image) => {
    const ajout = hand(image.t);
    return ajout === null ? image : frame(image.t, [...image.hands, ajout]);
  });
  return { format: take.format, fps: take.fps, frames };
}

/** Coup bref et rapide : la main traverse la zone en un dixième de seconde. */
export function fastJabTake(options?: SynthOptions): Take {
  const fps = options?.fps ?? FPS_DEFAUT;
  const n = images(options);
  const frames = Array.from({ length: n }, (_, i) => {
    const t = horodatage(i, fps);
    const dedans = t >= 0.4 && t <= 0.5;
    return frame(t, dedans ? [makeHand(poseFromPlay(0.5, 0.9 - (t - 0.4) * 6, { open: 0.2 }))] : []);
  });
  return { format: "thin-air-take/1", fps, frames };
}
