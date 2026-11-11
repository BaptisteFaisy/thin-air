/**
 * Libellés des profils de mobilité, en français (AIR-N-14). Même forme que
 * `profiles.en.ts` ; raccordé à `fr.ts` par une ligne (voir
 * `docs/integration-t4.md`). Le vocabulaire respecte le cahier §5.4.
 */
import type { ProfileMessages } from "./profiles.en.js";

export const profilesFr: ProfileMessages = {
  title: "Mobilité",
  intro:
    "Choisis le profil qui correspond à ta façon de jouer. Tu pourras ensuite ajuster chaque réglage à la main.",
  none: "Aucun profil",
  seated: {
    name: "Assis, portée courte",
    effect: "Une zone de jeu plus petite, près du centre, pour que chaque note reste à portée.",
  },
  oneHand: {
    name: "Une main",
    effect: "Joue toute l'étendue d'une seule main, et verrouille une note après 400 ms.",
  },
  tremor: {
    name: "Mains qui tremblent",
    effect: "Un lissage plus fort, pour que le tremblement léger ne fasse pas vibrer la note.",
  },
};