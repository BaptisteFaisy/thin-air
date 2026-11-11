/**
 * Le côté fil principal de l'analyse déportée (AIR-F-07, AIR-F-03, §7.3).
 *
 * Une image soumise est analysée une fois et une seule, avec son horodatage
 * (celui de l'image, jamais celui de la réponse). La file ne garde que la
 * dernière image en attente : quand l'analyse est plus lente que la capture,
 * les images intermédiaires ne s'empilent pas, elles sont remplacées — une
 * image analysée l'est exactement une fois (AIR-F-03). Une réponse qui ne
 * porte plus l'`id` en cours (réponse tardive, dupliquée, ou reçue après
 * `stop()`) est écartée.
 *
 * Repli propre : si `Worker` ou `OffscreenCanvas` manque, l'analyse se fait
 * dans le fil principal, derrière la même interface (`AnalysisHost`) et le
 * même format `VisionFrame`. Tout ce qui touche le navigateur est injectable,
 * donc la logique pure se teste dans Node sans DOM, sans caméra ni modèle.
 */
import { loadLandmarker, type Landmarker } from "../landmarker.js";
import { isNewFrame } from "../camera-source.js";
import { frameAt, FrameHub, type FrameListener } from "../source.js";
import {
  asError,
  isWorkerToHost,
  type DetectMessage,
  type InitMessage,
  type ResultMessage,
} from "./protocol.js";

/** La surface minimale d'un `Worker`, injectable pour les tests. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: readonly unknown[]): void;
  onmessage: ((message: MessageEvent) => void) | null;
  terminate(): void;
}

/** Les points de contact du navigateur, tous remplaçables. */
export interface AnalysisHostEnvironment {
  readonly workerSupported: () => boolean;
  readonly offscreenSupported: () => boolean;
  readonly createWorker: () => WorkerLike;
  readonly createImageBitmap: (source: ImageBitmapSource) => Promise<ImageBitmap>;
  readonly createLandmarker: () => Promise<Landmarker>;
}

export interface AnalysisHostOptions {
  readonly modelUrl?: string;
  readonly wasmRoot?: string;
  readonly numHands?: number;
  readonly delegate?: "GPU" | "CPU";
  /** Une erreur remontée sans interrompre la file. */
  readonly onError?: (erreur: Error) => void;
  readonly environment?: Partial<AnalysisHostEnvironment>;
}

/** Le mode effectivement retenu, après détection des capacités. */
export type AnalysisMode = "worker" | "main";

export interface AnalysisHost {
  readonly mode: AnalysisMode;
  start(): Promise<void>;
  /** Soumet l'image ; le résultat arrive par `onFrame`, dans l'ordre. */
  submit(video: HTMLVideoElement, timestampS: number): void;
  onFrame(listener: FrameListener): () => void;
  stop(): void;
}

/** L'environnement réel du navigateur (chemins du site, AIR-N-01). */
function defaultEnvironment(options: AnalysisHostOptions): AnalysisHostEnvironment {
  return {
    workerSupported: () => typeof Worker === "function",
    offscreenSupported: () => typeof OffscreenCanvas === "function",
    createWorker: () =>
      new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" }),
    createImageBitmap: (source) => createImageBitmap(source),
    createLandmarker: () =>
      loadLandmarker({
        modelUrl: options.modelUrl,
        wasmRoot: options.wasmRoot,
        numHands: options.numHands,
        delegate: options.delegate,
      }),
  };
}

interface EnAttente {
  readonly video: HTMLVideoElement;
  readonly timestampS: number;
}

interface Demarrage {
  readonly resolve: () => void;
  readonly reject: (erreur: Error) => void;
}

class AnalysisHostRunner implements AnalysisHost {
  readonly #hub = new FrameHub();
  readonly #env: AnalysisHostEnvironment;
  readonly #options: AnalysisHostOptions;
  #mode: AnalysisMode;
  #worker: WorkerLike | null = null;
  #landmarker: Landmarker | null = null;
  #pret = false;
  #demarrage: Demarrage | null = null;
  #attente: EnAttente | null = null;
  #enCours: number | null = null;
  #timestampAttendu: number | null = null;
  #prochainId = 0;
  #dernierSoumis = -1;

  constructor(options: AnalysisHostOptions) {
    this.#options = options;
    this.#env = { ...defaultEnvironment(options), ...(options.environment ?? {}) };
    this.#mode =
      this.#env.workerSupported() && this.#env.offscreenSupported() ? "worker" : "main";
  }

  get mode(): AnalysisMode {
    return this.#mode;
  }

