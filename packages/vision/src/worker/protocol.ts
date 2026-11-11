/**
 * Le protocole du worker d'analyse (cahier §7.3, AIR-F-07).
 *
 * Un format de messages, deux côtés : le fil principal (`host.ts`) envoie des
 * images à analyser, le worker (`analysis-worker.ts`) les exécute hors du fil
 * principal et renvoie mains + côté + score + temps d'analyse, au format
 * `VisionFrame` exact — rien en aval ne change (AIR-F-03, AIR-F-31).
 *
 * Ce fichier ne touche ni au DOM ni au modèle : il ne porte que des types de
 * messages et la file d'attente pure (`FrameGate`), donc il est testable dans
 * Node sans worker, sans navigateur et sans MediaPipe.
 */
import type { DetectedHand } from "@thin-air/core";
import type { Landmarker } from "../landmarker.js";

/** Version du protocole : un message d'init obsolète est refusé. */
export const WORKER_PROTOCOL = 1 as const;

/** L'initialisation : le modèle est servi par le site (AIR-N-01), jamais un tiers. */
export interface WorkerInit {
  readonly kind: "init";
  readonly protocol: typeof WORKER_PROTOCOL;
  readonly modelUrl?: string;
  readonly wasmRoot?: string;
  readonly numHands?: number;
  readonly delegate?: "GPU" | "CPU";
}

/** Une image à analyser, transférée (ImageBitmap détachée du fil principal). */
export interface WorkerDetect {
  readonly kind: "detect";
  readonly frameId: number;
  /** Horodatage de l'image, en ms ; `t` du `VisionFrame` reste côté hôte. */
  readonly timestampMs: number;
  readonly image: ImageBitmap;
}

export type WorkerInMessage = WorkerInit | WorkerDetect;

/** Le modèle est chargé ; le délégué retenu est remonté pour l'affichage. */
export interface WorkerReady {
  readonly kind: "ready";
  readonly delegate?: "GPU" | "CPU";
}

/** Le résultat d'une analyse : le format attendu par `frameAt`. */
export interface WorkerResult {
  readonly kind: "result";
  readonly frameId: number;
  readonly hands: readonly DetectedHand[];
  readonly inferenceMs: number;
}

/** Une erreur pendant l'init (`frameId` nul) ou une analyse. */
export interface WorkerError {
  readonly kind: "error";
  readonly frameId: number | null;
  readonly message: string;
}

export type WorkerOutMessage = WorkerReady | WorkerResult | WorkerError;

/** Ce qu'un worker transmet ; l'image est détachée côté hôte (transfert). */
export type LandmarkerFactory = (delegate?: "GPU" | "CPU") => Promise<Landmarker>;

/** Une image prête : envoyée tout de suite, ou mise en attente. */
export type SubmitDecision =
  | { readonly action: "send"; readonly replaced: number | null }
  | { readonly action: "queued"; readonly replaced: number | null };

/**
 * La file d'attente pure, une seule analyse par image (AIR-F-03).
 *
 * Le fil principal enregistre chaque image ; une seule part en vol, la
 * dernière en attente gagne (les précédentes sont remplacées et fermées par
 * l'appelant). Une réponse est acceptée seulement si elle porte l'image en
 * vol, sinon elle est tardive et ignorée. `reset()` rend tardive toute
 * réponse encore en vol (fin de session, déconnexion).
 */
export class FrameGate {
  #inflight: number | null = null;
  #queued: number | null = null;

  /** L'image en vol (analysée dans le worker), s'il y en a une. */
  get inflight(): number | null {
    return this.#inflight;
  }

  /** L'image en attente (bitmap prête, pas encore envoyée), s'il y en a une. */
  get queued(): number | null {
    return this.#queued;
  }

  /**
   * Une image devient prête à l'analyse. S'il n'y a rien en vol, elle part
   * tout de suite (`send`) ; sinon elle remplace l'image en attente, dont
   * l'`frameId` est rendu dans `replaced` pour que l'appelant la ferme.
   */
  submitReady(frameId: number): SubmitDecision {
    if (this.#inflight === null) {
      this.#inflight = frameId;
      return { action: "send", replaced: null };
    }
    const replaced = this.#queued === frameId ? null : this.#queued;
    this.#queued = frameId;
    return { action: "queued", replaced };
  }

  /**
   * Une réponse revient : acceptée si c'est l'image en vol, sinon tardive.
   * Une réponse acceptée libère la place pour la suivante.
   */
  respond(frameId: number): "accepted" | "late" {
    if (this.#inflight !== frameId) return "late";
    this.#inflight = null;
    return "accepted";
  }

  /**
   * Prend l'image en attente pour l'envoyer, une fois l'image en vol terminée.
   * Rend `null` s'il n'y a rien à envoyer (ou que le créneau est occupé).
   */
  nextQueued(): number | null {
    if (this.#inflight !== null) return null;
    const id = this.#queued;
    this.#queued = null;
    if (id === null) return null;
    this.#inflight = id;
    return id;
  }

  /** Fin de session : toute réponse en vol devient tardive. */
  reset(): void {
    this.#inflight = null;
    this.#queued = null;
  }
}