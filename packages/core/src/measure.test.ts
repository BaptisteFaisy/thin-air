import { describe, expect, it } from "vitest";
import {
  attackTimes,
  buildReport,
  dominantFreq,
  finalSilenceMs,
  freqEnvelope,
  measureNotes,
  peakDb,
  rmsDb,
} from "./measure.js";

const SR = 48_000;

function sine(freq: number, dureeS: number, amplitude = 1, debutS = 0): Float32Array {
  const n = Math.round(dureeS * SR);
  const debut = Math.round(debutS * SR);
  const tampon = new Float32Array(n);
  for (let i = debut; i < n; i++) {
    tampon[i] = amplitude * Math.sin((2 * Math.PI * freq * (i - debut)) / SR);
  }
  return tampon;
}

describe("mesures — niveaux (cahier §13)", () => {
  it("peakDb : 0 dB = pleine échelle 1,0", () => {
    expect(peakDb([1, -1, 0.5])).toBe(0);
    expect(peakDb([0.5, -0.5])).toBeCloseTo(-6.02, 2);
    expect(peakDb([0, 0, 0])).toBe(-Infinity);
  });

  it("rmsDb : une sinusoïde à pleine échelle vaut −3,01 dB", () => {
    expect(rmsDb(sine(440, 0.1))).toBeCloseTo(-3.01, 1);
    expect(rmsDb([0.5, -0.5, 0.5, -0.5])).toBeCloseTo(-6.02, 2);
    expect(rmsDb([])).toBe(-Infinity);
  });

  it("finalSilenceMs : le dernier instant au-dessus du seuil", () => {
    const tampon = sine(440, 1, 1);
    // Une seconde pleine : aucun silence final.
    expect(finalSilenceMs(tampon, SR, -60)).toBeLessThan(5);
    const avecQueue = sine(440, 1, 1);
    avecQueue.fill(0, Math.round(0.5 * SR));
    expect(finalSilenceMs(avecQueue, SR, -60)).toBeCloseTo(500, 0);
    expect(finalSilenceMs(new Float32Array(SR), SR, -60)).toBeCloseTo(1000, 0);
  });

  it("attackTimes : une attaque par note, au seuil relatif", () => {
    const tampon = sine(440, 1, 1);
    const attaques = attackTimes(tampon, SR, -20);
    expect(attaques).toHaveLength(1);
    expect(attaques[0]).toBeLessThan(0.02);
    expect(attackTimes(new Float32Array(SR), SR)).toEqual([]);
  });
});

describe("mesures — fréquence dominante (autocorrélation + interpolation parabolique)", () => {
  it("une sinusoïde pure est mesurée au centième de centième près", () => {
    for (const freq of [110, 146.83, 220, 440, 880]) {
      const mesure = dominantFreq(sine(freq, 0.1), SR, 0, 0.1 * SR);
      const cents = 1200 * Math.log2(mesure / freq);
      expect(Math.abs(cents)).toBeLessThan(0.1);
    }
  });

  it("l'harmonique 2 ne déplace pas la mesure", () => {
    const tampon = new Float32Array(0.1 * SR);
    for (let i = 0; i < tampon.length; i++) {
      tampon[i] =
        (Math.sin((2 * Math.PI * 440 * i) / SR) + 0.15 * Math.sin((4 * Math.PI * 440 * i) / SR)) / 1.15;
    }
    expect(Math.abs(1200 * Math.log2(dominantFreq(tampon, SR, 0, tampon.length) / 440))).toBeLessThan(0.5);
  });

  it("le silence et une fenêtre trop courte rendent 0", () => {
    expect(dominantFreq(new Float32Array(SR), SR, 0, SR)).toBe(0);
    expect(dominantFreq(sine(440, 0.01), SR, 0, 8)).toBe(0);
  });

  it("freqEnvelope découpe en fenêtres de 10 ms", () => {
    const courbe = freqEnvelope(sine(440, 0.2), { sampleRate: SR, windowS: 0.01 });
    expect(courbe).toHaveLength(20);
    expect(courbe[0]?.t).toBe(0);
    expect(courbe[1]?.t).toBeCloseTo(0.01, 6);
    for (const point of courbe) expect(Math.abs(point.hz - 440)).toBeLessThan(2);
  });

  it("measureNotes rend l'écart en centièmes pour chaque note attendue", () => {
    const tampon = sine(440, 0.6);
    const notes = measureNotes(tampon, [{ t: 0, midi: 69, untilT: 0.6 }], { sampleRate: SR });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.expectedHz).toBe(440);
    expect(Math.abs(notes[0]?.cents ?? 99)).toBeLessThan(0.5);
    // Une note attendue ailleurs donne un écart en centièmes, pas une erreur.
    const faux = measureNotes(tampon, [{ t: 0, midi: 70, untilT: 0.6 }], { sampleRate: SR });
    expect(faux[0]?.cents).toBeCloseTo(-100, 0);
  });
});

describe("mesures — rapport de rendu (annexe B)", () => {
  it("buildReport a la forme du rapport écrit par `bench render`", () => {
    const tampon = sine(440, 1);
    const notes = measureNotes(tampon, [{ t: 0, midi: 69, untilT: 1 }], { sampleRate: SR });
    const rapport = buildReport({
      take: "slow-rise",
      instrument: "Phantom",
      samples: tampon,
      sampleRate: SR,
      notes,
      maxVoices: 1,
    });
    expect(rapport.take).toBe("slow-rise");
    expect(rapport.instrument).toBe("Phantom");
    expect(rapport.sampleRate).toBe(SR);
    expect(rapport.samples).toBe(SR);
    expect(rapport.durationS).toBe(1);
    expect(rapport.maxVoices).toBe(1);
    expect(rapport.peakDb).toBeCloseTo(0, 1);
    expect(rapport.rmsDb).toBeCloseTo(-3.01, 1);
    expect(rapport.silenceAfterMs).toBeLessThan(5);
    expect(rapport.notes).toHaveLength(1);
    expect(Object.keys(rapport).sort()).toEqual([
      "durationS",
      "instrument",
      "maxVoices",
      "notes",
      "peakDb",
      "rmsDb",
      "sampleRate",
      "samples",
      "silenceAfterMs",
      "take",
    ]);
  });
});