  async start(): Promise<void> {
    if (this.#pret) return;
    if (this.#mode === "worker") {
      if (await this.#demarrerWorker()) {
        this.#pret = true;
        return;
      }
      this.#mode = "main";
    }
    this.#landmarker = await this.#env.createLandmarker();
    this.#pret = true;
  }

  /**
   * Ouvre le worker et attend son `ready`. Rend `false` si l'ouverture ou le
   * chargement du modèle échoue, afin de retomber sur le fil principal.
   */
  async #demarrerWorker(): Promise<boolean> {
    let worker: WorkerLike;
    try {
      worker = this.#env.createWorker();
    } catch {
      return false;
    }
    this.#worker = worker;
    worker.onmessage = (message) => this.#surMessage(message.data);
    const attente = new Promise<void>((resolve, reject) => {
      this.#demarrage = { resolve, reject };
    });
    const init: InitMessage = {
      type: "init",
      modelUrl: this.#options.modelUrl,
      wasmRoot: this.#options.wasmRoot,
      numHands: this.#options.numHands,
      delegate: this.#options.delegate,
    };
    worker.postMessage(init);
    try {
      await attente;
      return true;
    } catch {
      this.#libererWorker();
      return false;
    }
  }

  submit(video: HTMLVideoElement, timestampS: number): void {
    if (!this.#pret) return;
    if (!isNewFrame(this.#dernierSoumis, timestampS)) return;
    this.#dernierSoumis = timestampS;
    if (this.#mode === "main") {
      this.#analyserPrincipal(video, timestampS);
      return;
    }
    this.#attente = { video, timestampS };
    this.#expedier();
  }

  onFrame(listener: FrameListener): () => void {
    return this.#hub.onFrame(listener);
  }

  stop(): void {
    this.#pret = false;
    this.#attente = null;
    this.#enCours = null;
    this.#timestampAttendu = null;
    this.#dernierSoumis = -1;
    this.#demarrage = null;
    if (this.#worker !== null) {
      this.#libererWorker();
    } else {
      this.#landmarker?.close();
      this.#landmarker = null;
    }
  }

  #libererWorker(): void {
    const worker = this.#worker;
    if (worker === null) return;
    this.#worker = null;
    try {
      worker.postMessage({ type: "close" });
      worker.terminate();
    } catch {
      // déjà arrêté : rien à faire
    }
  }

  /** Expédie la dernière image en attente si le worker est libre. */
  #expedier(): void {
    if (this.#enCours !== null) return;
    const attente = this.#attente;
    if (attente === null) return;
    this.#attente = null;
    const id = ++this.#prochainId;
    this.#enCours = id;
    this.#timestampAttendu = attente.timestampS;
    void this.#capturerEtEnvoyer(id, attente);
  }

  async #capturerEtEnvoyer(id: number, attente: EnAttente): Promise<void> {
    try {
      const bitmap = await this.#env.createImageBitmap(attente.video);
      if (this.#enCours !== id) {
        bitmap.close();
        return;
      }
      const message: DetectMessage = {
        type: "detect",
        id,
        timestampS: attente.timestampS,
        image: bitmap,
      };
      this.#worker?.postMessage(message, [bitmap]);
    } catch (erreur) {
      if (this.#enCours !== id) return;
      this.#enCours = null;
      this.#timestampAttendu = null;
      this.#options.onError?.(asError(erreur));
      this.#expedier();
    }
  }

  #surMessage(data: unknown): void {
    if (!isWorkerToHost(data)) return;
    if (data.type === "ready") {
      this.#demarrage?.resolve();
      this.#demarrage = null;
      return;
    }
    if (data.type === "error") {
      if (this.#demarrage !== null) {
        const demarrage = this.#demarrage;
        this.#demarrage = null;
        demarrage.reject(new Error(data.message));
        return;
      }
      this.#options.onError?.(new Error(data.message));
      if (data.id !== undefined) this.#acquitter(data.id);
      return;
    }
    this.#surResult(data);
  }

  #surResult(resultat: ResultMessage): void {
    if (resultat.id !== this.#enCours) return;
    const timestampS = this.#timestampAttendu;
    if (timestampS === null) return;
    this.#enCours = null;
    this.#timestampAttendu = null;
    // L'horodatage est celui de l'IMAGE, jamais celui de la réponse (AIR-F-03).
    this.#hub.emit(frameAt(timestampS, resultat.frame.hands, resultat.frame.inferenceMs));
    this.#expedier();
  }

  /** Après un résultat ou une erreur : on libère la file pour l'image suivante. */
  #acquitter(id: number): void {
    if (this.#enCours !== id) return;
    this.#enCours = null;
    this.#timestampAttendu = null;
    this.#expedier();
  }

  /** L'analyse dans le fil principal (repli) : synchrone, même résultat. */
  #analyserPrincipal(video: HTMLVideoElement, timestampS: number): void {
    const detecteur = this.#landmarker;
    if (detecteur === null) return;
    const resultat = detecteur.detect(video, timestampS * 1000);
    this.#hub.emit(frameAt(timestampS, resultat.hands, resultat.inferenceMs));
  }
}

/** Construit l'hôte d'analyse, en worker si possible, sinon sur le fil principal. */
export function createAnalysisHost(options: AnalysisHostOptions = {}): AnalysisHost {
  return new AnalysisHostRunner(options);
}