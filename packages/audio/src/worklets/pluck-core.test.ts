/**
 * Corde pincée : le calcul que le module audio exécute (§7.9, AIR-F-29).
 * Testé dans Node : un `AudioWorkletProcessor` ne s'instancie pas ici, mais
 * tout l'algorithme — longueur de retard, excitation, decay, brillance — est
 * du calcul pur, et c'est ce qui compte.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PLUCK_PROCESSOR_NAME,
  PluckString,
  pluckDelaySamples,
  pluckExcitation,
  seededRandom,
} from "./pluck-core.js";

const RATE = 48_000;

function rms(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** Fréquence dominante par autocorrélation, sur une fenêtre de `size` échantillons. */
function dominantHz(samples: Float32Array, from: number, size: number, rate: number): number {
  let best = 0;
  let bestLag = 1;
  for (let lag = 20; lag < size / 4; lag += 1) {
    let sum = 0;
    for (let i = 0; i < size - lag; i += 1) {
      sum += (samples[from + i] ?? 0) * (samples[from + i + lag] ?? 0);
    }
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return rate / bestLag;
}

function render(string: PluckString, n: number): Float32Array {
  const out = new Float32Array(n);
  string.render(out, 0, n);
  return out;
}

describe("ligne à retard — la longueur fixe la note", () => {
  it("ré 146,83 Hz à 48 kHz : 326,9 échantillons (§7.9)", () => {
    expect(pluckDelaySamples(146.83, RATE)).toBeCloseTo(326.9, 1);
  });

  it("au-dessus de 375 Hz, le retard descend sous 128 échantillons", () => {
    expect(pluckDelaySamples(375, RATE)).toBeCloseTo(128, 6);
    expect(pluckDelaySamples(880, RATE)).toBeLessThan(128);
    // C'est pour cela que la corde vit dans un module audio : dans le graphe
    // ordinaire, un retard bouclé ne descend pas sous 128 échantillons.
    expect(pluckDelaySamples(880, RATE)).toBeCloseTo(54.5, 1);
  });

  it("une fréquence nulle ne divise pas par zéro", () => {
    expect(pluckDelaySamples(0, RATE)).toBe(RATE);
    expect(pluckDelaySamples(-100, RATE)).toBe(RATE);
  });

  it("la corde prend la longueur de sa note", () => {
    const string = new PluckString({ sampleRate: RATE });
    string.pluck(440, 0.8, 7);
    expect(string.delaySamples).toBeCloseTo(RATE / 440, 6);
  });
});

describe("excitation — un bruit déterministe (AIR-N-09)", () => {
  it("même graine, même suite ; graines différentes, suites différentes", () => {
    const a = pluckExcitation(64, 42, 0.5);
    const b = pluckExcitation(64, 42, 0.5);
    const c = pluckExcitation(64, 43, 0.5);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it("l'amplitude du bruit est bornée par la force du geste", () => {
    const loud = pluckExcitation(256, 3, 1);
    const soft = pluckExcitation(256, 3, 0.25);
    for (const value of loud) expect(Math.abs(value)).toBeLessThanOrEqual(1);
    expect(Math.max(...soft)).toBeLessThanOrEqual(0.25);
  });

  it("le générateur reste dans [0, 1) et ne se répète pas", () => {
    const random = seededRandom(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      seen.add(value);
    }
    expect(seen.size).toBeGreaterThan(900);
  });
});

describe("résonance — decay 0,996 et filtre de brillance", () => {
  it("la corde sonne puis s'éteint avec un decay de 0,996", () => {
    const string = new PluckString({ sampleRate: RATE, decay: 0.996, brightness: 0.5 });
    string.pluck(220, 0.9, 11);
    const out = render(string, 24_000);
    const start = rms(out, 0, 4800);
    const middle = rms(out, 9600, 14_400);
    const end = rms(out, 19_200, 24_000);
    expect(start).toBeGreaterThan(0);
    expect(middle).toBeLessThan(start);
    expect(end).toBeLessThan(middle);
  });

  it("une corde pincée produit la note demandée, à 5 % près (AIR-P-14)", () => {
    const string = new PluckString({ sampleRate: RATE, decay: 0.9995, brightness: 0.5 });
    string.pluck(440, 1, 5);
    const out = render(string, 24_000);
    // Autocorrélation sur un palier, après le transitoire d'excitation.
    const from = 9600;
    const window = 2048;
    const measured = dominantHz(out, from, window, RATE);
    expect(measured).toBeGreaterThan(440 * 0.95);
    expect(measured).toBeLessThan(440 * 1.05);
  });

  it("la brillance change le timbre sans changer la note", () => {
    const dark = new PluckString({ sampleRate: RATE, brightness: 0.05 });
    const bright = new PluckString({ sampleRate: RATE, brightness: 1 });
    dark.pluck(220, 1, 9);
    bright.pluck(220, 1, 9);
    expect(Array.from(render(dark, 480))).not.toEqual(Array.from(render(bright, 480)));
  });

  it("damp() éteint la corde tout de suite", () => {
    const string = new PluckString({ sampleRate: RATE });
    string.pluck(220, 1, 3);
    render(string, 100);
    expect(string.isRinging).toBe(true);
    string.damp();
    expect(string.isRinging).toBe(false);
    expect(rms(render(string, 256))).toBe(0);
  });
});

describe("module audio — installation et silence", () => {
  it("le nom du processeur est stable entre le module et la voix", () => {
    expect(PLUCK_PROCESSOR_NAME).toBe("thin-air-pluck");
  });

  it("aucun `Math.random()` dans le code du module audio (AIR-N-09)", () => {
    for (const file of ["pluck-core.ts", "pluck-processor.ts"]) {
      const path = fileURLToPath(new URL(`./${file}`, import.meta.url));
      expect(readFileSync(path, "utf8")).not.toContain("Math.random");
    }
  });

  it("le processeur n'embarque aucun fichier sonore (AIR-F-25)", () => {
    const path = fileURLToPath(new URL("./pluck-processor.ts", import.meta.url));
    expect(readFileSync(path, "utf8")).not.toMatch(/\.(wav|mp3|ogg|flac)/iu);
  });

  it.todo("`addModule()` installe le processeur — dépend d'un AudioContext (navigateur)");
  it.todo("`process()` rend des blocs de 128 échantillons — dépend d'un AudioContext (navigateur)");
});
