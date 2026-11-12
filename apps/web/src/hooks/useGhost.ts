/**
 * Le fantôme branché sur l'état de l'écran (AIR-F-50, parcours P11). La
 * décision de jouer appartient à la boucle (`useBoucleJeu`, qui compte les
 * secondes sans main) ; ce hook ne fait que la réaliser : préparer le rejeu,
 * le démarrer à faible volume, l'arrêter dès qu'une main paraît.
 */
import { useEffect, useRef } from "react";
import type { Settings } from "@thin-air/core";
import { createGhost, type Ghost, type GhostHands } from "../lib/ghost.js";
import type { SessionApi } from "./useSession.js";

export function useGhost(session: SessionApi, settings: Settings): GhostHands {
  const ghostRef = useRef<Ghost | null>(null);
  if (ghostRef.current === null) ghostRef.current = createGhost(session.engineRef);
  const ghost = ghostRef.current;
  // AIR-F-01 (useGhost.test.tsx) : le fantôme reste endormi tant que la séance
  // n'est pas démarrée — ni préparation du rejeu, ni démarrage, donc aucun son
  // ne peut sortir avant le clic « Start ».
  const demarre = session.state.phase !== "idle";
  const joue = session.state.ghost === "playing";

  useEffect(() => {
    if (!demarre) return;
    void ghost.prepare();
    return () => ghost.release();
  }, [ghost, demarre]);

  useEffect(() => {
    if (!demarre) return;
    if (joue) ghost.start(settings);
    else ghost.stop(settings);
  }, [ghost, demarre, joue, settings]);

  return ghost.hands;
}
