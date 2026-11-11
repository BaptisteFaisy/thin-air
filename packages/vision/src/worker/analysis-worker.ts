/**
 * Le worker d'analyse (cahier §7.3, AIR-F-07, AIR-F-31).
 *
 * Charge le modèle (`loadLandmarker`) et exécute `detectForVideo` ICI, hors du
 * fil principal, pour que l'analyse n'occupe plus la page (§7.3). Les images
 * arrivent par transfert d'`ImageBitmap` (choix expliqué dans
 * `docs/worker.md`) : le fil principal détache l'image, le worker en devient
 * propriétaire, et MediaPipe l'accepte comme `TexImageSource` en mode VIDÉO.
 *
 * Le temps d'analyse est mesuré par `wrapDetector` autour de l'appel réel ;
 * le worker le renvoie avec les mains, au format attendu par le fil principal.
 *
 * La logique est une usine (`createWorkerRuntime`) injectable pour les tests ;
 * le branchement sur `self.onmessage` est tout en bas, pour que le fichier
 * reste lisible et la logique testable hors navigateur.
 */
import { loadLandmarker, type Landmarker } from "../landmarker.js";
import type { WorkerInMessage, WorkerInit, WorkerOutMessage } from "./protocol.js";

/** La surface minimale d'un worker, pour rester indépendant du contexte. */
export interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

/** Un modèle prêt, avec le délégué effectivement retenu. */
type LandmarkerWithDelegate = Landmarker & { readonly delegate?: "GPU" | "CPU" };

export interface WorkerRuntime {
  onmessage(event: { data: unknown }): void;
  dispose(): void;
}

function isInMessage(value: unknown): value is WorkerInMessage {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  const kind = (value as { kind: unknown }).kind;
  return kind === "init" || kind === "detect";
}

/** Le format d'un message `detect`, extrait pour rester lisible. */
type DetectMessage = Extract<WorkerInMessage, { kind: "detect" }>;

/**
 * La logique du worker, découplée de `self` pour être testée. `load` est
 * injecté : le branchement réel passe `loadLandmarker`, les tests un double.
 */
export function createWorkerRuntime(
  scope: WorkerScope,
  load: (options: WorkerInit) => Promise<Landmarker>,
): WorkerRuntime {
  let landmarker: Landmarker | null = null;
  let loading: Promise<Landmarker> | null = null;
  let ferme = false;

  function repondre(message: WorkerOutMessage): void {
    if (!ferme) scope.postMessage(message);
  }

  async function traiterInit(options: WorkerInit): Promise<void> {
    try {
      loading ??= load(options);
      landmarker = await loading;
      if (ferme) return;
      repondre({ kind: "ready", delegate: (landmarker as LandmarkerWithDelegate).delegate });
    } catch (erreur) {
      repondre({ kind: "error", frameId: null, message: messageDe(erreur) });
    }
  }

  async function detecter(message: DetectMessage): Promise<void> {
    try {
      // L'hôte envoie `init` puis attend `ready` avant tout `detect`.
      if (landmarker === null) throw new Error("vision.worker : modèle non chargé");
      const resultat = landmarker.detect(message.image as unknown as HTMLVideoElement, message.timestampMs);
      repondre({
        kind: "result",
        frameId: message.frameId,
        hands: resultat.hands,
        inferenceMs: resultat.inferenceMs,
      });
    } catch (erreur) {
      repondre({ kind: "error", frameId: message.frameId, message: messageDe(erreur) });
    } finally {
      // Propriétaire de l'image transférée, le worker la libère (AIR-N-01).
      (message.image as { close?: () => void } | undefined)?.close?.();
    }
  }

  return {
    onmessage(event: { data: unknown }): void {
      if (ferme || !isInMessage(event.data)) return;
      if (event.data.kind === "init") void traiterInit(event.data);
      else void detecter(event.data);
    },
    dispose(): void {
      ferme = true;
      landmarker?.close();
      landmarker = null;
      loading = null;
    },
  };
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/** Le branchement réel : ce worker sert `loadLandmarker` et répond sur `self`. */
export function startAnalysisWorker(scope: WorkerScope): () => void {
  const runtime = createWorkerRuntime(scope, (options) =>
    loadLandmarker({
      modelUrl: options.modelUrl,
      wasmRoot: options.wasmRoot,
      numHands: options.numHands,
      delegate: options.delegate,
    }),
  );
  scope.onmessage = (event) => runtime.onmessage(event);
  return () => runtime.dispose();
}

// Branchement automatique : n'existe que dans un contexte de worker.
const scopeGlobal = globalThis as unknown as Partial<WorkerScope>;
if (typeof scopeGlobal?.postMessage === "function") {
  startAnalysisWorker(scopeGlobal as WorkerScope);
}