/**
 * L'état de la boucle, côté écran (cahier §7.10, §12.1) : mesures, couches,
 * tempo, enregistrement. L'enregistrement lui-même et la compensation du
 * retard appartiennent au lot A3 (`core.loop`) : ici on tient la liste des
 * couches et on borne ce qui est borné.
 */
import { loopSeconds, MAX_LAYERS, type LoopLayer, type MusicEvent, type Settings } from "@thin-air/core";

export const TEMPO_MIN = 60;
export const TEMPO_MAX = 140;
export const BARS_CHOICES: readonly number[] = [1, 2, 4];

export interface LoopState {
  readonly tempo: number;
  readonly bars: number;
  readonly beatsPerBar: number;
  readonly layers: readonly LoopLayer[];
  readonly recording: boolean;
  readonly positionS: number;
  readonly nextLayerId: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export function emptyLoop(settings: Settings): LoopState {
  return {
    tempo: clamp(settings.tempo, TEMPO_MIN, TEMPO_MAX),
    bars: BARS_CHOICES.includes(settings.loopBars) ? settings.loopBars : 4,
    beatsPerBar: settings.beatsPerBar > 0 ? settings.beatsPerBar : 4,
    layers: [],
    recording: false,
    positionS: 0,
    nextLayerId: 1,
  };
}

/** Durée de la boucle en secondes : `core.loopSeconds`, avec un repli local. */
export function loopLengthS(state: LoopState): number {
  try {
    const secondes = loopSeconds(state.tempo, state.bars, state.beatsPerBar);
    if (Number.isFinite(secondes) && secondes > 0) return secondes;
  } catch {
    /* le lot A3 n'a pas encore écrit son corps */
  }
  return (state.bars * state.beatsPerBar * 60) / state.tempo;
}

export function isFull(state: LoopState): boolean {
  return state.layers.length >= MAX_LAYERS;
}

export function remainingLayers(state: LoopState): number {
  return Math.max(0, MAX_LAYERS - state.layers.length);
}

export function withTempo(state: LoopState, tempo: number): LoopState {
  return { ...state, tempo: Math.round(clamp(tempo, TEMPO_MIN, TEMPO_MAX)) };
}

export function withBars(state: LoopState, bars: number): LoopState {
  const choix = BARS_CHOICES.includes(bars) ? bars : state.bars;
  return { ...state, bars: choix, positionS: 0 };
}

export function startRecording(state: LoopState): LoopState {
  if (isFull(state)) return state;
  return { ...state, recording: true, positionS: 0 };
}

export function stopRecording(state: LoopState, instrument: string, events: readonly MusicEvent[]): LoopState {
  if (!state.recording) return state;
  if (isFull(state)) return { ...state, recording: false };
  const couche: LoopLayer = {
    id: state.nextLayerId,
    instrument,
    events,
    muted: false,
  };
  return {
    ...state,
    recording: false,
    layers: [...state.layers, couche],
    nextLayerId: state.nextLayerId + 1,
  };
}

export function cancelRecording(state: LoopState): LoopState {
  return { ...state, recording: false };
}

export function removeLastLayer(state: LoopState): LoopState {
  return { ...state, layers: state.layers.slice(0, -1) };
}

export function toggleMute(state: LoopState, id: number): LoopState {
  return {
    ...state,
    layers: state.layers.map((couche) => (couche.id === id ? { ...couche, muted: !couche.muted } : couche)),
  };
}

export function clearLayers(state: LoopState): LoopState {
  return { ...state, layers: [], nextLayerId: 1 };
}

/** Position dans la boucle, ramenée entre 0 et sa longueur. */
export function withPosition(state: LoopState, positionS: number): LoopState {
  const longueur = loopLengthS(state);
  const propre = Number.isFinite(positionS) ? positionS : 0;
  // Un seul modulo quand la position est positive : un second passage
  // introduirait une erreur d'arrondi visible sur la barre des mesures.
  const ramene = propre >= 0 ? propre % longueur : ((propre % longueur) + longueur) % longueur;
  return { ...state, positionS: ramene };
}

/** Temps en cours (1..beatsPerBar), pour la barre de mesures à l'écran. */
export function currentBeat(state: LoopState): number {
  const beatSeconds = 60 / state.tempo;
  return Math.min(state.beatsPerBar, Math.floor(state.positionS / beatSeconds) + 1);
}

export function audibleLayers(state: LoopState): readonly LoopLayer[] {
  return state.layers.filter((couche) => !couche.muted);
}
