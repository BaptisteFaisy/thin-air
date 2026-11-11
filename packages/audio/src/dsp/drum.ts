/**
 * Moteur « drum » — percussions (cahier §7.8) : bruit + sinusoïde brève.
 *
 * Le bruit dure `noiseMs` et tombe exponentiellement ; le corps sonne à
 * `toneHz` sur la durée d'extinction de la voix. Le bruit vient d'un
 * générateur à graine : le même rendu donne les mêmes échantillons (AIR-N-09).
 */
import { makeNoise } from "./engines.js";
import type { Engine, EngineContext } from "./engine.js";
import type { VoiceParams } from "./voice.js";

const DEUX_PI = 2 * Math.PI;

export function createDrumEngine(params: VoiceParams): Engine {
  const bruit = makeNoise(params.seed);
  const dureeBruitS = Math.max(0.001, params.noiseMs / 1000);
  const constanteBruit = dureeBruitS * 0.35;
  const constanteCorps = Math.max(0.01, params.releaseS * 0.4);

  return {
    next(ctx: EngineContext): number {
      const t = Math.max(0, ctx.timeS);
      const enveloppeBruit = t < dureeBruitS ? Math.exp(-t / constanteBruit) : 0;
      const enveloppeCorps = Math.exp(-t / constanteCorps);
      const grain = bruit();
      const corps = Math.sin(DEUX_PI * params.toneHz * t);
      return enveloppeBruit * grain * 0.7 + enveloppeCorps * corps * 0.9;
    },
    strike(): void {
      // La frappe remet le temps de la voix à zéro : l'enveloppe repart.
    },
    finished: false,
  };
}
