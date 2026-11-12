/**
 * Leçon « la couture des deux horloges » (cahier §5.1, §7.1, §7.9, parcours P5).
 *
 * Le sujet même du projet, en nombres : d'un côté l'horloge des images
 * (30 par seconde, une tous les 33,3 ms, avec ses hoquets), de l'autre celle du
 * son (48 000 échantillons par seconde, régulière). La couture (§7.9) date tout
 * événement sur l'horloge du son : le présent audio plus 5 ms d'avance, et
 * chaque moment se lit dans les deux unités — en secondes et en échantillons,
 * l'unité que voient les voix et leurs rampes (τ = `paramTauMs`).
 *
 * Logique pure, sans React ni DOM ni sortie audio : les deux frises produites
 * sont prêtes à dessiner, et les trois nombres du retard (mesuré, estimé pour
 * la caméra, total) viennent des fonctions de `state/latency.ts` — celles-là
 * mêmes que l'écran affiche — jamais d'une approximation.
 */
import { DEFAULT_SETTINGS, FPS_DEFAUT, SAMPLE_RATE, Scheduler, sortEvents } from "@thin-air/core";
import type { MusicEvent, Take } from "@thin-air/core";
import { estimatedTotalMs, measuredTotalMs, type LatencyParts } from "../state/latency.js";

/** Une image sur la frise : son moment, et celui où elle est programmée. */
export interface PisteImage {
  readonly index: number;
  /** Moment de l'image, en secondes, sur l'horloge de la prise. */
  readonly tS: number;
  /** Moment programmé sur l'horloge du son : présent + avance (§7.9, règle 2). */
  readonly programmeS: number;
  /** Le même moment en échantillons : l'unité que voient les voix. */
  readonly programmeSample: number;
}

/** Un événement daté sur l'horloge du son, lu dans les deux unités. */
export interface PisteEvenement {
  readonly type: MusicEvent["type"];
  readonly tS: number;
  readonly tSample: number;
}

/** Les trois nombres annoncés : le total est la somme des deux autres. */
export interface RetardsAnnonces {
  /** Retard mesuré : analyse + traitement + sortie audio (§5.1, §5.2). */
  readonly mesureMs: number;
  /** Retard de la caméra : non mesurable dans le navigateur, estimé (§5.1). */
  readonly estimeCameraMs: number;
  readonly totalMs: number;
}

export interface HorlogesLessonResult {
  readonly images: readonly PisteImage[];
  readonly evenements: readonly PisteEvenement[];
  readonly imagesParSeconde: number;
  readonly echantillonsParSeconde: number;
  readonly pasImageMs: number;
  readonly echantillonsParImage: number;
  /** Avance de programmation, ms (`lookaheadMs`, 5 par défaut — §7.13). */
  readonly avanceMs: number;
  readonly retards: RetardsAnnonces;
}

/** Secondes → échantillons : la seule conversion de la couture (§7.9). */
export function enEchantillons(tS: number): number {
  return Math.round(tS * SAMPLE_RATE);
}

/** Les trois nombres tels que l'écran les annonce (§5.2) : total = somme. */
export function retardsAnnonces(parties: LatencyParts): RetardsAnnonces {
  const mesureMs = measuredTotalMs(parties);
  const totalMs = estimatedTotalMs(parties);
  return { mesureMs, estimeCameraMs: totalMs - mesureMs, totalMs };
}

/**
 * Construit la leçon pour une prise à 30 images/s et des événements déjà datés
 * sur l'horloge du son. Dans la leçon, les deux horloges partent de zéro : le
 * présent audio au moment d'une image est son horodatage, et le `Scheduler` du
 * §7.9 y ajoute l'avance de programmation — c'est la fonction du jeu direct,
 * donc la frise montre exactement ce que la couture fait, hoquets compris.
 */
export function buildHorlogesLesson(
  prise: Take,
  evenements: readonly MusicEvent[],
  parties: LatencyParts,
  avanceMs: number = DEFAULT_SETTINGS.lookaheadMs,
): HorlogesLessonResult {
  const ordonnanceur = new Scheduler({ lookaheadMs: avanceMs });
  const images: PisteImage[] = prise.frames.map((image, index) => {
    const programmeS = ordonnanceur.stamp(image.t, image.t);
    return { index, tS: image.t, programmeS, programmeSample: enEchantillons(programmeS) };
  });
  const fps = prise.fps > 0 ? prise.fps : FPS_DEFAUT;
  return {
    images,
    evenements: sortEvents(evenements).map((e) => ({
      type: e.type,
      tS: e.t,
      tSample: enEchantillons(e.t),
    })),
    imagesParSeconde: fps,
    echantillonsParSeconde: SAMPLE_RATE,
    pasImageMs: 1000 / fps,
    echantillonsParImage: SAMPLE_RATE / fps,
    avanceMs,
    retards: retardsAnnonces(parties),
  };
}
