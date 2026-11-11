/**
 * Datation sur l'horloge du son (cahier §7.9, règle 2) : chaque événement
 * porte un instant, et la programmation regarde devant elle.
 * Propriété : AIR-P-11 (ordre et causalité).
 *
 * Deux horloges se rencontrent ici : celle des images (30 par seconde, avec
 * ses hoquets) et celle du son (48 000 échantillons par seconde, régulière).
 * `stamp` traduit l'une en l'autre sans jamais reculer, `due` découpe ce qu'un
 * minuteur de 25 ms doit programmer dans la fenêtre de 100 ms qui vient —
 * parce qu'un minuteur de navigateur n'est pas assez précis pour le rythme.
 */
import type { MusicEvent } from "./types.js";

export interface SchedulerOptions {
  /** Avance de programmation, ms (5 par défaut). */
  readonly lookaheadMs: number;
  /** Fenêtre programmée à chaque passage, ms (100 par défaut). */
  readonly windowMs?: number;
}

/** Fenêtre par défaut du cahier §7.9 : 100 ms programmées d'avance. */
export const DEFAULT_WINDOW_MS = 100;

function msToS(ms: number | undefined, fallback: number): number {
  const value = Number.isFinite(ms) ? (ms as number) : fallback;
  return Math.max(0, value) / 1000;
}

/**
 * Horloge de jeu direct : convertit l'instant d'une image en instant de
 * l'horloge du son, sans jamais revenir en arrière.
 */
export class Scheduler {
  private lastStamp: number | null = null;
  private lastImage: number | null = null;

  constructor(readonly options: SchedulerOptions) {}

  /**
   * L'instant de l'horloge du son où poser les événements de cette image :
   * l'instant audio présent plus l'avance de programmation (§7.9, règle 2).
   *
   * Deux images au même horodatage, ou un horodatage qui recule (prise
   * rejouée, image en double), ne datent jamais un événement avant le
   * précédent : l'instant rendu est alors tenu, pas reculé. C'est ce qui rend
   * la liste monotone même quand la caméra hoquette (AIR-P-11).
   */
  stamp(imageTimeS: number, audioNowS: number): number {
    const audio = Number.isFinite(audioNowS) ? audioNowS : (this.lastStamp ?? 0);
    const image = Number.isFinite(imageTimeS) ? imageTimeS : (this.lastImage ?? 0);

    const recule = this.lastImage !== null && image <= this.lastImage;
    if (recule && this.lastStamp !== null) return this.lastStamp;

    const vise = audio + this.lookaheadS();
    const stamped = this.lastStamp === null ? vise : Math.max(vise, this.lastStamp);
    this.lastStamp = stamped;
    this.lastImage = image;
    return stamped;
  }

  /**
   * Événements à programmer dans la fenêtre qui vient, dans l'ordre.
   *
   * Sont dus tout ce qui tombe avant `audioNowS + windowMs`, y compris ce qui
   * est déjà en retard : un événement en retard vaut mieux qu'une note
   * coincée. Le tri est stable, l'entrée n'est pas modifiée.
   */
  due(audioNowS: number, pending: readonly MusicEvent[]): readonly MusicEvent[] {
    const now = Number.isFinite(audioNowS) ? audioNowS : 0;
    const horizon = now + this.windowS();
    return sortEvents(pending.filter((event) => !Number.isFinite(event.t) || event.t <= horizon));
  }

  /** Avance de programmation, en secondes. */
  lookaheadS(): number {
    return msToS(this.options.lookaheadMs, 0);
  }

  /** Fenêtre de programmation, en secondes. */
  windowS(): number {
    return msToS(this.options.windowMs, DEFAULT_WINDOW_MS);
  }
}

/**
 * Trie et rend une liste d'événements monotone en `t` (stables à t égal).
 *
 * Le tri est décoré de l'indice d'entrée : à instant égal, l'ordre du fichier
 * d'instrument est conservé, ce qui rend la sortie reproductible au bit près
 * (AIR-P-12) même quand le moteur de tri change de version.
 */
export function sortEvents(events: readonly MusicEvent[]): readonly MusicEvent[] {
  return events
    .map((event, index) => ({ event, index, t: Number.isFinite(event.t) ? event.t : 0 }))
    .sort((a, b) => (a.t === b.t ? a.index - b.index : a.t - b.t))
    .map((decorated) => decorated.event);
}
