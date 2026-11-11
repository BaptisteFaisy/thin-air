/**
 * Moteur « fm » — cloches (cahier §7.8).
 *
 * Modulation de fréquence : la porteuse tourne à `freqHz`, le modulateur à
 * `freqHz × fmRatio`, et l'indice `fmIndex` s'éteint sur une longue résonance.
 * Le spectre d'une cloche vient de là : des partiels inharmoniques dont
 * l'amplitude tombe lentement.
 */
import type { Engine, EngineContext } from "./engine.js";
import type { VoiceParams } from "./voice.js";

const DEUX_PI = 2 * Math.PI;

export function createFmEngine(params: VoiceParams): Engine {
  const sampleRate = params.sampleRate;
  const rapport = params.fmRatio;
  const indice = params.fmIndex;
  // Résonance longue : l'indice met plus de temps à tomber que l'extinction.
  const resonances = Math.max(0.2, params.releaseS * 1.5);
  let porteuse = 0;
  let modulateur = 0;

  return {
    next(ctx: EngineContext): number {
      const increment = ctx.freqHz / sampleRate;
      porteuse += increment;
      if (porteuse >= 1) porteuse -= Math.floor(porteuse);
      modulateur += increment * rapport;
      if (modulateur >= 1) modulateur -= Math.floor(modulateur);
      const extinction = Math.exp(-ctx.timeS / resonances);
      const deviation = Math.sin(modulateur * DEUX_PI) * indice * extinction;
      return Math.sin(porteuse * DEUX_PI + deviation);
    },
    strike(): void {
      // Une cloche frappée deux fois repart : la résonance est portée par
      // `timeS`, remis à zéro par la voix à chaque frappe.
    },
    finished: false,
  };
}
