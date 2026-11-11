/**
 * La source caméra (cahier §7.2, AIR-F-01 à 03, AIR-F-06, AIR-N-08).
 *
 * Une image présentée = UNE analyse, avec l'horodatage réel de cette image.
 * Le navigateur prévient à chaque image via `requestVideoFrameCallback` ;
 * quand il ne l'a pas (point « à vérifier », annexe D), on retombe sur
 * `requestAnimationFrame` en surveillant le temps de la vidéo : une image déjà
 * analysée ne l'est jamais deux fois.
 *
 * Tout ce qui touche le navigateur est derrière `CameraEnvironment`, donc
 * injectable : les tests pilotent la source sans DOM, sans caméra et sans
 * modèle, et vérifient le comptage des analyses, les mesures et les états.
 */
import type { DetectedHand } from "@thin-air/core";
import { DEFAULT_MODEL_URL, loadLandmarker, type Landmarker } from "./landmarker.js";
import { createNoHandsWatcher, type NoHandsWatcher } from "./no-hands.js";
import { normaliseSides } from "./sides.js";
import {
  emptyFrame,
  FrameHub,
  defaultNow,
  frameAt,
  type FrameListener,
  type HandSource,
} from "./source.js";
import { hasVideoFrameCallback, openCamera, stopStream, type CaptureOptions } from "./capture.js";

export interface CameraStats {
  readonly frameIntervalMs: number;
  readonly inferenceMs: number;
}

export interface CameraOptions extends CaptureOptions {
  readonly onStats?: (stats: CameraStats) => void;
  /** Aucune main pendant trois secondes alors que l'image change (AIR-F-06). */
  readonly onNoHands?: (seconds: number) => void;
  /** Le modèle est servi par le site (AIR-N-01) : chemin local par défaut. */
  readonly modelUrl?: string;
  /** L'image envoyée au modèle est retournée horizontalement (défaut : non). */
  readonly mirrored?: boolean;
  /** Seuil « aucune main » en secondes (3 dans le cahier). */
  readonly noHandsThresholdS?: number;
  /** Environnement injectable : tests, ou page qui veut piloter elle-même. */
  readonly environment?: Partial<CameraEnvironment>;
}

/** L'état de la source, pour l'écran (AIR-N-08 : un état clair par cas). */
export type CameraState = "idle" | "loading" | "running" | "paused" | "stopped";

/** Abonnement aux images présentées ; rend la fonction qui désabonne. */
export type FramePresenter = (
  video: HTMLVideoElement,
  onFrame: (mediaTimeS: number) => void,
) => () => void;

export interface CameraEnvironment {
  readonly now: () => number;
  readonly createLandmarker: () => Promise<Landmarker>;
  readonly presentFrames: FramePresenter;
  readonly watchVisibility: (cb: (hidden: boolean) => void) => () => void;
  readonly watchTrackEnded: (stream: MediaStream | null, cb: () => void) => () => void;
  readonly releaseStream: () => void;
}

/** Métadonnées d'image vidéo : on n'utilise que l'horodatage réel. */
interface VideoFrameMetadata {
  readonly mediaTime?: number;
  readonly presentedFrames?: number;
  readonly width?: number;
}

interface VideoFrameCallbackVideo {
  requestVideoFrameCallback(cb: (now: number, metadata: VideoFrameMetadata) => void): number;
  cancelVideoFrameCallback(handle: number): void;
}

/** Repli (§7.2) : on surveille le temps de la vidéo à chaque rafraîchissement. */
function presentByAnimationFrame(
  video: HTMLVideoElement,
  onFrame: (mediaTimeS: number) => void,
): () => void {
  const demande = globalThis.requestAnimationFrame;
  const annule = globalThis.cancelAnimationFrame;
  if (typeof demande !== "function") return () => undefined;
  let handle = 0;
  let dernierTemps = -1;
  const pas = () => {
    const temps = video.currentTime;
    if (temps !== dernierTemps) {
      dernierTemps = temps;
      onFrame(temps);
    }
    handle = demande(pas);
  };
  handle = demande(pas);
  return () => {
    if (typeof annule === "function") annule(handle);
  };
}

