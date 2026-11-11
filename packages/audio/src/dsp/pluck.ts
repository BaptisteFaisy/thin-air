/**
 * Moteur « pluck » — corde pincée, Karplus-Strong (cahier §7.9).
 *
 * Une ligne à retard bouclée dont la longueur fixe la note : 326,9 échantillons
 * pour le ré à 146,83 Hz à 48 kHz. Le retour dans la ligne passe par un filtre
 * moyenneur dont le mélange avec le signal brut est `brightness` : 1 = sombre,
 * 0 = brillant. Le gain de boucle est `decay` (0,996).
 *
 * La lecture est fractionnaire (interpolation linéaire) : la longueur change
 * avec la hauteur, donc une corde peut glisser sans casser la boucle.
 */
import { pluckExcitation } from "./engines.js";
import type { Engine, EngineContext } from "./engine.js";
import type { VoiceParams } from "./voice.js";

/** Capacité de la ligne : assez longue pour une note à 12 Hz à 48 kHz. */
const LIGNE_MAX = 4096;

export function createPluckEngine(params: VoiceParams): Engine {
  const sampleRate = params.sampleRate;
  const ligne = new Float32Array(LIGNE_MAX);
  let ecriture = 0;
  let precedent = 0;
  let excitation = false;
  let force = 1;
  let frappes = 0;

  return {
    strike(velocity: number): void {
      excitation = true;
      frappes += 1;
      force = Math.max(0, Math.min(1, velocity));
    },
    next(ctx: EngineContext): number {
      const longueur = Math.min(
        LIGNE_MAX - 3,
        Math.max(2, sampleRate / Math.max(1, ctx.freqHz)),
      );
      if (excitation) {
        excitation = false;
        precedent = 0;
        const bruit = pluckExcitation(Math.round(longueur), params.seed + frappes);
        for (let i = 0; i < bruit.length; i++) ligne[i] = (bruit[i] ?? 0) * force;
        ecriture = bruit.length % LIGNE_MAX;
      }
      const lecture = ecriture - longueur;
      const entier = Math.floor(lecture);
      const frac = lecture - entier;
      const premier = ((entier % LIGNE_MAX) + LIGNE_MAX) % LIGNE_MAX;
      const suivant = (premier + 1) % LIGNE_MAX;
      const brut = (ligne[premier] ?? 0) + ((ligne[suivant] ?? 0) - (ligne[premier] ?? 0)) * frac;
      const moyen = 0.5 * (brut + precedent);
      precedent = brut;
      const brillance = Math.max(0, Math.min(1, params.brightness));
      const sortie = brillance * moyen + (1 - brillance) * brut;
      ligne[ecriture] = sortie * params.decay;
      ecriture = (ecriture + 1) % LIGNE_MAX;
      return sortie;
    },
    finished: false,
  };
}
