/**
 * `@thin-air/vision` — la gauche de la couture : caméra, modèle, prises.
 * Une fine enveloppe autour du modèle (cahier §11.1) : aucune logique
 * musicale ici. Rien ne sort du navigateur (AIR-N-01, AIR-F-57).
 *
 * Les noms exportés par le squelette (`createCameraSource`, `openCamera`,
 * `hasVideoFrameCallback`, `loadLandmarker`, `normaliseSides`,
 * `createTakeRecorder`, `downloadTake`, `createPointerSource`,
 * `createKeyboardSource`, `createReplaySource`) sont inchangés ; les modules
 * ajoutés (`capture`, `camera-source`, `sides`, `no-hands`, `virtual-hand`)
 * exposent la logique pure qui les porte, testée sans DOM ni modèle.
 */
export * from "./source.js";
export * from "./camera.js";
export * from "./landmarker.js";
export * from "./sides.js";
export * from "./no-hands.js";
export * from "./recorder.js";
export * from "./pointer.js";
export * from "./virtual-hand.js";
export * from "./replay.js";
export * from "./worker/protocol.js";
export * from "./worker/host.js";
export * from "./analysis-history.js";
