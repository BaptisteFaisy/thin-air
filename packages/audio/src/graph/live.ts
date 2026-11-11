/**
 * Jeu direct : le même moteur branché sur Web Audio (cahier §7.9).
 * Trois règles sans exception : rampes pour tout réglage continu, événements
 * datés sur l'horloge du son avec avance, voix bornées et toujours relâchées.
 * Jamais les mots « temps réel » ni « instantané » dans les libellés (§5.4).
 */
import type { Instrument, LatencyReport, MusicEvent, Settings } from "@thin-air/core";
import { dbToGain } from "@thin-air/core";
import {
  computeLatencyReport,
  wirelessWarning,
  type LatencyParts,
} from "./latency.js";
import {
  buildImpulse,
  buildLiveGraph,
  createLiveVoice,
  setMasterGain,
  setReverbAmount,
  type ControlParamName,
  type LiveGraph,
  type LiveVoice,
} from "./nodes.js";
import { makeCeilingCurve } from "./params.js";
import { audioClock, browserTimer, LiveScheduler } from "./scheduler.js";
import { defaultPluckWorkletUrl, installPluckProcessor } from "./worklet.js";
import { LiveVoicePool } from "./voices.js";

/** Période du minuteur de programmation, ms (§7.9 règle 2). */
export const TICK_MS = 25;

/** Fenêtre programmée à chaque passage du minuteur, ms (§7.9 règle 2). */
export const WINDOW_MS = 100;

/** Durée de la réponse de réverbération calculée, secondes (§7.9). */
export const IMPULSE_SECONDS = 1.6;

/** Graine de la réponse de réverbération : fixe, pour un même son d'un run à l'autre. */
export const IMPULSE_SEED = 0x9e3779b9;

/** Relâchement par défaut quand l'instrument n'en déclare pas, ms. */
export const DEFAULT_RELEASE_MS = 120;

/**
 * Mesures que le moteur ne peut pas faire lui-même : le temps d'analyse et le
 * temps de traitement vivent du côté vision (§5.1). Facultatif : sans lui, le
 * rapport de retard est déclaré partiel (AIR-F-31).
 */
export interface LatencyTimings {
  /** Dernier temps d'analyse des mains mesuré, ms. */
  inferenceMs(): number;
  /** Dernier temps de traitement (filtrage, gestes, correspondance) mesuré, ms. */
  processingMs(): number;
}

export interface LiveEngineOptions {
  readonly instrument: Instrument;
  readonly settings: Settings;
  readonly latencyHint?: "interactive" | "playback";
  /** Ajout A9, facultatif : URL du module de corde servi par le site. */
  readonly workletUrl?: string;
  /** Ajout A9, facultatif : mesures du côté vision pour le rapport de retard. */
  readonly timings?: LatencyTimings;
}

export interface LiveEngine {
  start(): Promise<void>;
  stop(): void;
  /** Événements datés sur l'horloge du son. */
  play(events: readonly MusicEvent[]): void;
  /** Relâchement général : onglet masqué, caméra figée, changement d'instrument. */
  releaseAll(): void;
  setInstrument(instrument: Instrument): void;
  setSettings(settings: Settings): void;
  /** Ce que le navigateur déclare, et ce qu'il ne peut pas déclarer (§5.1). */
  latency(): LatencyReport;
  readonly context: AudioContext | null;
  /** Ajout A9 : ce que le moteur signale à l'écran, dont la sortie sans fil (AIR-F-32). */
  readonly warnings: readonly string[];
}

/** Horloge murale du moteur, pour mesurer son propre temps de traitement. */
function wallMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

/** `outputLatency` n'existe que dans les navigateurs récents (§7.9). */
function outputLatencyMs(context: AudioContext | null): number | null {
  if (context === null) return null;
  const declared = (context as AudioContext & { outputLatency?: number }).outputLatency;
  return typeof declared === "number" && Number.isFinite(declared) ? declared * 1000 : null;
}

export function createLiveEngine(options: LiveEngineOptions): LiveEngine {
  return new LiveEngineImpl(options);
}

class LiveEngineImpl implements LiveEngine {
  private instrument: Instrument;

  private settings: Settings;

  private readonly options: LiveEngineOptions;

  private audio: AudioContext | null = null;

  private graph: LiveGraph | null = null;

