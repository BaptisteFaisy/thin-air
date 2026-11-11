/**
 * La chaîne de suivi (cahier §7.1) branchée sur les contrats de `core` :
 * rôles → mesures filtrées → gestes → événements musicaux. Les corps de ces
 * modules appartiennent aux lots A2, A3, B1 et B2 ; tant qu'ils manquent, la
 * chaîne rend une liste vide et la scène continue d'afficher les mains.
 */
import {
  FeatureTracker,
  GestureTracker,
  InstrumentPlayer,
  RoleTracker,
  type DetectedHand,
  type Instrument,
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
}

const VIDE: readonly MusicEvent[] = [];

interface Pieces {
  readonly roles: RoleTracker;
  readonly features: FeatureTracker;
  readonly gestures: GestureTracker;
  readonly player: InstrumentPlayer;
}

function pieces(instrument: Instrument, settings: Settings, rect: PlayRect, aspect: number): Pieces {
  return {
    roles: new RoleTracker(settings),
    features: new FeatureTracker(rect, aspect, settings, instrument.pointer),
    gestures: new GestureTracker(instrument, settings),
    player: new InstrumentPlayer(instrument, settings, {
      oneHand: settings.oneHand,
      hold: settings.hold,
      leftHanded: settings.leftHanded,
      magnet: settings.magnet,
    }),
  };
}

/** Une chaîne est « prête » si un premier appel ne lève pas : les corps existent. */
export function createTracking(
  instrument: Instrument,
  settings: Settings,
  rect: PlayRect,
  aspect = 4 / 3,
): Tracking {
  const pieces_ = pieces(instrument, settings, rect, aspect);
  let ready = false;
  try {
    pieces_.roles.push(0, []);
    pieces_.player.currentMidi();
    ready = true;
  } catch {
    ready = false;
  }

  return {
    ready,
    push(t, hands) {
      if (!ready) return VIDE;
      try {
        const assignees = pieces_.roles.push(t, hands);
        const suivies: readonly TrackedHand[] = assignees.map((main) => {
          const canaux = pieces_.features.push(t, main.hand);
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
        const gestes = pieces_.gestures.push(t, suivies);
        return pieces_.player.frame(t, suivies, gestes);
      } catch {
        return VIDE;
      }
    },
    stall(t) {
      if (!ready) return VIDE;
      try {
        return pieces_.player.stall(t);
      } catch {
        return VIDE;
      }
    },
    end(t) {
      if (!ready) return VIDE;
      try {
        return pieces_.gestures.releaseAll(t).length >= 0 ? pieces_.player.end(t) : VIDE;
      } catch {
        return VIDE;
      }
    },
    currentMidi() {
      if (!ready) return null;
      try {
        return pieces_.player.currentMidi();
      } catch {
        return null;
      }
    },
  };
}
