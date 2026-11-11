/**
 * Une image de jeu (cahier §7.9) : les mains suivies deviennent des
 * événements, les événements partent au moteur audio et à l'affichage, et tout
 * est relâché quand la chaîne s'arrête (AIR-F-16). Le suivi et l'audio sont
 * reçus par interface : la boucle se teste avec des doubles, sans caméra.
 */
import type { DetectedHand, MusicEvent } from "@thin-air/core";
import type { Tracking } from "./tracking.js";
import type { Engine } from "./engine.js";

export interface Sonnerie {
  play(events: readonly MusicEvent[]): void;
  releaseAll(): void;
}

/** Un pas de jeu : une image, ses mains, le temps en secondes. */
export function tick(
  t: number,
  hands: readonly DetectedHand[],
  tracking: Tracking,
  sonnerie: Sonnerie,
  onEvents: (events: readonly MusicEvent[]) => void,
): readonly MusicEvent[] {
  const events = tracking.push(t, hands);
  if (events.length === 0) return events;
  sonnerie.play(events);
  onEvents(events);
  return events;
}

/** Relâchement général : onglet masqué, moteur suspendu, plus d'image (AIR-F-16, AIR-N-08). */
export function releaseAll(
  t: number,
  tracking: Tracking,
  sonnerie: Sonnerie,
  onEvents: (events: readonly MusicEvent[]) => void,
): readonly MusicEvent[] {
  const events = tracking.end(t);
  sonnerie.releaseAll();
  if (events.length > 0) onEvents(events);
  return events;
}

/**
 * Le fantôme (AIR-F-50, parcours P11) : vingt secondes sans main après un
 * démarrage, une prise jouée à faible volume, arrêt dès qu'une main paraît.
 */
export const GHOST_AFTER_S = 20;

export function ghostShouldStart(secondeesSansMain: number, ghostPlaying: boolean): boolean {
  return !ghostPlaying && secondeesSansMain >= GHOST_AFTER_S;
}

export function ghostShouldStop(mains: number, ghostPlaying: boolean): boolean {
  return ghostPlaying && mains > 0;
}
