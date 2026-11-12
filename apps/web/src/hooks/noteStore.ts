/**
 * La note réellement jouée, publiée pour le panneau des leçons (parcours P5).
 *
 * Même principe que `analysisStore.ts` : un magasin au niveau du module, sans
 * React ni horloge. La séance y pousse la note en cours à chaque changement
 * d'affichage, et le panneau la lit — jamais un nombre inventé, jamais une
 * note déduite d'une formule.
 */

/** La note tenue à ce moment, et sa fréquence si elle est connue. */
export interface NoteJouee {
  readonly note: string;
  readonly midi: number;
  readonly frequencyHz: number | null;
}

let courante: NoteJouee | null = null;
const abonnes = new Set<() => void>();

/** La séance publie la note jouée (ou `null` au silence) et réveille le panneau. */
export function publierNote(note: NoteJouee | null): void {
  courante = note;
  for (const abonne of abonnes) abonne();
}

/** L'état courant, stable entre deux publications (pour `useSyncExternalStore`). */
export function lireNote(): NoteJouee | null {
  return courante;
}

export function suivreNote(abonne: () => void): () => void {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
}

/** Remet à zéro : nouvelle séance, ou silence prolongé. */
export function reinitialiserNote(): void {
  publierNote(null);
}
