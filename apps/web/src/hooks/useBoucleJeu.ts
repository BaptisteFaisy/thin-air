/**
 * La boucle d'images (cahier §7.9) : suivi → événements → moteur audio et
 * affichage, relâchement général quand la chaîne s'arrête (AIR-F-16), et le
 * fantôme après vingt secondes sans main (AIR-F-50, parcours P11).
 */
import { useEffect } from "react";
import type { DetectedHand, MusicEvent } from "@thin-air/core";
import type { UiState } from "../state/machine.js";
import { ghostMayPlay, mustReleaseAll } from "../state/machine.js";
import { createTracking } from "../lib/tracking.js";
import { ghostShouldStart, ghostShouldStop, releaseAll, tick } from "../lib/gameLoop.js";
import type { GhostHands } from "../lib/ghost.js";
import { ASPECT, mainsCourantes, sonnerie, type Miroir } from "../scene/modele.js";
import type { SessionApi } from "./useSession.js";

export interface BoucleJeuDeps {
  readonly session: SessionApi;
  readonly miroir: { current: Miroir };
  readonly etat: UiState;
  /** Les mains du fantôme quand il joue, vides sinon (P11). */
  readonly fantome: GhostHands;
  readonly onEvents: (events: readonly MusicEvent[]) => void;
}

export function useBoucleJeu(deps: BoucleJeuDeps): void {
  const { etat, miroir, onEvents, session } = deps;
  useEffect(() => {
    let actif = true;
    const image = (maintenant: number) => {
      if (!actif) return;
      pasDeJeu(maintenant / 1000, deps);
      requestAnimationFrame(image);
    };
    requestAnimationFrame(image);
    return () => {
      actif = false;
    };
  }, [etat.phase, etat.mode, miroir, onEvents, session, etat]);
}

/** Une image : suivi, événements, puis fantôme. Aucune horloge cachée. */
function pasDeJeu(t: number, deps: BoucleJeuDeps): void {
  const { session, miroir, etat, onEvents } = deps;
  const courant = miroir.current;
  if (courant.suivi === null && courant.playing) {
    courant.suivi = createTracking(courant.instrument, courant.settings, courant.rect, ASPECT);
  }
  const suivi = courant.suivi;
  const engine = session.engineRef.current;
  if (suivi !== null) {
    const mains = mainsJouees(deps);
    if (mustReleaseAll(etat)) releaseAll(t, suivi, sonnerie(engine), onEvents);
    else tick(t, mains, suivi, sonnerie(engine), onEvents);
  }
  fantome(t, deps);
}

/** Les mains analysées : celles du fantôme quand il joue, sinon les mains vues. */
function mainsJouees({ session, miroir, etat, fantome }: BoucleJeuDeps): readonly DetectedHand[] {
  if (etat.ghost === "playing") return fantome.current;
  return mainsCourantes(miroir.current, session.detectedRef.current);
}

/** AIR-F-50 : vingt secondes sans main, une prise à faible volume. */
function fantome(t: number, { session, miroir, etat }: BoucleJeuDeps): void {
  const courant = miroir.current;
  const fantomeActif = etat.ghost === "playing";
  if (courant.handsCount > 0) {
    courant.sansMainDepuis = null;
    if (ghostShouldStop(courant.handsCount, fantomeActif)) session.dispatch({ type: "ghost", playing: false });
    return;
  }
  // Le pointeur fait une main à lui seul, et un onglet masqué ne joue rien :
  // le fantôme ne joue qu'à l'écran, en caméra (P11, AIR-N-08).
  if (etat.mode !== "camera" || !ghostMayPlay(etat)) return;
  if (courant.sansMainDepuis === null) courant.sansMainDepuis = t;
  if (ghostShouldStart(t - courant.sansMainDepuis, fantomeActif)) {
    session.dispatch({ type: "ghost", playing: true });
  }
}
