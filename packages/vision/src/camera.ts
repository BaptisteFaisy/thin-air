/**
 * Capture (cahier §7.2) : 640 × 480, 60 images/s souhaitées, 24 au minimum,
 * caméra frontale, SANS audio. Chaque image nouvelle est analysée une fois et
 * une seule (AIR-F-03), sur `requestVideoFrameCallback` quand il existe.
 * La caméra ne démarre qu'après le clic « Start » (AIR-F-01).
 *
 * Ce fichier est la façade du squelette : l'implémentation est découpée en
 * `capture.ts` (contraintes, erreurs, ouverture) et `camera-source.ts`
 * (la source et son environnement injectable), pour rester sous les limites de
 * taille et garder la logique testable hors DOM.
 */
export type {
  CameraEnvironment,
  CameraOptions,
  CameraSource,
  CameraState,
  CameraStats,
  FramePresenter,
} from "./camera-source.js";
export {
  createCameraSource,
  defaultCameraEnvironment,
  isNewFrame,
  presentFramesDefault,
} from "./camera-source.js";
export type { CaptureErrorKind, CaptureOptions } from "./capture.js";
export {
  CaptureError,
  cameraConstraints,
  captureErrorFor,
  hasVideoFrameCallback,
  openCamera,
  stopStream,
} from "./capture.js";