/** Images présentées : `requestVideoFrameCallback` s'il existe, sinon rAF. */
export const presentFramesDefault: FramePresenter = (video, onFrame) => {
  if (!hasVideoFrameCallback(video)) return presentByAnimationFrame(video, onFrame);
  const support = video as unknown as VideoFrameCallbackVideo;
  let handle = 0;
  const pas = () => {
    handle = support.requestVideoFrameCallback((_now, metadata) => {
      const temps = metadata.mediaTime;
      if (typeof temps === "number" && Number.isFinite(temps)) onFrame(temps);
      pas();
    });
  };
  pas();
  return () => support.cancelVideoFrameCallback(handle);
};

export function defaultCameraEnvironment(
  video: HTMLVideoElement,
  options: CameraOptions,
): CameraEnvironment {
  return {
    now: defaultNow,
    createLandmarker: () => loadLandmarker({ modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL }),
    presentFrames: presentFramesDefault,
    watchVisibility: (cb) => {
      const doc = globalThis.document;
      if (doc === undefined || typeof doc.addEventListener !== "function") return () => undefined;
      const handler = () => cb(doc.visibilityState === "hidden" || doc.hidden === true);
      doc.addEventListener("visibilitychange", handler);
      return () => doc.removeEventListener("visibilitychange", handler);
    },
    watchTrackEnded: (stream, cb) => {
      if (stream === null) return () => undefined;
      const pistes = stream.getVideoTracks();
      for (const piste of pistes) piste.addEventListener("ended", cb);
      return () => {
        for (const piste of pistes) piste.removeEventListener("ended", cb);
      };
    },
    releaseStream: () => stopStream(video.srcObject as MediaStream | null),
  };
}

/** Cette image est-elle nouvelle ? (AIR-F-03 : une image, une analyse.) */
export function isNewFrame(lastMediaTimeS: number, mediaTimeS: number): boolean {
  return mediaTimeS > lastMediaTimeS + 1e-9;
}

export interface CameraSource extends HandSource {
  readonly kind: "camera";
  /** L'état courant, pour l'écran : idle, loading, running, paused, stopped. */
  readonly state: CameraState;
}

/** Pas minimal entre deux images émises : `t` reste strictement croissant. */
const PAS_MIN_S = 1 / 240;

class CameraRunner implements CameraSource {
  readonly kind = "camera" as const;
  readonly #video: HTMLVideoElement;
  readonly #options: CameraOptions;
  readonly #env: CameraEnvironment;
  readonly #hub = new FrameHub();
  readonly #watcher: NoHandsWatcher;
  #landmarker: Landmarker | null = null;
  #loading: Promise<Landmarker> | null = null;
  #detachFrames: (() => void) | null = null;
  #detachVisibility: (() => void) | null = null;
  #detachTrack: (() => void) | null = null;
  #state: CameraState = "idle";
  #dernierMediaTimeS = -1;
  #derniereImageMs = Number.NaN;
  #dernierTEmis: number | null = null;
  #origineS: number | null = null;

  constructor(video: HTMLVideoElement, options: CameraOptions) {
    this.#video = video;
    this.#options = options;
    this.#env = { ...defaultCameraEnvironment(video, options), ...(options.environment ?? {}) };
    this.#watcher = createNoHandsWatcher({ thresholdS: options.noHandsThresholdS });
  }

  get state(): CameraState {
    return this.#state;
  }