  private scheduler: LiveScheduler | null = null;

  private readonly voices = new Map<string, LiveVoice>();

  private readonly pool: LiveVoicePool;

  private workletReady = false;

  private seed = IMPULSE_SEED;

  private lastFrameAt: number | null = null;

  private frameIntervalMs = 0;

  private processingMs = 0;

  /** Dernier plafond appliqué : la courbe n'est reconstruite que s'il change. */
  private ceilingDb: number | null = null;

  constructor(options: LiveEngineOptions) {
    this.options = options;
    this.instrument = options.instrument;
    this.settings = options.settings;
    this.pool = new LiveVoicePool({
      maxVoices: options.settings.maxVoices,
      stallReleaseMs: options.settings.stallReleaseMs,
      releaseS: this.releaseSeconds(options.instrument),
      hooks: {
        onSteal: (id) => this.fadeOut(id),
        onRelease: (id) => this.fadeOut(id),
      },
    });
  }

  get context(): AudioContext | null {
    return this.audio;
  }

  get warnings(): readonly string[] {
    const warning = wirelessWarning(this.latency(), this.settings.wirelessWarnMs);
    return warning === null ? [] : [warning];
  }

  /** Ouvre le contexte avec la consigne de retard « interactive » (§7.9). */
  async start(): Promise<void> {
    if (this.audio !== null) return;
    const context = new AudioContext({ latencyHint: this.options.latencyHint ?? "interactive" });
    this.audio = context;
    await context.resume();
    await this.ensureWorklet();
    const impulse = await buildImpulse(context, IMPULSE_SECONDS, IMPULSE_SEED);
    this.graph = buildLiveGraph(context, dbToGain(this.settings.ceilingDb), impulse);
    this.applySettings(context.currentTime);
    this.scheduler = new LiveScheduler({
      tickMs: TICK_MS,
      windowMs: WINDOW_MS,
      lookaheadMs: this.settings.lookaheadMs,
      clock: audioClock(context),
      timer: browserTimer(),
      onSchedule: (event, at) => this.scheduleEvent(event, at),
      onTick: (now) => this.pool.checkStall(now),
    });
    this.scheduler.start();
  }

  stop(): void {
    this.scheduler?.stop();
    this.scheduler = null;
    this.pool.releaseAll();
    this.voices.clear();
    const context = this.audio;
    this.audio = null;
    this.graph = null;
    this.workletReady = false;
    if (context !== null) void context.close().catch(() => undefined);
  }

  /**
   * Des événements datés sur l'horloge du son. Chaque appel signale aussi une
   * image analysée : c'est ce qui arme la surveillance du gel (règle 3).
   */
  play(events: readonly MusicEvent[]): void {
    const began = wallMs();
    const context = this.audio;
    if (context !== null) {
      const now = context.currentTime;
      this.trackFrame(now);
      this.pool.noteFrame(now);
      this.scheduler?.push(events);
    }
    this.processingMs = wallMs() - began;
  }

  /** Relâchement général : le fondu commence tout de suite, sans claquement. */
  releaseAll(): void {
    this.scheduler?.clear();
    this.pool.releaseAll();
  }

  /** Changement d'instrument : les voix en cours s'éteignent en fondu (AIR-F-24). */
  setInstrument(instrument: Instrument): void {
    this.instrument = instrument;
    this.pool.setReleaseSeconds(this.releaseSeconds(instrument));
    this.scheduler?.clear();
    this.pool.releaseAll();
    void this.ensureWorklet();
  }

  /** Aucun réglage n'est fixé : tout passe par une rampe (règle 1 de §7.9). */
  setSettings(settings: Settings): void {
    this.settings = settings;
    this.pool.setLimits(settings.maxVoices, settings.stallReleaseMs);
    this.scheduler?.setLookaheadMs(settings.lookaheadMs);
    const context = this.audio;
    if (context === null) return;
    this.applySettings(context.currentTime);
  }

