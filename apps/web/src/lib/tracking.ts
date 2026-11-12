/**
 * La chaîne de suivi (cahier §7.1) branchée sur les contrats de `core` :
 * rôles → mesures filtrées → gestes → événements musicaux. Les corps de ces
 * modules appartiennent aux lots A2, A3, B1 et B2 ; tant qu'ils manquent, la
 * chaîne rend une liste vide et la scène continue d'afficher les mains.
 *
 * La chaîne se reconfigure en cours de séance : changer d'instrument, de
 * gamme, d'aimant, de zone ou de mode ne doit ni couper la caméra, ni
 * rejouer un geste en cours (cahier §7.8, AIR-F-24).
 */
import {
  FeatureTracker,
  GestureTracker,
  InstrumentPlayer,
  RoleTracker,
  type DetectedHand,
  type Instrument,
  type InstrumentOptions,
  type MusicEvent,
  type PlayRect,
  type Settings,
  type TrackedHand,
} from "@thin-air/core";

export interface Tracking {
  readonly ready: boolean;
  push(t: number, hands: readonly DetectedHand[]): readonly MusicEvent[];
  stall(t: number): readonly MusicEvent[];
  end(t: number): readonly MusicEvent[];
  currentMidi(): number | null;
  /**
   * Applique un nouvel instrument, de nouveaux réglages ou une nouvelle zone.
   * Rend les fins de voix : elles partent avant les notes nouvelles, pour que
   * les voix en cours s'éteignent en fondu (AIR-F-24).
   */
  reconfigurer(t: number, instrument: Instrument, settings: Settings, rect: PlayRect): readonly MusicEvent[];
}

const VIDE: readonly MusicEvent[] = [];

interface Pieces {
  roles: RoleTracker;
  features: FeatureTracker;
  gestures: GestureTracker;
  player: InstrumentPlayer;
}

/** Les options du lecteur : ce que les réglages imposent au joueur (§7.8). */
function optionsDe(settings: Settings): InstrumentOptions {
  return {
    oneHand: settings.oneHand,
    hold: settings.hold,
    leftHanded: settings.leftHanded,
    magnet: settings.magnet,
  };
}

function pieces(instrument: Instrument, settings: Settings, rect: PlayRect, aspect: number): Pieces {
  return {
    roles: new RoleTracker(settings),
    features: new FeatureTracker(rect, aspect, settings, instrument.pointer),
    gestures: new GestureTracker(instrument, settings),
    player: new InstrumentPlayer(instrument, settings, optionsDe(settings)),
  };
}

/** Une chaîne est « prête » si un premier appel ne lève pas : les corps existent. */
export function createTracking(
  instrument: Instrument,
  settings: Settings,
  rect: PlayRect,
  aspect = 4 / 3,
): Tracking {
  const courant = pieces(instrument, settings, rect, aspect);
  let appliques = { instrument, settings, rect };
  let ready = false;
  try {
    courant.roles.push(0, []);
    courant.player.currentMidi();
    ready = true;
  } catch {
    ready = false;
  }

  return {
    ready,
    push(t, hands) {
      if (!ready) return VIDE;
      try {
        const assignees = courant.roles.push(t, hands);
        const suivies: readonly TrackedHand[] = assignees.map((main) => {
          const canaux = courant.features.push(t, main.hand);
          return {
            role: main.role,
            side: main.side,
            id: main.id,
            smooth: canaux.smooth,
            fast: canaux.fast,
            present: true,
            lastSeenT: t,
          };
        });
        const gestes = courant.gestures.push(t, suivies);
        return courant.player.frame(t, suivies, gestes);
      } catch {
        return VIDE;
      }
    },
    stall(t) {
      if (!ready) return VIDE;
      try {
        return courant.player.stall(t);
      } catch {
        return VIDE;
      }
    },
    end(t) {
      if (!ready) return VIDE;
      try {
        return courant.gestures.releaseAll(t).length >= 0 ? courant.player.end(t) : VIDE;
      } catch {
        return VIDE;
      }
    },
    currentMidi() {
      if (!ready) return null;
      try {
        return courant.player.currentMidi();
      } catch {
        return null;
      }
    },
    reconfigurer(t, instrument, settings, rect) {
      if (!ready) return VIDE;
      try {
        if (instrument === appliques.instrument && settings === appliques.settings && rect === appliques.rect) {
          return VIDE;
        }
        const relaches = courant.player.reconfigurer(t, instrument, settings, optionsDe(settings));
        courant.gestures.reconfigurer(instrument, settings);
        courant.features.reconfigurer(rect, settings, instrument.pointer);
        courant.roles.reconfigurer(settings);
        if (rect !== appliques.rect) courant.gestures.repositionner();
        appliques = { instrument, settings, rect };
        return relaches;
      } catch {
        return VIDE;
      }
    },
  };
}