  #emettre(mains: readonly DetectedHand[], mediaTimeS: number, inferenceMs: number): void {
    const maintenant = this.#env.now();
    this.#hub.emit(frameAt(mediaTimeS, mains, inferenceMs));
    this.#dernierTEmis = mediaTimeS;
    this.#options.onStats?.({
      frameIntervalMs: Number.isNaN(this.#derniereImageMs) ? 0 : maintenant - this.#derniereImageMs,
      inferenceMs,
    });
    this.#derniereImageMs = maintenant;
    const silence = this.#watcher.push({
      t: mediaTimeS,
      hasHands: mains.length > 0,
      newFrame: true,
    });
    if (silence !== null) this.#options.onNoHands?.(silence);
  }

  /**
   * L'image du silence (AIR-N-08) : aucune main, datée juste après la dernière
   * image émise, pour que le moteur relâche ses voix sans casser la monotonie
   * de `t`. Rien n'est émis si la source n'a jamais produit d'image.
   */
  #emettreSilence(): void {
    if (this.#dernierTEmis === null) return;
    this.#dernierTEmis += PAS_MIN_S;
    this.#hub.emit(emptyFrame(this.#dernierTEmis));
  }

  /**
   * Un nouveau flux repart de zéro : on décale alors l'horodatage pour que `t`
   * reste croissant d'une session à l'autre (le filtre en aval s'y fie).
   */
  #decalageDeSession(mediaTimeS: number): number {
    if (this.#dernierTEmis === null || mediaTimeS > this.#dernierTEmis) return 0;
    return this.#dernierTEmis + PAS_MIN_S - mediaTimeS;
  }

  #surImage(mediaTimeS: number): void {
    if (this.#state !== "running" || this.#landmarker === null) return;
    if (!isNewFrame(this.#dernierMediaTimeS, mediaTimeS)) return;
    this.#dernierMediaTimeS = mediaTimeS;
    if (this.#origineS === null) this.#origineS = this.#decalageDeSession(mediaTimeS);
    const resultat = this.#landmarker.detect(this.#video, mediaTimeS * 1000);
    const mains = normaliseSides(resultat.hands, this.#options.mirrored ?? false);
    this.#emettre(mains, this.#origineS + mediaTimeS, resultat.inferenceMs);
  }

  #detacher(): void {
    this.#detachFrames?.();
    this.#detachVisibility?.();
    this.#detachTrack?.();
    this.#detachFrames = null;
    this.#detachVisibility = null;
    this.#detachTrack = null;
  }

  #pause(): void {
    if (this.#state !== "running") return;
    this.#state = "paused";
    this.#detachFrames?.();
    this.#detachFrames = null;
    this.#emettreSilence();
  }

  #reprendre(): void {
    if (this.#state !== "paused" || this.#landmarker === null) return;
    this.#state = "running";
    this.#detachFrames = this.#env.presentFrames(this.#video, (t) => this.#surImage(t));
  }

  async #charger(): Promise<Landmarker> {
    if (this.#landmarker !== null) return this.#landmarker;
    this.#loading ??= this.#env.createLandmarker();
    this.#landmarker = await this.#loading;
    return this.#landmarker;
  }

  async start(): Promise<void> {
    if (this.#state === "running") return;
    this.#state = "loading";
    await openCamera(this.#video, this.#options);
    const modele = await this.#charger();
    // Lu via l'accesseur : `stop()` a pu passer la source à l'arrêt pendant
    // l'attente du modèle, ce que le rétrécissement de type ne peut pas voir.
    if (this.state === "stopped") {
      // Arrêté pendant le chargement : on ne laisse pas un modèle ouvert.
      modele.close();
      this.#landmarker = null;
      this.#loading = null;
      return;
    }
    this.#landmarker = modele;
    this.#reinitialiserSession();
    this.#attacher();
    this.#state = "running";
  }

  #reinitialiserSession(): void {
    this.#dernierMediaTimeS = -1;
    this.#derniereImageMs = Number.NaN;
    this.#origineS = null;
    this.#watcher.reset();
  }

  #attacher(): void {
    this.#detacher();
    this.#detachFrames = this.#env.presentFrames(this.#video, (t) => this.#surImage(t));
    this.#detachVisibility = this.#env.watchVisibility((cache) =>
      cache ? this.#pause() : this.#reprendre(),
    );
    this.#detachTrack = this.#env.watchTrackEnded(
      this.#video.srcObject as MediaStream | null,
      () => {
        this.#pause();
        this.#state = "stopped";
      },
    );
  }

  stop(): void {
    if (this.#state === "idle" || this.#state === "stopped") return;
    this.#detacher();
    this.#emettreSilence();
    this.#env.releaseStream();
    this.#watcher.reset();
    this.#landmarker?.close();
    this.#landmarker = null;
    this.#loading = null;
    this.#state = "stopped";
  }

  onFrame(listener: FrameListener): () => void {
    return this.#hub.onFrame(listener);
  }
}

/**
 * Construit la source. `start()` demande la caméra (sans audio, jamais) puis
 * charge le modèle : à n'appeler qu'après le clic « Start » (AIR-F-01).
 */
export function createCameraSource(
  video: HTMLVideoElement,
  options: CameraOptions = {},
): CameraSource {
  return new CameraRunner(video, options);
}
