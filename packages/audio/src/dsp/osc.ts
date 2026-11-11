/**
 * Moteur « osc » (cahier §7.8) : lecture de table d'ondes.
 *
 * Thérémine : sinusoïde + harmonique 2 d'amplitude `second`.
 * Nappes : deux lectures de table désaccordées de `detuneCents`, mélangées à
 * parts égales. Un passe-bas à un pôle suit `cutoffHz` : c'est la brillance
 * que la main commande.
 */
import { buildWaveTable } from "./engines.js";
import type { Engine, EngineContext } from "./engine.js";
import type { VoiceParams } from "./voice.js";

/** Lecture de la table en interpolation linéaire (la phase tourne dans [0, 1)). */
function tableAt(table: Float32Array, phase: number): number {
  const position = phase * table.length;
  const index = Math.floor(position);
  const frac = position - index;
  const premier = table[index % table.length] ?? 0;
  const suivant = table[(index + 1) % table.length] ?? 0;
  return premier + (suivant - premier) * frac;
}

export function createOscEngine(params: VoiceParams): Engine {
  const table = buildWaveTable(params.wave, params.second);
  const sampleRate = params.sampleRate;
  const detune = 2 ** (params.detuneCents / 1200);
  let phase = 0;
  let phaseDesaccordee = 0;
  let filtre = 0;

  return {
    next(ctx: EngineContext): number {
      const increment = ctx.freqHz / sampleRate;
      phase += increment;
      if (phase >= 1) phase -= Math.floor(phase);
      phaseDesaccordee += increment * detune;
      if (phaseDesaccordee >= 1) phaseDesaccordee -= Math.floor(phaseDesaccordee);
      const brut = 0.5 * (tableAt(table, phase) + tableAt(table, phaseDesaccordee));
      // Passe-bas à un pôle : gain 1 en continu, la coupure ne déplace pas la
      // fondamentale, elle n'enlève que le haut du spectre.
      const alpha = 1 - Math.exp((-2 * Math.PI * ctx.cutoffHz) / sampleRate);
      filtre += alpha * (brut - filtre);
      return filtre;
    },
    strike(): void {
      // Un oscillateur tenu n'a pas d'excitation : la note change par la hauteur.
    },
    finished: false,
  };
}
