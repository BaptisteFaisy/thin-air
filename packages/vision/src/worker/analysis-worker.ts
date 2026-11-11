/**
 * Le worker d'analyse des mains (cahier §7.3, AIR-F-07) : MediaPipe tourne ici,
 * hors du fil principal. Le worker reçoit des `ImageBitmap` transférées (jamais
 * clonées), les convertit en `VideoFrame` pour `detectForVideo`, mesure le temps
 * d'analyse et renvoie une `VisionFrame` exacte (source.ts), numérotée.
 *
 * Le paquet MediaPipe est importé statiquement : le worker est confiné dans sa
 * propre unité de compilation par Vite, et un import dynamique y déclencherait
 * du code-splitting incompatible avec le format de worker. La logique partagée
 * (détecteur, repli GPU → CPU, enveloppe) vit dans `landmarker-core.ts`.
 *
 * Ce fichier est un point d'entrée de worker : il n'est PAS exporté par
 * `index.ts`, et ne s'exécute que dans un `Worker` (créé par `host.ts`).
 * Aucune requête tierce : le modèle et le wasm viennent des chemins du site.
 */
import * as tasksVision from "@mediapipe/tasks-vision";
import {
  createWithCpuFallback,
  DEFAULT_MODEL_URL,
  DEFAULT_WASM_ROOT,
  mediaPipeDetector,
  wrapDetector,
  type Landmarker,
  type VisionModule,
} from "../landmarker-core.js";
import {
  isHostToWorker,
  messageOf,
  workerResult,
  type CloseMessage,
  type DetectMessage,
  type InitMessage,
  type WorkerToHost,
} from "./protocol.js";

/** La surface minimale de `DedicatedWorkerGlobalScope`. */
interface WorkerScope {
  onmessage: ((message: { data: unknown }) => void) | null;
  postMessage(message: WorkerToHost): void;
  close(): void;
}

const scope = globalThis as unknown as WorkerScope;

let landmarker: Landmarker | null = null;
let canvas: OffscreenCanvas | null = null;

function envoyer(message: WorkerToHost): void {
  scope.postMessage(message);
}

/** Charge le modèle une fois, avec les chemins servant du site (AIR-N-01). */
async function charger(message: InitMessage): Promise<void> {
  const module = tasksVision as unknown as VisionModule;
  const factory = await mediaPipeDetector(module, {
    modelUrl: message.modelUrl ?? DEFAULT_MODEL_URL,
    wasmRoot: message.wasmRoot ?? DEFAULT_WASM_ROOT,
    numHands: message.numHands,
  });
  const { detector, delegate } = await createWithCpuFallback(factory, message.delegate);
  landmarker = wrapDetector(detector, delegate);
}

/**
 * Dessine la bitmap sur un `OffscreenCanvas` persistant et l'encapsule en
 * `VideoFrame` : `detectForVideo` en mode vidéo exige un `VideoFrame` hors DOM.
 * L'horodatage du `VideoFrame` (microsecondes) est celui de l'image ; seul le
 * milliseconde redonné à `detect` compte pour la monotonie (voir `wrapDetector`).
 */
function enVideoFrame(bitmap: ImageBitmap, timestampS: number): VideoFrame {
  if (canvas === null || canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  }
  const contexte = canvas.getContext("2d");
  if (contexte === null) throw new Error("analyse : OffscreenCanvas sans contexte 2d");
  contexte.drawImage(bitmap, 0, 0);
  return new VideoFrame(canvas, { timestamp: Math.max(0, Math.round(timestampS * 1e6)) });
}

/** Convertit, analyse, mesure, et referme le `VideoFrame` dans tous les cas. */
function analyser(
  detecteur: Landmarker,
  bitmap: ImageBitmap,
  timestampS: number,
): ReturnType<Landmarker["detect"]> {
  const frame = enVideoFrame(bitmap, timestampS);
  try {
    return detecteur.detect(frame as unknown as HTMLVideoElement, timestampS * 1000);
  } finally {
    frame.close();
  }
}

function traiterDetect(message: DetectMessage): void {
  if (landmarker === null) {
    envoyer({ type: "error", id: message.id, message: "analyse : modèle non chargé" });
    return;
  }
  try {
    const resultat = analyser(landmarker, message.image, message.timestampS);
    envoyer(workerResult(message.id, message.timestampS, resultat.hands, resultat.inferenceMs));
  } catch (erreur) {
    envoyer({ type: "error", id: message.id, message: messageOf(erreur) });
  }
}

async function traiterInit(message: InitMessage): Promise<void> {
  try {
    await charger(message);
    envoyer({ type: "ready" });
  } catch (erreur) {
    envoyer({ type: "error", message: messageOf(erreur) });
  }
}

function fermer(_message: CloseMessage): void {
  landmarker?.close();
  landmarker = null;
  canvas = null;
  scope.close();
}

/** Route un message du fil principal ; ignore ce qui n'est pas du protocole. */
function traiter(data: unknown): void {
  if (!isHostToWorker(data)) return;
  if (data.type === "init") {
    void traiterInit(data);
    return;
  }
  if (data.type === "detect") {
    traiterDetect(data);
    return;
  }
  fermer(data);
}

scope.onmessage = (message) => traiter(message.data);