/**
 * Le dessin de la scène (cahier §12.3) : fond de nuit, mains de fantôme d'un
 * trait clair, cordes qui vibrent, bougie dans la zone du chœur, courbe de
 * hauteur. Trois couleurs, aucun éclair, aucun clignotement.
 *
 * Le contexte est décrit par une interface minimale : les tests enregistrent
 * les appels sans canevas ni navigateur.
 */
import type { SceneModel } from "./geometry.js";

export interface PaintContext {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  stroke(): void;
  fill(): void;
}

/**
 * La palette de la séance. Les rapports de contraste sont mesurés contre le
 * fond de nuit (#0b0d12) et contre le fond de panneau (#151922) :
 *   os       #f2ece1 → 16,53:1 sur nuit, 14,96:1 sur panneau
 *   spectre  #7fd4c1 → 11,19:1 sur nuit, 10,13:1 sur panneau
 *   discret  #c9c2b4 → 10,98:1 sur nuit,  9,93:1 sur panneau
 * Le spectre ne sert jamais de texte sur fond clair (1,48:1) : c'est une
 * teinte de scène, pas une couleur de libellé.
 */
export const PALETTE = {
  night: "#0b0d12",
  panel: "#151922",
  bone: "#f2ece1",
  spectral: "#7fd4c1",
  dim: "#c9c2b4",
} as const;

export type Palette = typeof PALETTE;

/** Épaisseur du trait des mains, en pixels CSS. */
export const HAND_LINE = 2.5;
/** Rayon du nœud dessiné à la place d'une main. */
export const HAND_RADIUS = 9;

function alpha(niveau: number): number {
  if (!Number.isFinite(niveau)) return 0;
  return niveau < 0 ? 0 : niveau > 1 ? 1 : niveau;
}

function trail(ctx: PaintContext, model: SceneModel, palette: Palette): void {
  if (model.reducedMotion) return;
  for (const main of model.hands) {
    if (main.trail.length < 2) continue;
    ctx.strokeStyle = palette.spectral;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    main.trail.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function hands(ctx: PaintContext, model: SceneModel, palette: Palette): void {
  for (const main of model.hands) {
    ctx.strokeStyle = palette.bone;
    ctx.fillStyle = palette.bone;
    ctx.lineWidth = HAND_LINE;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(main.x, main.y, HAND_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function strings(ctx: PaintContext, model: SceneModel, palette: Palette): void {
  const rect = model.playRect;
  const haut = (1 - rect.v1) * model.height;
  const bas = (1 - rect.v0) * model.height;
  for (const corde of model.strings) {
    const x = corde.u * model.width;
    const sonne = corde.energy > 0;
    ctx.strokeStyle = sonne ? palette.spectral : palette.dim;
    ctx.lineWidth = sonne ? 1 + 2 * corde.energy : 1;
    ctx.globalAlpha = sonne ? 0.35 + 0.65 * alpha(corde.energy) : 0.35;
    ctx.beginPath();
    ctx.moveTo(x, haut);
    ctx.lineTo(x, bas);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function zones(ctx: PaintContext, model: SceneModel, palette: Palette): void {
  for (const zone of model.zones) {
    const x = zone.u0 * model.width;
    const y = (1 - zone.v1) * model.height;
    const largeur = (zone.u1 - zone.u0) * model.width;
    const hauteur = (zone.v1 - zone.v0) * model.height;
    ctx.strokeStyle = palette.dim;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + largeur, y);
    ctx.lineTo(x + largeur, y + hauteur);
    ctx.lineTo(x, y + hauteur);
    ctx.stroke();
    if (zone.candle > 0) candle(ctx, palette, x + largeur / 2, y + hauteur / 2, zone.candle);
  }
  ctx.globalAlpha = 1;
}

/** La bougie du chœur : un halo spectral dont l'intensité suit le niveau. */
function candle(ctx: PaintContext, palette: Palette, x: number, y: number, niveau: number): void {
  const force = alpha(niveau);
  ctx.fillStyle = palette.spectral;
  ctx.globalAlpha = 0.18 * force;
  ctx.beginPath();
  ctx.arc(x, y, 26 * (0.6 + 0.4 * force), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + 0.5 * force;
  ctx.beginPath();
  ctx.arc(x, y, 4 + 3 * force, 0, Math.PI * 2);
  ctx.fill();
}

function curve(ctx: PaintContext, model: SceneModel, palette: Palette): void {
  if (model.curve.length < 2) return;
  ctx.strokeStyle = palette.spectral;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  model.curve.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Le rectangle de jeu, discret : la zone calibrée reste visible (§12.4). */
function playRect(ctx: PaintContext, model: SceneModel, palette: Palette): void {
  const rect = model.playRect;
  const x = rect.u0 * model.width;
  const y = (1 - rect.v1) * model.height;
  ctx.strokeStyle = palette.dim;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + (rect.u1 - rect.u0) * model.width, y);
  ctx.lineTo(x + (rect.u1 - rect.u0) * model.width, y + (rect.v1 - rect.v0) * model.height);
  ctx.lineTo(x, y + (rect.v1 - rect.v0) * model.height);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Une image de scène. `cameraLayer` dessine l'image de caméra atténuée AVANT
 * la scène quand le réglage le demande (AIR-F-52) ; par défaut elle est
 * absente, et aucune image n'est copiée dans le canevas.
 */
export function paintScene(
  ctx: PaintContext,
  model: SceneModel,
  palette: Palette = PALETTE,
  cameraLayer?: () => void,
): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.night;
  ctx.fillRect(0, 0, model.width, model.height);
  if (model.showCamera && cameraLayer !== undefined) cameraLayer();
  playRect(ctx, model, palette);
  zones(ctx, model, palette);
  strings(ctx, model, palette);
  curve(ctx, model, palette);
  trail(ctx, model, palette);
  hands(ctx, model, palette);
}
