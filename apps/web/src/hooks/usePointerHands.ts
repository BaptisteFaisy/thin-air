/**
 * Le jeu sans caméra (AIR-F-02, parcours P2) : le pointeur fait une main, le
 * clavier pince les cordes ou pose la main dans une zone. Le chemin en aval
 * est exactement celui de la caméra — seules les positions diffèrent.
 */
import { useEffect, useRef, type RefObject } from "react";
import { toPlayPosition, type PlayRect } from "@thin-air/core";
import type { Instrument } from "@thin-air/core";
import { shapeOf } from "../state/instruments.js";

export interface PointerState {
  /** Position dans l'image, déjà mise en miroir par `toPlayPosition`. */
  u: number;
  v: number;
  active: boolean;
  hovered: number | null;
}

/**
 * Les touches qui pincent une corde ou une zone (mode pointeur, §7.5).
 * Exported pour que le manifeste des raccourcis (`docs/raccourcis.json`) soit
 * comparable au code : le test lit les deux et refuse qu'ils divergent.
 */
export const TOUCHES_CORDE = ["a", "s", "d", "f", "g", "h", "j", "k", "l", "m", "q", "w", "e", "r", "t", "y"];

/** La touche qui reprend le son d'un moteur audio suspendu par le navigateur. */
export const TOUCHE_SON = "p";

/** Les flèches qui déplacent la main du pointeur. */
export const TOUCHES_FLECHES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const PAS_FLECHE = 0.04;

export interface PointerOptions {
  readonly enabled: boolean;
  readonly rect: PlayRect;
  readonly instrument: Instrument;
  readonly onPluck: (index: number) => void;
  readonly onPause: () => void;
}

export function usePointerHands(
  cible: RefObject<HTMLElement | null>,
  options: PointerOptions,
): RefObject<PointerState> {
  const etat = useRef<PointerState>({ u: 0.5, v: 0.5, active: false, hovered: null });
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const element = cible.current;
    if (element === null || !options.enabled) return;
    const mouvement = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const position = toPlayPosition(x, y, optionsRef.current.rect, rect.width / rect.height);
      etat.current.u = position.u;
      etat.current.v = position.v;
      etat.current.active = true;
      etat.current.hovered = indexVise(optionsRef.current.instrument, position.u, position.v);
    };
    const clavier = (event: KeyboardEvent) => {
      const touche = event.key.toLowerCase();
      if (touche === "p") {
        optionsRef.current.onPause();
        return;
      }
      if (touche.startsWith("arrow")) {
        bougerFleches(etat.current, touche);
        return;
      }
      const index = TOUCHES_CORDE.indexOf(touche);
      if (index >= 0) optionsRef.current.onPluck(index);
    };
    element.addEventListener("pointermove", mouvement);
    window.addEventListener("keydown", clavier);
    return () => {
      element.removeEventListener("pointermove", mouvement);
      window.removeEventListener("keydown", clavier);
    };
  }, [cible, options.enabled]);

  return etat;
}

function bougerFleches(etat: PointerState, touche: string): void {
  if (touche === "arrowleft") etat.u = Math.max(0, etat.u - PAS_FLECHE);
  if (touche === "arrowright") etat.u = Math.min(1, etat.u + PAS_FLECHE);
  if (touche === "arrowup") etat.v = Math.min(1, etat.v + PAS_FLECHE);
  if (touche === "arrowdown") etat.v = Math.max(0, etat.v - PAS_FLECHE);
  etat.active = true;
}

/** Corde ou zone visée par la position courante. */
export function indexVise(instrument: Instrument, u: number, v: number): number | null {
  const forme = shapeOf(instrument);
  if (forme.kind === "strings") {
    const count = forme.count;
    if (count <= 0) return null;
    return Math.min(count - 1, Math.max(0, Math.floor(u * count)));
  }
  const zones = instrument.zones?.zones ?? [];
  const index = zones.findIndex((zone) => u >= zone.u0 && u <= zone.u1 && v >= zone.v0 && v <= zone.v1);
  return index < 0 ? null : index;
}

/** Nombre de touches de jeu disponibles pour cet instrument. */
export function playableKeys(instrument: Instrument): number {
  const forme = shapeOf(instrument);
  return Math.min(TOUCHES_CORDE.length, forme.kind === "range" ? TOUCHES_CORDE.length : forme.count);
}
