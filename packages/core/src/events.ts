/**
 * Petits outils partagés sur les `MusicEvent` (cahier §7.9, §7.10, §7.12).
 *
 * Ils vivent ici plutôt que dans un module métier pour que la boucle et le
 * MIDI partagent **une seule** implémentation du tri et de la copie datée.
 * `schedule.sortEvents` (lot B2) appartient à la couture de jeu direct ; il
 * n'est pas utilisé ici pour ne pas dépendre d'un module encore en chantier.
 */
import type { MusicEvent } from "./types.js";

/** Copie d'un événement à un autre instant, sans changer son type. */
export function withTime(event: MusicEvent, t: number): MusicEvent {
  switch (event.type) {
    case "noteOn":
      return { ...event, t };
    case "noteOff":
      return { ...event, t };
    case "control":
      return { ...event, t };
  }
}

/**
 * Tri par instant croissant, **stable** : à `t` égal, l'ordre d'entrée est
 * conservé (une fin de note ne double pas une attaque). Aucun tri implicite
 * sur un autre champ, donc aucune dépendance à l'ordre d'un objet.
 */
export function sortByTimeStable(events: readonly MusicEvent[]): readonly MusicEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => (a.event.t === b.event.t ? a.index - b.index : a.event.t - b.event.t))
    .map((entree) => entree.event);
}

/** Modulo positif : ramène `t` dans `[0, length)`, y compris pour `t` négatif. */
export function wrapWithin(t: number, length: number): number {
  if (!(length > 0)) return t;
  const r = t % length;
  const positif = r < 0 ? r + length : r;
  // `-0` et l'arrondi flottant au bord haut retombent tous deux sur 0.
  return positif >= length || Object.is(positif, -0) ? 0 : positif;
}
