import { describe, expect, it } from "vitest";
import { createReverb, generateImpulseResponse } from "./reverb.js";
import { applyCeiling, applyMasterGain, dbToLinear } from "./limiter.js";

const SR = 48_000;

/** Un impulse suivi de silence : la queue de la réverbération. */
function queue(amount: number, decayS = 0.9): Float32Array {
  const entree = new Float32Array(2 * SR);
  for (let i = 0; i < 200; i++) entree[i] = 1;
  const sortie = new Float32Array(2 * SR);
  createReverb({ sampleRate: SR, amount, decayS }).process(entree, sortie);
  return sortie;
}

describe("réverbération — réseau de retards à réinjection (cahier §7.9)", () => {
  it("amount = 0 est exactement sec", () => {
    const entree = new Float32Array(4000);
    for (let i = 0; i < entree.length; i++) entree[i] = Math.sin(i / 40);
    const sortie = new Float32Array(4000);
    createReverb({ sampleRate: SR, amount: 0 }).process(entree, sortie);
    expect(Array.from(sortie)).toEqual(Array.from(entree));
  });

  it("la queue s'éteint : plus rien au-dessus de −60 dB après la durée de decay", () => {
    const sortie = queue(0.6, 0.9);
    const seuil = dbToLinear(-60);
    let dernier = -1;
    for (let i = 0; i < sortie.length; i++) if (Math.abs(sortie[i] ?? 0) > seuil) dernier = i;
    const finQueueMs = (dernier / SR) * 1000;
    // L'entrée s'arrête à 4 ms ; la queue meurt autour de `decayS` = 900 ms.
    expect(finQueueMs).toBeGreaterThan(700);
    expect(finQueueMs).toBeLessThan(1200);
  });

  it("le même réseau donne les mêmes échantillons (AIR-N-09)", () => {
    expect(Array.from(queue(0.4))).toEqual(Array.from(queue(0.4)));
  });

  it("reset remet le réseau à zéro", () => {
    const reverb = createReverb({ sampleRate: SR, amount: 0.5 });
    const entree = new Float32Array(4000);
    for (let i = 0; i < 200; i++) entree[i] = 1;
    const sortie = new Float32Array(4000);
    reverb.process(entree, sortie);
    reverb.reset();
    const apres = new Float32Array(4000);
    reverb.process(new Float32Array(4000), apres);
    expect(Array.from(apres).every((valeur) => valeur === 0)).toBe(true);
  });

  it("la réponse impulsionnelle générée perd 60 dB en `decay`", () => {
    const reponse = generateImpulseResponse(SR, 1.5, 0.9, 3);
    expect(reponse).toHaveLength(1.5 * SR);
    const debut = Math.max(...Array.from(reponse.slice(0, 100)).map(Math.abs));
    const fin = Math.max(...Array.from(reponse.slice(0.9 * SR, 0.9 * SR + 200)).map(Math.abs));
    expect(20 * Math.log10(fin / debut)).toBeLessThan(-55);
    expect(20 * Math.log10(fin / debut)).toBeGreaterThan(-65);
  });
});

describe("plafond et gain général (cahier §7.9, AIR-F-28)", () => {
  it("applyCeiling tient la borne même sur un signal très fort", () => {
    const tampon = new Float32Array(4000);
    for (let i = 0; i < tampon.length; i++) tampon[i] = Math.sin(i / 20) * 12;
    applyCeiling(tampon, -1);
    const plafond = dbToLinear(-1);
    expect(Math.max(...Array.from(tampon).map(Math.abs))).toBeLessThanOrEqual(plafond + 1e-9);
  });

  it("applyCeiling ne touche pas à un signal déjà sous le plafond", () => {
    const tampon = new Float32Array(1000);
    for (let i = 0; i < tampon.length; i++) tampon[i] = Math.sin(i / 30) * 0.1;
    const avant = Array.from(tampon);
    applyCeiling(tampon, -1);
    for (let i = 0; i < tampon.length; i++) expect(tampon[i]).toBeCloseTo(avant[i]!, 9);
  });

  it("applyMasterGain applique −12 dB, soit un quart de l'amplitude", () => {
    const tampon = new Float32Array(10).fill(1);
    applyMasterGain(tampon, -12);
    expect(tampon[0]).toBeCloseTo(0.2512, 3);
    expect(dbToLinear(-12)).toBeCloseTo(0.2512, 3);
    expect(dbToLinear(-1)).toBeCloseTo(0.8913, 3);
  });

  it("un plafond à 0 dB éteint tout", () => {
    const tampon = new Float32Array(10).fill(0.5);
    applyCeiling(tampon, -Infinity);
    expect(Array.from(tampon).every((valeur) => valeur === 0)).toBe(true);
  });
});
