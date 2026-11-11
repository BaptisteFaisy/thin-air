/**
 * `@thin-air/audio` — la droite de la couture (cahier §7.9, §11.1).
 *
 * Deux faces, un seul moteur :
 *  - `dsp/` et `offline/` : calcul pur, sans navigateur ni périphérique audio.
 *    C'est ce qui rend les fichiers de preuve (AIR-N-02, niveau 2 de §13.1).
 *  - `graph/` et `worklets/` : le même moteur branché sur Web Audio pour le
 *    jeu direct. Les voix y sont les mêmes classes, échantillon par
 *    échantillon, pour qu'un rendu mesuré dise ce que l'on entend.
 */
export * from "./dsp/tuning.js";
export * from "./dsp/engines.js";
export * from "./dsp/engine.js";
export * from "./dsp/osc.js";
export * from "./dsp/pluck.js";
export * from "./dsp/fm.js";
export * from "./dsp/drum.js";
export * from "./dsp/voice.js";
export * from "./dsp/reverb.js";
export * from "./dsp/limiter.js";
export * from "./offline/render.js";
export * from "./offline/wav.js";
export * from "./graph/live.js";
