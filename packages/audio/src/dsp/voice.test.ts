import { describe, expect, it } from "vitest";
import { createVoice, defaultVoiceParams, strikeVoice } from "./voice.js";
import { midiToHz } from "./tuning.js";

const SR = 48_000;

function voix(options: Partial<ReturnType<typeof defaultVoiceParams>> = {}) {
  const params = { ...defaultVoiceParams("osc", SR), midi: 69, ...options };
  return createVoice("v", params);
}

/** Fréquence approximative par comptage des passages par zéro. */
function frequenceParPassages(tampon: Float32Array, sampleRate: number, from = 0, to = tampon.length): number {
  let passages = 0;
  for (let i = Math.max(1, from); i < to; i++) {
    if ((tampon[i - 1] ?? 0) >= 0 !== (tampon[i] ?? 0) >= 0) passages++;
  }
  const duree = (to - from) / sampleRate;
  return passages / 2 / duree;
}

describe("voix — enveloppe, glissement et réglages datés (cahier §7.9)", () => {
  it("une voix tenue rend une sinusoïde à la bonne fréquence", () => {
    const v = voix();
    const tampon = new Float32Array(SR);
    v.render(tampon, 0, tampon.length);
    const mesure = frequenceParPassages(tampon, SR, 0.1 * SR, 0.9 * SR);
    expect(Math.abs(1200 * Math.log2(mesure / 440))).toBeLessThan(5);
  });

  it("le relâchement éteint la voix : `done` au bout de l'extinction", () => {
    const v = voix({ releaseS: 0.1 });
    const tampon = new Float32Array(SR);
    v.render(tampon, 0, 0.1 * SR);
    expect(v.done).toBe(false);
    v.noteOff(0.1 * SR);
    v.render(tampon, 0.1 * SR, SR);
    expect(v.done).toBe(true);
    expect(v.peak).toBeGreaterThan(0);
    // Après l'extinction, plus rien n'est ajouté au tampon.
    const apres = tampon.slice(0.3 * SR, 0.4 * SR);
    expect(Array.from(apres).every((valeur) => valeur === 0)).toBe(true);
  });

  it("une voix relâchée avant de commencer ne rend rien", () => {
    const v = voix();
    const tampon = new Float32Array(1000);
    v.noteOff(0);
    v.render(tampon, 0, tampon.length);
    expect(Array.from(tampon).every((valeur) => valeur === 0)).toBe(true);
  });

  it("le réglage daté n'agit qu'à son instant", () => {
    const v = voix({ attackS: 0.001, releaseS: 0.05 });
    const tampon = new Float32Array(SR);
    v.setParam("gain", 0, 0.5 * SR);
    v.render(tampon, 0, tampon.length);
    const avant = Math.max(...Array.from(tampon.slice(0, 1000)).map(Math.abs));
    const apres = Math.max(...Array.from(tampon.slice(0.6 * SR, 0.7 * SR)).map(Math.abs));
    expect(avant).toBeGreaterThan(0);
    expect(apres).toBeLessThan(avant / 4);
  });

  it("deux voix identiques rendent les mêmes échantillons (AIR-N-09)", () => {
    const rendre = (): Float32Array => {
      const v = voix();
      const tampon = new Float32Array(4096);
      v.setParam("pitch", 64, 1000);
      v.render(tampon, 0, tampon.length);
      return tampon;
    };
    expect(Array.from(rendre())).toEqual(Array.from(rendre()));
  });

  it("le glissement part de la hauteur en cours, pas d'un saut", () => {
    const v = voix({ glideS: 0.03 });
    const tampon = new Float32Array(SR);
    v.render(tampon, 0, 0.1 * SR);
    v.setParam("pitch", 81, 0.1 * SR);
    v.render(tampon, 0.1 * SR, SR);
    // 5 ms après l'événement, la hauteur n'a pas encore sauté à 880 Hz.
    const justeApres = frequenceParPassages(tampon, SR, 0.1 * SR, 0.105 * SR);
    expect(justeApres).toBeLessThan(600);
    // Plus tard, la cible est atteinte.
    const apres = frequenceParPassages(tampon, SR, 0.3 * SR, 0.5 * SR);
    expect(Math.abs(apres - 880)).toBeLessThan(60);
  });

  it("une nouvelle frappe rejoue l'excitation (corde rejouée)", () => {
    const v = createVoice("v", { ...defaultVoiceParams("pluck", SR), midi: 50 });
    const tampon = new Float32Array(SR);
    v.render(tampon, 0, 0.1 * SR);
    const premier = Math.max(...Array.from(tampon.slice(0, 0.05 * SR)).map(Math.abs));
    strikeVoice(v, 1, Math.round(0.2 * SR));
    v.render(tampon, Math.round(0.2 * SR), Math.round(0.3 * SR));
    const second = Math.max(...Array.from(tampon.slice(0.2 * SR, 0.25 * SR)).map(Math.abs));
    expect(premier).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
  });

  it("les défauts par moteur sont cohérents", () => {
    expect(defaultVoiceParams("osc", SR).sampleRate).toBe(SR);
    expect(defaultVoiceParams("pluck", SR).decay).toBe(0.996);
    expect(defaultVoiceParams("fm", SR).fmRatio).toBeGreaterThan(0);
    expect(defaultVoiceParams("drum", SR).noiseMs).toBeGreaterThan(0);
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBe(880);
  });
});
