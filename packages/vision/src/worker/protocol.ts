/**
 * Le protocole du fil d'analyse (AIR-F-07) : les messages échangés entre le
 * fil principal et le worker, plus les petits fabriquants purs, testables dans
 * Node sans DOM ni modèle. Le contrat `VisionFrame` ne change pas (source.ts) :
 * le worker renvoie exactement `{ t, hands, inferenceMs }`.
 *
 * Un message porte un `id` monotone par session : la réponse qui ne le porte
 * plus est une réponse tardive ou une réponse déjà reçue, et s'écarte.
 */
import { frameAt, type VisionFrame } from "../source.js";

/** Initialise le modèle dans le worker, avant toute analyse. */
export interface InitMessage {
  readonly type: "init";
  readonly modelUrl?: string;
  readonly wasmRoot?: string;
  readonly numHands?: number;
  readonly delegate?: "GPU" | "CPU";
}

/** Une image à analyser : la bitmap est transférée, jamais clonée. */
export interface DetectMessage {
  readonly type: "detect";
  readonly id: number;
  /** Horodatage de L'IMAGE en secondes, pas de la réponse (AIR-F-03). */
  readonly timestampS: number;
  readonly image: ImageBitmap;
}

/** Demande au worker de libérer le modèle et de s'arrêter. */
export interface CloseMessage {
  readonly type: "close";
}

export type HostToWorker = InitMessage | DetectMessage | CloseMessage;

/** Le modèle est chargé : la file peut commencer. */
export interface ReadyMessage {
  readonly type: "ready";
}

/** Le résultat d'une image, au format `VisionFrame` exact. */
export interface ResultMessage {
  readonly type: "result";
  readonly id: number;
  readonly frame: VisionFrame;
}

/** Une erreur : au démarrage (`id` absent) ou sur une image précise. */
export interface ErrorMessage {
  readonly type: "error";
  readonly message: string;
  readonly id?: number;
}

export type WorkerToHost = ReadyMessage | ResultMessage | ErrorMessage;

/** Une erreur réduite à sa chaîne : c'est ce que porte `ErrorMessage`. */
export function messageOf(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "analyse : erreur inconnue";
}

/** Une erreur sous forme d'objet `Error`, pour la remonter au fil principal. */
export function asError(erreur: unknown): Error {
  return erreur instanceof Error ? erreur : new Error(messageOf(erreur));
}

/** Un message du fil principal vers le worker. */
export function isHostToWorker(message: unknown): message is HostToWorker {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  return type === "init" || type === "detect" || type === "close";
}

/** Un message du worker vers le fil principal. */
export function isWorkerToHost(message: unknown): message is WorkerToHost {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  return type === "ready" || type === "result" || type === "error";
}

/**
 * Fabrique le résultat du worker : une `VisionFrame` exacte, horodatée à
 * l'image analysée, avec son temps d'analyse mesuré. Réutilise `frameAt`.
 */
export function workerResult(
  id: number,
  timestampS: number,
  hands: ResultMessage["frame"]["hands"],
  inferenceMs: number,
): ResultMessage {
  return { type: "result", id, frame: frameAt(timestampS, hands, inferenceMs) };
}