/**
 * Le modèle d'une image de scène : ce que le canevas dessine, construit à
 * partir de l'état courant. Pur, donc testable sans navigateur.
 */
import type { DetectedHand, Instrument } from "@thin-air/core";
import type { PlayRect, Settings } from "@thin-air/core";
import type { StageDisplay } from "../state/display.js";
import type { LoopState } from "../state/loopState.js";
import type { Tracking } from "../lib/tracking.js";
import type { Engine } from "../lib/engine.js";
import type { PointerState } from "../hooks/usePointerHands.js";
import type { FrameRequest } from "./SceneCanvas.js";
import { buildScene, type HandInput, type SceneModel } from "./geometry.js";
import { keyboardHand, pointerHand } from "../lib/virtualHand.js";

/** Ce dont la scène a besoin, rassemblé pour rester lisible à chaque image. */
export interface Miroir {
  instrument: Instrument;
  settings: Settings;
  display: StageDisplay;
  rect: PlayRect;
  reducedMotion: boolean;
  loop: LoopState;
  recording: boolean;
  mode: "camera" | "pointer";
  playing: boolean;
  handsCount: number;
  enregistres: import("@thin-air/core").MusicEvent[];
  suivi: Tracking | null;
  sansMainDepuis: number | null;
  pointer: { readonly current: PointerState };
  cameraHands: { readonly current: readonly HandInput[] };
  hovered: number | null;
}

/** Rapport largeur/hauteur de l'image : la capture est en 640 × 480 (§7.2). */
export const ASPECT = 4 / 3;

function formeCount(instrument: Instrument): number {
  return instrument.strings?.count ?? instrument.zones?.zones.length ?? 0;
}

/** Les mains dessinées : pointeur ou caméra, dans les coordonnées de la zone. */
export function mainsScene(etat: Miroir): readonly HandInput[] {
  if (etat.mode === "pointer") {
    const pointeur = etat.pointer.current;
    return pointeur.active
      ? [{ role: "pitch" as const, side: "right" as const, u: pointeur.u, v: pointeur.v }]
      : [];
  }
  return etat.cameraHands.current;
}

/**
 * Les mains analysées : celles du modèle, ou la main virtuelle du pointeur
 * (AIR-F-02) — le même chemin, donc le même moteur en aval.
 */
export function mainsCourantes(etat: Miroir, detected: readonly DetectedHand[]): readonly DetectedHand[] {
  if (etat.mode === "camera") return detected;
  const pointeur = etat.pointer.current;
  if (!pointeur.active) return [];
  return [
    pointeur.hovered === null
      ? pointerHand(pointeur.u, pointeur.v, etat.rect)
      : keyboardHand(pointeur.hovered, formeCount(etat.instrument), pointeur.v, etat.rect),
  ];
}

/** La position relevée pendant la calibration : celle de la main visible. */
export function positionCourante(etat: Miroir): { u: number; v: number } | null {
  const premiere = mainsScene(etat)[0];
  return premiere === undefined ? null : { u: premiere.u, v: premiere.v };
}

/** Le modèle d'une image, avec la traîne laissée par l'image précédente. */
export function construireModele(
  etat: Miroir,
  precedent: { current: SceneModel | null },
  frame: FrameRequest,
): SceneModel {
  const modele = buildScene({
    width: frame.width,
    height: frame.height,
    hands: mainsScene(etat),
    previous: precedent.current,
    display: etat.display,
    instrument: etat.instrument,
    rect: etat.rect,
    reducedMotion: etat.reducedMotion,
    settings: etat.settings,
    hovered: etat.mode === "pointer" ? etat.pointer.current.hovered : etat.hovered,
    dtS: frame.dtS,
  });
  precedent.current = modele;
  return modele;
}

/** Le moteur audio, vu par la boucle de jeu. */
export function sonnerie(engine: Engine | null) {
  return {
    play: (events: readonly import("@thin-air/core").MusicEvent[]) => engine?.play(events),
    releaseAll: () => engine?.releaseAll(),
  };
}
