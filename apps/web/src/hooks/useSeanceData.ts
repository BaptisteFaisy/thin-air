/** L'état de la séance, regroupé : un seul endroit où lire les écrans. */
import { useRef, useState } from "react";
import type { Instrument, MusicEvent, Settings } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import { emptyDisplay, type StageDisplay } from "../state/display.js";
import type { CalibrationState } from "../state/calibration.js";
import { idleCalibration } from "../state/calibration.js";
import { emptyLoop, type LoopState } from "../state/loopState.js";
import { BUILT_IN, premierLivre } from "../state/library.js";
import { PHANTOM } from "../state/presets.js";
import { lireFragment, type FragmentLecture } from "../state/instruments.js";
import { latencyInitiale, type LatencyParts } from "../state/latency.js";
import { lireMine, lireRect, lireSettings } from "../lib/storage.js";
import type { PanelId } from "../ui/Stage.js";

export interface SeanceData {
  readonly settings: Settings;
  readonly setSettings: (settings: Settings) => void;
  readonly library: readonly Instrument[];
  readonly setLibrary: (fn: (avant: readonly Instrument[]) => readonly Instrument[]) => void;
  readonly instrument: Instrument;
  readonly setInstrument: (instrument: Instrument) => void;
  /** Les raisons d'un fragment d'adresse refusé, sinon `null` (AIR-F-43, P8). */
  readonly fragmentRefus: readonly string[] | null;
  readonly display: StageDisplay;
  readonly setDisplay: (fn: (avant: StageDisplay) => StageDisplay) => void;
  readonly loop: LoopState;
  readonly setLoop: (fn: (avant: LoopState) => LoopState) => void;
  readonly calibration: CalibrationState;
  readonly setCalibration: (fn: (avant: CalibrationState) => CalibrationState) => void;
  readonly panel: PanelId;
  readonly setPanel: (panel: PanelId) => void;
  readonly editing: Instrument | null;
  readonly setEditing: (instrument: Instrument | null) => void;
  readonly hovered: number | null;
  readonly setHovered: (index: number | null) => void;
  readonly parts: LatencyParts;
  readonly setParts: (parts: LatencyParts) => void;
  readonly enregistres: { current: MusicEvent[] };
  /** Réduit les événements musicaux vers l'affichage, sans recréer de boucle. */
  readonly onEventsRef: { current: (events: readonly MusicEvent[]) => void };
}

/** L'instrument par défaut : le premier livré (Phantom, §7.8). */
function defaut(): Instrument {
  return premierLivre() ?? PHANTOM;
}

/**
 * L'instrument du fragment d'adresse, sinon le défaut (AIR-F-45, P8). Un
 * fragment invalide rend ses RAISONS : l'écran les affiche, jamais de
 * remplacement silencieux (AIR-F-43).
 */
export function instrumentInitial(): FragmentLecture {
  if (typeof window === "undefined") return { instrument: defaut(), refus: null };
  return lireFragment(window.location.hash, defaut());
}

export function useSeanceData(): SeanceData {
  const [settings, setSettings] = useState<Settings>(lireSettings);
  const [library, setLibrary] = useState<readonly Instrument[]>(() => [...BUILT_IN, ...lireMine()]);
  const [fragment] = useState<FragmentLecture>(instrumentInitial);
  const [instrument, setInstrument] = useState<Instrument>(fragment.instrument);
  const [display, setDisplay] = useState<StageDisplay>(emptyDisplay);
  const [loop, setLoop] = useState<LoopState>(() => emptyLoop(settings));
  const [calibration, setCalibration] = useState<CalibrationState>(() => idleCalibration(lireRect()));
  const [panel, setPanel] = useState<PanelId>(null);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [parts, setParts] = useState<LatencyParts>(() => latencyInitiale(settings));
  const enregistres = useRef<MusicEvent[]>([]);
  const onEventsRef = useRef<(events: readonly MusicEvent[]) => void>(() => undefined);
  return {
    onEventsRef,
    settings, setSettings, library, setLibrary, instrument, setInstrument, display, setDisplay,
    fragmentRefus: fragment.refus,
    loop, setLoop, calibration, setCalibration, panel, setPanel, editing, setEditing,
    hovered, setHovered, parts, setParts, enregistres,
  };
}

export type { Messages };
