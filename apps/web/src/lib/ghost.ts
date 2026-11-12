/**
 * Le fantôme de la page (cahier §8, parcours P11 ; AIR-F-50) : vingt secondes
 * sans main après un démarrage, une prise est rejouée à faible volume, et elle
 * s'arrête dès qu'une main paraît.
 *
 * Le rejeu vient de `@thin-air/vision` (`createReplaySource`) : les mains
 * rejouées suivent exactement le même chemin que celles de la caméra, donc le
 * même moteur en aval, sans modèle et sans image. La prise et le volume du
 * fantôme sont ceux de la borne (`kiosk/kiosk.ts`) : une seule définition,
 * jamais recopiée. Le module de vision est chargé à la demande, et une prise
 * absente laisse la page jouer — le fantôme est un supplément, pas un prérequis.
 */
import type { DetectedHand, Settings } from "@thin-air/core";
import type { ReplaySource } from "@thin-air/vision";
import { ghostSettings, priseFantome } from "../kiosk/kiosk.js";
import type { Engine } from "./engine.js";

/** Les mains du fantôme, dans le format que lit le suivi. */
export interface GhostHands {
  readonly current: readonly DetectedHand[];
}

export interface Ghost {
  readonly hands: GhostHands;
  /** Prépare la source de rejeu : le module de vision n'est chargé qu'ici. */
  prepare(): Promise<void>;
  /** Fait jouer la prise, au volume abaissé du fantôme. */
  start(settings: Settings): void;
  /** Arrête le rejeu et rend le volume réglé par la personne. */
  stop(settings: Settings): void;
  /** Rend tout : plus aucune main, plus aucun rejeu en cours. */
  release(): void;
}

export function createGhost(engineRef: { readonly current: Engine | null }): Ghost {
  const hands: { current: readonly DetectedHand[] } = { current: [] };
  let source: ReplaySource | null = null;
  let voulu = false;
  let derniers: Settings | null = null;

  /** Le silence : le rejeu s'arrête, plus aucune main, le volume réglé revient. */
  const taire = (): void => {
    voulu = false;
    source?.stop();
    hands.current = [];
    if (derniers !== null) engineRef.current?.setSettings(derniers);
  };

  const start = (settings: Settings): void => {
    voulu = true;
    derniers = settings;
    engineRef.current?.setSettings(ghostSettings(settings));
    if (source !== null) void source.start();
  };

  const prepare = async (): Promise<void> => {
    if (source !== null) return;
    try {
      const vision = await import("@thin-air/vision");
      const replay = vision.createReplaySource(priseFantome(), { loop: true });
      replay.onFrame((frame) => {
        hands.current = frame.hands;
      });
      source = replay;
      if (voulu) void replay.start();
    } catch {
      // Prise absente ou module non livré : la page continue de jouer sans fantôme.
    }
  };

  return {
    hands,
    prepare,
    start,
    stop: (settings: Settings) => {
      derniers = settings;
      taire();
    },
    release: taire,
  };
}
