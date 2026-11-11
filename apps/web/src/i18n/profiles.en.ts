/**
 * Libellés des profils de mobilité, en anglais (AIR-N-14). Fichier séparé :
 * il est raccordé aux `Messages` de la page par une ligne dans `en.ts` (voir
 * `docs/integration-t4.md`). Le vocabulaire respecte le cahier §5.4.
 */
import type { ProfileId } from "../state/profiles.js";

export interface ProfileLabel {
  readonly name: string;
  readonly effect: string;
}

/** Une étiquette par profil, plus le titre, l'introduction et « aucun ». */
export type ProfileMessages = {
  readonly title: string;
  readonly intro: string;
  readonly none: string;
} & { readonly [K in ProfileId]: ProfileLabel };

export const profilesEn: ProfileMessages = {
  title: "Mobility",
  intro:
    "Pick the profile that matches how you play. You can still change every setting by hand afterwards.",
  none: "No profile",
  seated: {
    name: "Seated, short reach",
    effect: "A smaller play area, close to the centre, so every note stays within reach.",
  },
  oneHand: {
    name: "One hand",
    effect: "Plays the whole range with one hand, and locks a note after 400 ms.",
  },
  tremor: {
    name: "Trembling hands",
    effect: "Stronger smoothing, so a light shake does not wobble the note.",
  },
};