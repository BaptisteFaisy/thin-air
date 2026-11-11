/**
 * Le côté fil principal du déport d'analyse (cahier §7.3, AIR-F-03, AIR-F-07).
 *
 * `createAnalysisHost` rend un hôte qui reçoit les images du fil principal,
 * les confie au worker (analyse hors du fil principal) et re-émet des
 * `VisionFrame` strictement identiques à ce que produirait l'analyse en ligne :
 * même format, même horodatage — rien en aval ne change.
 *
 * Règles tenues ici :
 * - une seule analyse par image (AIR-F-03) : file à un seul emplacement, la
 *   dernière image en attente gagne, les précédentes sont écartées ;
 * - l'horodatage émis est celui de l'IMAGE, pas celui de la réponse ;
 * - une réponse tardive (image déjà dépassée, ou après une fin de session) est
 *   écartée ;
 * - repli propre : sans `Worker` ni `createImageBitmap`, l'analyse se fait dans
 *   le fil principal, avec la même API et le même état lisible (`mode`).
 */
import { loadLandmarker, type Landmarker } from "../landmarker.js";
import { frameAt, FrameHub, type FrameListener } from "../source.js";
import {
  FrameGate,
  WORKER_PROTOCOL,
  type WorkerDetect,
  type WorkerOutMessage,
  type WorkerResult,
} from "./protocol.js";

/** La surface d'un worker réel, minimale pour rester testable. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  terminate(): void;
}

/** Les dépendances du navigateur, injectables pour les tests. */
export interface AnalysisHostEnvironment {
  readonly createWorker: () => WorkerLike | null;
  readonly createBitmap: (video: HTMLVideoElement) => Promise<ImageBitmap>;
  readonly createLandmarker: () => Promise<Landmarker>;
  readonly supportsWorker: () => boolean;
}

export type AnalysisMode = "worker" | "main-thread";

export interface AnalysisHostOptions {
  readonly modelUrl?: string;
  readonly wasmRoot?: string;
  readonly numHands?: number;
  readonly delegate?: "GPU" | "CPU";
  readonly environment?: Partial<AnalysisHostEnvironment>;
  readonly onError?: (erreur: Error) => void;
}

/** L'état lisible de l'hôte ; `ready` se résout quand le modèle est prêt. */
export interface AnalysisHost {
  readonly mode: AnalysisMode;
  readonly state: "loading" | "ready" | "closed";
  readonly ready: Promise<void>;
  submit(video: HTMLVideoElement, tS: number): void;
  onFrame(listener: FrameListener): () => void;
  close(): void;
}

/** Une image résolue en attente d'envoi (bitmap déjà créée). */
interface QueueSlot {
  readonly frameId: number;
  readonly tS: number;
  readonly bitmap: ImageBitmap;
}

/** Un message `detect` à poster, sans le `kind` déjà connu. */
type DetectPayload = Omit<WorkerDetect, "kind">;

/** L'environnement par défaut : le worker du module, dans le navigateur. */
export function defaultAnalysisEnvironment(): AnalysisHostEnvironment {
  return {
    createWorker: (): WorkerLike | null => {
      try {
        return new Worker(new URL("./analysis-worker.ts", import.meta.url), {
          type: "module",
        }) as unknown as WorkerLike;
      } catch {
        return null;
      }
    },
    createBitmap: (video) => globalThis.createImageBitmap(video),
    createLandmarker: () => loadLandmarker({}),
    supportsWorker: () =>
      typeof Worker !== "undefined" && typeof globalThis.createImageBitmap === "function",
  };
}

class AnalysisHostCore implements AnalysisHost {
  readonly #options: AnalysisHostOptions;
  readonly #env: AnalysisHostEnvironment;
  readonly #hub = new FrameHub();
  readonly #gate = new FrameGate();
  #mode: AnalysisMode;
  #state: "loading" | "ready" | "closed" = "loading";
  #worker: WorkerLike | null = null;
  #landmarker: Landmarker | null = null;
  #frameId = 0;
  #creatingId: number | null = null;
  #inflightT: number | null = null;
  #queued: QueueSlot | null = null;
  #fallbackPending: { readonly video: HTMLVideoElement; readonly tS: number } | null = null;
  readonly #ready: Promise<void>;
  #resolveReady!: () => void;
  #rejectReady!: (e: Error) => void;

  constructor(options: AnalysisHostOptions, env: AnalysisHostEnvironment) {
    this.#options = options;
    this.#env = env;
    this.#mode = env.supportsWorker() ? "worker" : "main-thread";
    this.#ready = new Promise((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    void this.#init();
  }

  get mode(): AnalysisMode {
    return this.#mode;
  }

  get state(): "loading" | "ready" | "closed" {
    return this.#state;
  }

  get ready(): Promise<void> {
    return this.#ready;
  }

  onFrame(listener: FrameListener): () => void {
    return this.#hub.onFrame(listener);
  }