  /** Ce que le navigateur déclare, et ce qu'il ne peut pas déclarer (§5.1). */
  latency(): LatencyReport {
    const timings = this.options.timings;
    const context = this.audio;
    const parts: LatencyParts = {
      frameIntervalMs: this.frameIntervalMs,
      inferenceMs: timings?.inferenceMs() ?? 0,
      processingMs: timings?.processingMs() ?? this.processingMs,
      audioBaseMs: context === null ? 0 : context.baseLatency * 1000,
      audioOutputMs: outputLatencyMs(context),
      inferenceUnknown: timings === undefined,
    };
    return computeLatencyReport(parts, this.settings.cameraLatencyMs);
  }

  private applySettings(at: number): void {
    const graph = this.graph;
    if (graph === null) return;
    const tau = this.tauS();
    setMasterGain(graph, this.settings.masterGainDb, at, tau);
    setReverbAmount(graph, this.settings.reverb, at, tau);
    // La courbe du plafond n'est pas un `AudioParam` : on ne la reconstruit que
    // si le réglage change, pour ne pas casser le signal pendant qu'il sonne.
    if (this.ceilingDb !== this.settings.ceilingDb) {
      this.ceilingDb = this.settings.ceilingDb;
      graph.ceiling.curve = makeCeilingCurve(dbToGain(this.settings.ceilingDb));
    }
  }

  private tauS(): number {
    return this.settings.paramTauMs / 1000;
  }

  private releaseSeconds(instrument: Instrument): number {
    return Math.max(instrument.sound.releaseMs ?? DEFAULT_RELEASE_MS, 5) / 1000;
  }

  private async ensureWorklet(): Promise<void> {
    const context = this.audio;
    if (context === null || this.workletReady) return;
    if (this.instrument.sound.engine !== "pluck") return;
    await installPluckProcessor(context, this.options.workletUrl ?? defaultPluckWorkletUrl());
    this.workletReady = true;
  }

  /** L'intervalle entre images, mesuré sur les appels successifs (moyenne mobile). */
  private trackFrame(now: number): void {
    const previous = this.lastFrameAt;
    this.lastFrameAt = now;
    if (previous === null) return;
    const gapMs = (now - previous) * 1000;
    if (!Number.isFinite(gapMs) || gapMs <= 0) return;
    this.frameIntervalMs = this.frameIntervalMs === 0 ? gapMs : this.frameIntervalMs * 0.8 + gapMs * 0.2;
  }

  private scheduleEvent(event: MusicEvent, at: number): void {
    if (event.type === "noteOn") this.startVoice(event, at);
    else if (event.type === "noteOff") this.stopVoice(event.voice, at);
    else this.controlVoice(event.voice, event.param, event.value, at);
  }

  private startVoice(event: Extract<MusicEvent, { type: "noteOn" }>, at: number): void {
    const context = this.audio;
    const graph = this.graph;
    if (context === null || graph === null) return;
    this.stopVoice(event.voice, at);
    const voice = createLiveVoice(context, event.voice, {
      sound: this.instrument.sound,
      midi: event.midi,
      velocity: event.velocity,
      tauS: this.tauS(),
      seed: this.nextSeed(),
      workletReady: this.workletReady,
      destination: graph.input,
    });
    this.voices.set(event.voice, voice);
    voice.start(at);
    this.pool.start(event.voice, at);
  }

  private stopVoice(id: string, at: number): void {
    const voice = this.voices.get(id);
    this.pool.release(id);
    if (voice === undefined) return;
    voice.noteOff(at, this.pool.releaseSeconds);
    this.scheduleDispose(id, voice);
  }

  private controlVoice(id: string, param: ControlParamName, value: number, at: number): void {
    this.voices.get(id)?.setParam(param, value, at, this.tauS());
  }

  /** Fondu puis démontage : jamais une coupure franche du gain (AIR-F-24). */
  private fadeOut(id: string): void {
    const voice = this.voices.get(id);
    if (voice === undefined) return;
    const context = this.audio;
    const at = context === null ? 0 : context.currentTime;
    voice.noteOff(at, this.pool.releaseSeconds);
    this.scheduleDispose(id, voice);
  }

  private scheduleDispose(id: string, voice: LiveVoice): void {
    const delayMs = this.pool.releaseSeconds * 4000 + 100;
    globalThis.setTimeout(() => {
      if (this.voices.get(id) === voice) this.voices.delete(id);
      voice.dispose();
    }, delayMs);
  }

  /** Graine de voix : déterministe, jamais `Math.random()` (AIR-N-09). */
  private nextSeed(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed;
  }
}
