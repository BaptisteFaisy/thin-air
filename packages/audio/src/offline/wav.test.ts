import { describe, expect, it } from "vitest";
import { decodeWav, encodeWav } from "./wav.js";

const SR = 48_000;

function signal(n: number): Float32Array {
  const tampon = new Float32Array(n);
  for (let i = 0; i < n; i++) tampon[i] = Math.sin((2 * Math.PI * 440 * i) / SR) * 0.5;
  return tampon;
}

describe("WAV — PCM 16 bits mono (cahier §11.6, AIR-F-38)", () => {
  it("l'en-tête RIFF est correct", () => {
    const wav = encodeWav(signal(1000), SR);
    const texte = (debut: number, longueur: number): string =>
      Array.from(wav.slice(debut, debut + longueur))
        .map((octet) => String.fromCharCode(octet))
        .join("");
    const vue = new DataView(wav.buffer);
    expect(texte(0, 4)).toBe("RIFF");
    expect(texte(8, 4)).toBe("WAVE");
    expect(texte(12, 4)).toBe("fmt ");
    expect(texte(36, 4)).toBe("data");
    expect(vue.getUint32(4, true)).toBe(wav.length - 8);
    expect(vue.getUint16(20, true)).toBe(1); // PCM
    expect(vue.getUint16(22, true)).toBe(1); // mono
    expect(vue.getUint32(24, true)).toBe(SR);
    expect(vue.getUint32(28, true)).toBe(SR * 2); // débit d'octets
    expect(vue.getUint16(34, true)).toBe(16); // bits
    expect(vue.getUint32(40, true)).toBe(2000); // taille des données
    expect(wav).toHaveLength(44 + 2000);
  });

  it("l'aller-retour conserve les échantillons au pas de codage près", () => {
    const original = signal(4800);
    const wav = encodeWav(original, SR);
    const { samples, sampleRate } = decodeWav(wav);
    expect(sampleRate).toBe(SR);
    expect(samples).toHaveLength(original.length);
    let ecart = 0;
    for (let i = 0; i < original.length; i++) {
      ecart = Math.max(ecart, Math.abs((samples[i] ?? 0) - (original[i] ?? 0)));
    }
    expect(ecart).toBeLessThanOrEqual(1 / 32767);
  });

  it("les extrêmes sont bornés et conservés", () => {
    const wav = encodeWav([1, -1, 0, 0.5, -0.5, 2, -2], SR);
    const { samples } = decodeWav(wav);
    expect(samples[0]).toBeCloseTo(1, 4);
    expect(samples[1]).toBeCloseTo(-1, 4);
    expect(samples[2]).toBe(0);
    expect(samples[5]).toBeCloseTo(1, 4); // écrêté à la pleine échelle
    expect(samples[6]).toBeCloseTo(-1, 4);
  });

  it("un tableau ordinaire est accepté en entrée", () => {
    const wav = encodeWav([0, 0.25, -0.25], SR);
    expect(wav).toHaveLength(44 + 6);
    expect(decodeWav(wav).samples[1]).toBeCloseTo(0.25, 4);
  });

  it("un fichier qui n'est pas du RIFF est refusé", () => {
    expect(() => decodeWav(new Uint8Array(64))).toThrow(/RIFF/);
  });

  it("un rendu entier survit à l'aller-retour", () => {
    const original = signal(SR);
    const { samples } = decodeWav(encodeWav(original, SR));
    expect(samples).toHaveLength(SR);
    let energie = 0;
    for (let i = 0; i < samples.length; i++) energie += (samples[i] ?? 0) ** 2;
    expect(Math.sqrt(energie / samples.length)).toBeGreaterThan(0.3);
  });
});