  submit(video: HTMLVideoElement, tS: number): void {
    if (this.#state === "closed") return;
    if (this.#mode === "main-thread") this.#submitMainThread(video, tS);
    else this.#submitWorker(video, tS);
  }

  close(): void {
    if (this.#state === "closed") return;
    this.#state = "closed";
    this.#gate.reset();
    this.#creatingId = null;
    this.#inflightT = null;
    this.#queued?.bitmap.close();
    this.#queued = null;
    this.#fallbackPending = null;
    this.#worker?.terminate();
    this.#worker = null;
    this.#landmarker?.close();
    this.#landmarker = null;
  }

  async #init(): Promise<void> {
    if (this.#mode === "main-thread") {
      await this.#loadMainThread();
      return;
    }
    const worker = this.#env.createWorker();
    if (worker === null) {
      await this.#replier();
      return;
    }
    this.#worker = worker;
    worker.onmessage = (event) => this.#onWorkerMessage(event.data);
    worker.postMessage({
      kind: "init",
      protocol: WORKER_PROTOCOL,
      modelUrl: this.#options.modelUrl,
      wasmRoot: this.#options.wasmRoot,
      numHands: this.#options.numHands,
      delegate: this.#options.delegate,
    });
  }

  async #replier(): Promise<void> {
    this.#worker?.terminate();
    this.#worker = null;
    this.#mode = "main-thread";
    await this.#loadMainThread();
  }

  async #loadMainThread(): Promise<void> {
    try {
      const modele = await this.#env.createLandmarker();
      if (this.#state === "closed") {
        modele.close();
        return;
      }
      this.#landmarker = modele;
      const enAttente = this.#fallbackPending;
      this.#fallbackPending = null;
      this.#state = "ready";
      this.#resolveReady();
      if (enAttente !== null) this.#mainThreadDetect(enAttente.video, enAttente.tS);
    } catch (erreur) {
      this.#state = "closed";
      this.#rejectReady(new Error(messageDe(erreur)));
    }
  }

  #submitWorker(video: HTMLVideoElement, tS: number): void {
    const id = ++this.#frameId;
    this.#creatingId = id;
    this.#env.createBitmap(video).then(
      (bitmap) => this.#onBitmap(id, tS, bitmap),
      (erreur) => this.#onCreateError(id, erreur),
    );
  }

  #onBitmap(id: number, tS: number, bitmap: ImageBitmap): void {
    if (id !== this.#creatingId || this.#state === "closed") {
      bitmap.close();
      return;
    }
    this.#creatingId = null;
    const decision = this.#gate.submitReady(id);
    if (decision.replaced !== null) {
      this.#queued?.bitmap.close();
      this.#queued = null;
    }
    if (decision.action === "send") {
      this.#inflightT = tS;
      this.#send({ frameId: id, timestampMs: arrondirMs(tS), image: bitmap });
    } else {
      this.#queued = { frameId: id, tS, bitmap };
    }
  }

  #onCreateError(id: number, erreur: unknown): void {
    if (id !== this.#creatingId) return;
    this.#creatingId = null;
    this.#options.onError?.(new Error(messageDe(erreur)));
  }

  #send(payload: DetectPayload): void {
    this.#worker?.postMessage({ kind: "detect", ...payload }, [payload.image]);
  }

  #onWorkerMessage(data: unknown): void {
    if (this.#state === "closed") return;
    const message = data as WorkerOutMessage;
    if (message.kind === "ready") {
      this.#state = "ready";
      this.#resolveReady();
      return;
    }
    if (message.kind === "error") {
      this.#onWorkerError(message);
      return;
    }
    this.#onWorkerResult(message);
  }

  #onWorkerError(message: Extract<WorkerOutMessage, { kind: "error" }>): void {
    if (message.frameId === null) {
      void this.#replier();
      return;
    }
    // Une analyse a échoué : on libère le créneau et on continue.
    if (this.#gate.respond(message.frameId) === "late") return;
    this.#inflightT = null;
    this.#options.onError?.(new Error(message.message));
    this.#pumpNext();
  }

  #onWorkerResult(message: WorkerResult): void {
    if (this.#gate.respond(message.frameId) === "late") return;
    const tImage = this.#inflightT;
    this.#inflightT = null;
    this.#hub.emit(frameAt(tImage ?? 0, message.hands, message.inferenceMs));
    this.#pumpNext();
  }

  #pumpNext(): void {
    const next = this.#gate.nextQueued();
    if (next === null || this.#queued === null) return;
    const slot = this.#queued;
    this.#queued = null;
    this.#inflightT = slot.tS;
    this.#send({ frameId: slot.frameId, timestampMs: arrondirMs(slot.tS), image: slot.bitmap });
  }

  #submitMainThread(video: HTMLVideoElement, tS: number): void {
    if (this.#landmarker === null) {
      this.#fallbackPending = { video, tS };
      return;
    }
    this.#mainThreadDetect(video, tS);
  }

  #mainThreadDetect(video: HTMLVideoElement, tS: number): void {
    const landmarker = this.#landmarker;
    if (landmarker === null) return;
    const resultat = landmarker.detect(video, arrondirMs(tS));
    this.#hub.emit(frameAt(tS, resultat.hands, resultat.inferenceMs));
  }
}

function arrondirMs(tS: number): number {
  return Number.isFinite(tS) ? Math.max(0, Math.round(tS * 1000)) : 0;
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/** Construit l'hôte d'analyse : worker si possible, sinon fil principal. */
export function createAnalysisHost(options: AnalysisHostOptions = {}): AnalysisHost {
  const env: AnalysisHostEnvironment = {
    ...defaultAnalysisEnvironment(),
    ...(options.environment ?? {}),
  };
  return new AnalysisHostCore(options, env);
}