/**
 * Capture (cahier §7.2, AIR-F-01 à 03) : 640 × 480, 60 images par seconde
 * souhaitées, 24 au minimum, caméra frontale, **sans audio** — jamais.
 *
 * La logique est ici, l'appel au navigateur est réduit à trois points :
 * `navigator.mediaDevices.getUserMedia`, `video.play()` et la détection de
 * `requestVideoFrameCallback`. Les deux premiers sont injectables par
 * `globalThis`, le troisième se teste sur un objet quelconque.
 */

/** Réglages de capture, sous-ensemble de `CameraOptions` (camera-source.ts). */
export interface CaptureOptions {
  readonly width?: number;
  readonly height?: number;
  readonly frameRateIdeal?: number;
  readonly frameRateMin?: number;
  readonly facingMode?: "user" | "environment";
}

const CAPTURE_DEFAUT = {
  width: 640,
  height: 480,
  frameRateIdeal: 60,
  frameRateMin: 24,
  facingMode: "user",
} as const;

/**
 * Les contraintes exactes du cahier §7.2. `audio: false` est écrit en dur :
 * aucune option ne peut le réactiver (AIR-F-56 : pas de microphone).
 */
export function cameraConstraints(options: CaptureOptions = {}): MediaStreamConstraints {
  return {
    video: {
      width: options.width ?? CAPTURE_DEFAUT.width,
      height: options.height ?? CAPTURE_DEFAUT.height,
      frameRate: {
        ideal: options.frameRateIdeal ?? CAPTURE_DEFAUT.frameRateIdeal,
        min: options.frameRateMin ?? CAPTURE_DEFAUT.frameRateMin,
      },
      facingMode: options.facingMode ?? CAPTURE_DEFAUT.facingMode,
    },
    audio: false,
  };
}

/**
 * `requestVideoFrameCallback` existe-t-il ici ? Point « à vérifier » du cahier
 * (§7.2, annexe D) : la réponse dépend du navigateur, donc on la demande au
 * lieu de la supposer. Testable sur n'importe quel objet.
 */
export function hasVideoFrameCallback(video: unknown): boolean {
  if (video === null || typeof video !== "object") return false;
  const candidat = video as { requestVideoFrameCallback?: unknown };
  return typeof candidat.requestVideoFrameCallback === "function";
}

/** Pourquoi la caméra n'a pas démarré — l'écran choisit son texte là-dessus. */
export type CaptureErrorKind =
  | "permission-denied"
  | "no-camera"
  | "camera-busy"
  | "unsupported"
  | "play-failed";

const MESSAGES: Readonly<Record<CaptureErrorKind, string>> = {
  "permission-denied": "Camera access was refused. You can still play with the pointer and the keyboard.",
  "no-camera": "No camera was found on this device. You can still play with the pointer and the keyboard.",
  "camera-busy": "The camera is already used by another application.",
  unsupported: "This browser does not expose a camera here (a secure HTTPS page is required).",
  "play-failed": "The camera started but the image could not be displayed.",
};

/**
 * Erreur de capture, portant un `kind` stable : les textes de l'interface
 * sont externalisés ailleurs (AIR-N-14), l'écran n'a qu'à choisir sa clé.
 */
export class CaptureError extends Error {
  readonly kind: CaptureErrorKind;

  constructor(kind: CaptureErrorKind, message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "CaptureError";
    this.kind = kind;
  }

  /**
   * Le conseil à afficher (§7.2, AIR-F-02) : la caméra est refusée ou absente,
   * on peut jouer au pointeur et au clavier, avec le même moteur.
   */
  get fallbackToPointer(): boolean {
    return this.kind === "permission-denied" || this.kind === "no-camera" || this.kind === "unsupported";
  }
}

/** Noms d'erreur qui veulent dire la même chose d'un navigateur à l'autre. */
const PERMISSION = new Set(["NotAllowedError", "PermissionDeniedError", "SecurityError"]);
const ABSENT = new Set(["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]);

/** Traduit l'échec de `getUserMedia` en erreur lisible et classée. */
export function captureErrorFor(error: unknown): CaptureError {
  const nom =
    error !== null && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  if (PERMISSION.has(nom)) return new CaptureError("permission-denied", MESSAGES["permission-denied"], { cause: error });
  if (ABSENT.has(nom)) return new CaptureError("no-camera", MESSAGES["no-camera"], { cause: error });
  if (nom === "NotReadableError" || nom === "TrackStartError") {
    return new CaptureError("camera-busy", MESSAGES["camera-busy"], { cause: error });
  }
  return new CaptureError("no-camera", MESSAGES["no-camera"], { cause: error });
}

/**
 * Demande la caméra sans audio ; lève une `CaptureError` lisible si refusée.
 * À n'appeler qu'après le clic « Start » (AIR-F-01) : c'est l'appelant qui
 * porte cette promesse, le navigateur la vérifie de toute façon.
 */
export async function openCamera(
  video: HTMLVideoElement,
  options?: CaptureOptions,
): Promise<void> {
  const media = globalThis.navigator?.mediaDevices;
  if (media === undefined || typeof media.getUserMedia !== "function") {
    throw new CaptureError("unsupported", MESSAGES.unsupported);
  }
  let stream: MediaStream;
  try {
    stream = await media.getUserMedia(cameraConstraints(options));
  } catch (error) {
    throw captureErrorFor(error);
  }
  video.srcObject = stream;
  try {
    await video.play();
  } catch (error) {
    throw new CaptureError("play-failed", MESSAGES["play-failed"], { cause: error });
  }
}

/** Arrête les pistes du flux : la caméra s'éteint vraiment. */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (stream === null || stream === undefined) return;
  for (const track of stream.getTracks()) track.stop();
}
