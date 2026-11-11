/**
 * Prises aléatoires du fuzz (lot t6).
 *
 * Rien n'est réinventé : chaque catégorie compose les générateurs de synthèse
 * de `@thin-air/core` (`takeGen.ts`), avec leurs cas limites (images manquantes,
 * mains qui sortent du cadre, croisements, coups brefs). Le seul aléa est
 * `alea(graine)`, qui est mulberry32 : les mêmes arguments redonnent les mêmes
 * nombres (AIR-N-09).
 */
import type { HandPose, Take } from "@thin-air/core";
import {
  alea,
  crossingHandsTake,
  fastJabTake,
  handLeavesTake,
  leftHandOnlyTake,
  linearTake,
  makeHand,
  poseFromPlay,
  sweepTake,
  tremorTake,
  withDroppedFrames,
  withHand,
} from "@thin-air/core";
import { choisir, reel } from "./commun.ts";

type Cote = "left" | "right";

/** Une pose plausible, dans la zone de jeu, déterministe via `rng`. */
function poseAleatoire(rng: () => number): HandPose {
  const u = reel(rng, 0, 1);
  const v = reel(rng, 0, 1);
  return {
    ...poseFromPlay(u, v, {
      side: choisir<Cote>(rng, ["left", "right"]),
      scale: reel(rng, 0.05, 0.22),
      open: reel(rng, 0, 1),
      pinch: reel(rng, 0, 1),
      score: reel(rng, 0.5, 1),
    }),
  };
}

type Categorie = "linear" | "tremor" | "sweep" | "crossing" | "handLeaves" | "fastJab";

const CATEGORIES: readonly Categorie[] = ["linear", "tremor", "sweep", "crossing", "handLeaves", "fastJab"];

function categorie(genre: Categorie, rng: () => number, graine: number): Take {
  const fps = choisir(rng, [15, 24, 30, 60]);
  const duree = reel(rng, 0.4, 3);
  const options = { fps, durationS: duree, seed: graine };
  switch (genre) {
    case "linear":
      return linearTake(poseAleatoire(rng), poseAleatoire(rng), options);
    case "tremor":
      return tremorTake(poseAleatoire(rng), reel(rng, 0.01, 0.15), options);
    case "sweep": {
      const fromU = reel(rng, 0.05, 0.45);
      const toU = reel(rng, 0.55, 0.95);
      return sweepTake(fromU, toU, options);
    }
    case "crossing":
      return crossingHandsTake(options);
    case "handLeaves":
      return handLeavesTake(poseAleatoire(rng), reel(rng, 0.2, duree * 0.9), options);
    case "fastJab":
      return fastJabTake(options);
  }
}

/** Une prise aléatoire dure (deux mains parfois, images parfois manquantes). */
export function priseAleatoire(graine: number): Take {
  const rng = alea(graine);
  const genre = choisir<Categorie>(rng, CATEGORIES);
  let prise = categorie(genre, rng, graine);
  const vite = alea(graine ^ 0x5f3759df); // canal indépendant, même reproductibilité
  if (vite() < 0.3) prise = withDroppedFrames(prise, choisir(vite, [2, 3, 4, 5, 6, 7]));
  // Deux mains dans la majorité des cas : les instruments à deux mains (thérémine)
  // ne sonnent qu'avec une main de hauteur ET une main de volume.
  if (vite() < 0.6) {
    const seconde = poseAleatoire(vite);
    prise = withHand(prise, (_t) => (vite() < 0.85 ? makeHand(seconde) : null));
  }
  // La main gauche seule est le cas limite de convention de côté (§7.3).
  if (vite() < 0.08) prise = leftHandOnlyTake({ fps: prise.fps, durationS: reel(vite, 0.4, 2) });
  return prise;
}