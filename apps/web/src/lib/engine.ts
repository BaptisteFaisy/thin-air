/**
 * Le pont vers les moteurs des autres lots : `@thin-air/core` produit les
 * événements musicaux, `@thin-air/audio` les fait sonner. Rien n'est réécrit
 * ici. Chaque appel est protégé, parce que plusieurs corps ne sont pas encore
 * livrés : tant qu'ils manquent, la scène affiche l'état et le jeu continue au
 * pointeur, par le même chemin de code (AIR-F-02).
 */
import {
  InstrumentPlayer,
  type GestureEvent,
  type Instrument,
  type LatencyReport,
  type MusicEvent,
  type Settings,
  type TrackedHand,
} from "@thin-air/core";

export interface Engine {
  /** Le moteur musical répond-il ? (faux tant que le lot A3 est vide) */
  readonly ready: boolean;
  frame(t: number, hands: readonly TrackedHand[], gestures: readonly GestureEvent[]): readonly MusicEvent[];
  stall(t: number): readonly MusicEvent[];
  end(t: number): readonly MusicEvent[];
  currentMidi(): number | null;
  play(events: readonly MusicEvent[]): void;
  releaseAll(): void;
  setInstrument(instrument: Instrument): void;
  setSettings(settings: Settings): void;
  latency(): LatencyReport | null;
  audioBaseMs(): number;
  audioOutputMs(): number | null;
  resume(): Promise<void>;
  close(): void;
}

interface AudioOuvert {
  readonly live: import("@thin-air/audio").LiveEngine | null;
}

async function ouvrirAudio(instrument: Instrument, settings: Settings): Promise<AudioOuvert> {
  try {
    const audio = await import("@thin-air/audio");
    const live = audio.createLiveEngine({ instrument, settings, latencyHint: "interactive" });
    await live.start();
    return { live };
  } catch {
    return { live: null };
  }
}

function vide(): readonly MusicEvent[] {
  return [];
}

function joueurPour(instrument: Instrument, settings: Settings): InstrumentPlayer | null {
  try {
    const joueur = new InstrumentPlayer(instrument, settings, {
      oneHand: settings.oneHand,
      hold: settings.hold,
      leftHanded: settings.leftHanded,
      magnet: settings.magnet,
    });
    joueur.currentMidi();
    return joueur;
  } catch {
    return null;
  }
}

/**
 * Crée le moteur après un geste de l'utilisateur (AIR-F-01) : ni caméra ni son
 * avant ce clic. Aucun fichier audio n'est chargé (AIR-F-25).
 */
export async function createEngine(instrument: Instrument, settings: Settings): Promise<Engine> {
  const audio = await ouvrirAudio(instrument, settings);
  const joueur = joueurPour(instrument, settings);
  return pont(joueur, audio);
}

/** Le pont musical : ce que produit la chaîne de `core`. */
function pontMusical(joueur: InstrumentPlayer | null) {
  return {
    ready: joueur !== null,
    frame(t: number, hands: readonly TrackedHand[], gestures: readonly GestureEvent[]): readonly MusicEvent[] {
      if (joueur === null) return vide();
      try {
        return joueur.frame(t, hands, gestures);
      } catch {
        return vide();
      }
    },
    stall(t: number): readonly MusicEvent[] {
      if (joueur === null) return vide();
      try {
        return joueur.stall(t);
      } catch {
        return vide();
      }
    },
    end(t: number): readonly MusicEvent[] {
      if (joueur === null) return vide();
      try {
        return joueur.end(t);
      } catch {
        return vide();
      }
    },
    currentMidi(): number | null {
      if (joueur === null) return null;
      try {
        return joueur.currentMidi();
      } catch {
        return null;
      }
    },
  };
}

/** Le pont audio : ce qui joue, ce qui se règle. */
function pontAudio(audio: AudioOuvert) {
  return {
    play(events: readonly MusicEvent[]) {
      if (audio.live === null || events.length === 0) return;
      try {
        audio.live.play(events);
      } catch {
        /* le moteur audio n'est pas encore livré */
      }
    },
    releaseAll() {
      try {
        audio.live?.releaseAll();
      } catch {
        /* idem */
      }
    },
    setInstrument(suivant: Instrument) {
      try {
        audio.live?.setInstrument(suivant);
      } catch {
        /* idem */
      }
    },
    setSettings(suivants: Settings) {
      try {
        audio.live?.setSettings(suivants);
      } catch {
        /* idem */
      }
    },
    ...pontMesures(audio),
  };
}

/** Ce que le navigateur déclare, et la reprise du moteur suspendu. */
function pontMesures(audio: AudioOuvert) {
  return {
    latency(): LatencyReport | null {
      try {
        return audio.live?.latency() ?? null;
      } catch {
        return null;
      }
    },
    audioBaseMs(): number {
      const base = audio.live?.context?.baseLatency;
      return typeof base === "number" && Number.isFinite(base) ? base * 1000 : 0;
    },
    audioOutputMs(): number | null {
      const sortie = audio.live?.context?.outputLatency;
      return typeof sortie === "number" && Number.isFinite(sortie) ? sortie * 1000 : null;
    },
    async resume(): Promise<void> {
      try {
        await audio.live?.start();
      } catch {
        /* le navigateur refuse sans geste : l'état « suspendu » reste affiché */
      }
    },
    close() {
      try {
        audio.live?.stop();
      } catch {
        /* idem */
      }
    },
  };
}

/** Le pont complet : chaque appel est protégé, aucun ne lève. */
function pont(joueur: InstrumentPlayer | null, audio: AudioOuvert): Engine {
  return { ...pontMusical(joueur), ...pontAudio(audio) };
}
