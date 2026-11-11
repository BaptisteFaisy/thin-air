/**
 * La boucle d'images (cahier §7.9) : suivi → événements → moteur audio et
 * affichage, relâchement général quand la chaîne s'arrête (AIR-F-16), et le
 * fantôme après vingt secondes sans main (AIR-F-50, parcours P11).
 */
import { useEffect } from "react";
import type { MusicEvent } from "@thin-air/core";
import type { UiState } from "../state/machine.js";
import { mustReleaseAll } from "../state/machine.js";
import { createTracking } from "../lib/tracking.js";
import { ghostShouldStart, ghostShouldStop, releaseAll, tick } from "../lib/gameLoop.js";
import { ASPECT, mainsCourantes, sonnerie, type Miroir } from "../scene/modele.js";
import type { SessionApi } from "./useSession.js";

export interface BoucleJeuDeps {
  readonly session: SessionApi;
  readonly miroir: { current: Miroir };
  readonly etat: UiState;
  readonly onEvents: (events: readonly MusicEvent[]) => void;
}

export function useBoucleJeu(deps: BoucleJeuDeps): void {
  const { session, miroir, etat, onEvents } = deps;
  useEffect(() => {
    let actif = true;
    const image = (maintenant: number) => {
      if (!actif) return;
      pasDeJeu(maintenant / 1000, session, miroir, etat, onEvents);
      requestAnimationFrame(image);
    };
    requestAnimationFrame(image);
    return () => {
      actif = false;
    };
  }, [etat.phase, etat.mode, miroir, onEvents, session, etat]);
}

/** Une image : suivi, événements, puis fantôme. Aucune horloge cachée. */
function pasDeJeu(
  t: number,
  session: SessionApi,
  miroir: { current: Miroir },
  etat: UiState,
  onEvents: (events: readonly MusicEvent[]) => void,
): void {
  const courant = miroir.current;
  if (courant.suivi === null && courant.playing) {
    courant.suivi = createTracking(courant.instrument, courant.settings, courant.rect, ASPECT);
  }
  const suivi = courant.suivi;
  const engine = session.engineRef.current;
  if (suivi !== null) {
    const mains = mainsCourantes(courant, session.detectedRef.current);
    if (mustReleaseAll(etat)) releaseAll(t, suivi, sonnerie(engine), onEvents);
    else tick(t, mains, suivi, sonnerie(engine), onEvents);
  }
  fantome(t, session, miroir, etat);
}

/** AIR-F-50 : vingt secondes sans main, une prise à faible volume. */
function fantome(t: number, session: SessionApi, miroir: { current: Miroir }, etat: UiState): void {
  const courant = miroir.current;
  const fantomeActif = etat.ghost === "playing";
  if (courant.handsCount > 0) {
    courant.sansMainDepuis = null;
    if (ghostShouldStop(courant.handsCount, fantomeActif)) session.dispatch({ type: "ghost", playing: false });
    return;
  }
  if (courant.sansMainDepuis === null) courant.sansMainDepuis = t;
  if (ghostShouldStart(t - courant.sansMainDepuis, fantomeActif)) {
    session.dispatch({ type: "ghost", playing: true });
  }
}
