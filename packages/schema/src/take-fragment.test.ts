/**
 * Round-trips of the take share link (cahier §7.11, AIR-F-45, AIR-F-47,
 * AIR-F-48). The payload reuses the 16-bit binary coding of `take-codec.ts`,
 * so the tests assert what the coding guarantees: the points survive at the
 * coding step, a flipped byte or a truncated fragment is refused in whole,
 * and the two fragment families (instrument vs take) never cross.
 */

import { describe, expect, it } from "vitest";
import type { HandPoint, Instrument, Take } from "@thin-air/core";
import {
  crossingHandsTake,
  handLeavesTake,
  leftHandOnlyTake,
  linearTake,
  tremorTake,
  withDroppedFrames,
} from "@thin-air/core";
import {
  CODING_STEP_SCORE,
  CODING_STEP_XY,
  CODING_STEP_Z,
  INSTRUMENT_FORMAT,
  instrumentFromFragment,
  instrumentToFragment,
} from "./index.js";
import {
  takeFromFragment,
  takeFromFragmentAsync,
  takeToFragment,
  takeToFragmentAsync,
} from "./take-fragment.js";
import { fromBase64Url, toBase64Url } from "./common.js";

/* ------------------------------------------------------------------ */
/* Les prises qui nourrissent les aller-retours.                        */
/* ------------------------------------------------------------------ */

/** Une main seule, 1 s. */
function uneMain(): Take {
  return linearTake({ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.6 }, { durationS: 1 });
}

/** Deux mains qui se croisent, 5 s. */
function deuxMains(secondes = 5): Take {
  return crossingHandsTake({ durationS: secondes });
}

/** Une main qui tremble, graine fixe : déterministe (AIR-N-09). */
function tremble(): Take {
  return tremorTake({ x: 0.5, y: 0.5 }, 0.02, { seed: 42, durationS: 2 });
}

/** Images manquantes : main qui sort, puis une image retirée sur sept. */
function imagesManquantes(): Take {
  return withDroppedFrames(
    handLeavesTake({ x: 0.5, y: 0.5 }, 1.5, { durationS: 3 }),
    7,
  );
}

const PRISES: readonly Take[] = [uneMain(), deuxMains(), tremble(), imagesManquantes(), leftHandOnlyTake({ durationS: 1 })];

/* ------------------------------------------------------------------ */
/* Comparaison : les points survivent au pas de codage près.            */
/* ------------------------------------------------------------------ */

function pointProche(a: HandPoint, b: HandPoint): boolean {
  const pas = [CODING_STEP_XY, CODING_STEP_XY, CODING_STEP_Z] as const;
  return a.every((valeur, i) => Math.abs(valeur - (b[i] ?? 0)) <= (pas[i] ?? 0));
}

function memePrise(source: Take, relue: Take): void {
  expect(relue.format).toBe(source.format);
  expect(relue.fps).toBe(source.fps);
  expect(relue.frames.length).toBe(source.frames.length);
  source.frames.forEach((image, i) => {
    const autre = relue.frames[i];
    if (autre === undefined) return;
    expect(autre.t).toBe(image.t);
    expect(autre.hands.length).toBe(image.hands.length);
    image.hands.forEach((main, h) => {
      const reluie = autre.hands[h];
      if (reluie === undefined) return;
      expect(reluie.side).toBe(main.side);
      expect(Math.abs(reluie.score - main.score)).toBeLessThanOrEqual(CODING_STEP_SCORE);
      main.points.forEach((point, p) => {
        const relu = reluie.points[p];
        if (relu === undefined) return;
        expect(pointProche(point, relu)).toBe(true);
      });
    });
  });
}

/** Un fragment est du base64url pur, sans caractère à échapper. */
function estBase64Url(fragment: string): boolean {
  expect(fragment).not.toContain("#");
  expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
  return true;
}

/* ------------------------------------------------------------------ */
/* Aller-retour.                                                       */
/* ------------------------------------------------------------------ */

describe("AIR-F-47 / AIR-F-48 — le lien de partage d'une prise conserve les points", () => {
  it("aller-retour synchrone sur des prises générées, une et deux mains, images manquantes", () => {
    for (const prise of PRISES) {
      const fragment = takeToFragment(prise);
      estBase64Url(fragment);
      const relue = takeFromFragment(fragment);
      expect(relue.ok).toBe(true);
      if (!relue.ok) return;
      memePrise(prise, relue.value);
    }
  });

  it("aller-retour asynchrone, et le lecteur synchrone refuse un fragment compressé", async () => {
    for (const prise of PRISES) {
      const fragment = await takeToFragmentAsync(prise);
      estBase64Url(fragment);
      const octets = fromBase64Url(fragment);
      expect(octets).not.toBeNull();
      if (octets === null) return;
      if (octets[0] === 3) {
        // CompressionStream est là : le fragment est « deflate-raw », lisible
        // seulement par le lecteur asynchrone.
        const sync = takeFromFragment(fragment);
        expect(sync.ok).toBe(false);
        if (!sync.ok) expect(sync.reasons.join(" ")).toContain("takeFromFragmentAsync");
      } else {
        // Repli brut : le lecteur asynchrone accepte aussi le brut.
        expect(fragment).toBe(takeToFragment(prise));
      }
      const relue = await takeFromFragmentAsync(fragment);
      expect(relue.ok).toBe(true);
      if (!relue.ok) return;
      memePrise(prise, relue.value);
    }
  });
});

describe("AIR-P-20 — un fragment altéré ou tronqué est refusé en entier", () => {
  it("un octet retourné change la somme de contrôle et refuse la prise", () => {
    const fragment = takeToFragment(deuxMains(1));
    const octets = fromBase64Url(fragment);
    expect(octets).not.toBeNull();
    if (octets === null) return;
    const altere = Uint8Array.from(octets);
    const dernier = altere.length - 1;
    altere[dernier] = (altere[dernier] ?? 0) ^ 0x01;
    const resultat = takeFromFragment(toBase64Url(altere));
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.reasons.join(" ")).toContain("checksum");
  });

  it("un fragment tronqué est refusé, en base64url comme en binaire", () => {
    const fragment = takeToFragment(deuxMains(1));
    const coupe = fragment.slice(0, Math.floor(fragment.length / 4) * 4);
    const tronque = takeFromFragment(coupe);
    expect(tronque.ok).toBe(false);
    if (tronque.ok) return;
    expect(tronque.reasons.length).toBeGreaterThan(0);

    const invalide = takeFromFragment(fragment.slice(0, 1));
    expect(invalide.ok).toBe(false);
    if (!invalide.ok) expect(invalide.reasons.join(" ")).toContain("base64url");
  });
});

describe("AIR-F-45 — un fragment d'instrument n'est jamais une prise, et réciproquement", () => {
  const instrumentMinimal: Instrument = {
    format: INSTRUMENT_FORMAT,
    name: "Sonde",
    pointer: "index",
    scale: { root: 60, steps: [0, 2, 4, 7] },
    range: { low: 48, high: 84 },
    snap: 0.5,
    voices: 4,
    sound: { engine: "osc" },
  };

  it("un fragment d'instrument est refusé comme prise, avec la raison", () => {
    const fragment = instrumentToFragment(instrumentMinimal);
    const lu = takeFromFragment(fragment);
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.reasons.join(" ")).toContain("instrument");
  });

  it("un fragment d'instrument est aussi refusé par le lecteur asynchrone", async () => {
    const fragment = instrumentToFragment(instrumentMinimal);
    const lu = await takeFromFragmentAsync(fragment);
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.reasons.join(" ")).toContain("instrument");
  });

  it("un fragment de prise est refusé comme instrument", () => {
    const fragment = takeToFragment(deuxMains(1));
    const lu = instrumentFromFragment(fragment);
    expect(lu.ok).toBe(false);
    if (lu.ok) return;
    expect(lu.reasons.length).toBeGreaterThan(0);
  });
});

describe("le fragment tient dans une adresse — trois durées mesurées", () => {
  /**
   * Deux mains à 30 images par seconde (cadence par défaut du générateur) :
   * 267 octets par image — 8 d'instant, 1 de nombre de mains, puis 2 × 129 par
   * main — plus 24 d'en-tête et 1 de marqueur. Le codage de 16 bits rend
   * chaque image toujours multiple de 3 octets, donc le base64url est
   * un caractère de plus à chaque fois :
   *   1 s  → 31 images  →  8 302 octets → 11 070 caractères
   *   5 s  → 151 images → 40 342 octets → 53 790 caractères
   *  30 s  → 901 images → 240 592 octets → 320 790 caractères
   * Limite pratique retenue : 65 536 caractères (cf. docs/partage-prise.md).
   */
  const LIMITE_URL = 65_536;

  function mesure(secondes: number, images: number, longueur: number): void {
    const prise = deuxMains(secondes);
    expect(prise.frames.length).toBe(images);
    expect(takeToFragment(prise)).toHaveLength(longueur);
  }

  it("1 s, 5 s et 30 s pèsent exactement ces nombres", () => {
    mesure(1, 31, 11_070);
    mesure(5, 151, 53_790);
    mesure(30, 901, 320_790);
  });

  it("1 s et 5 s tiennent dans la limite, 30 s ne tient pas", () => {
    expect(takeToFragment(deuxMains(1)).length).toBeLessThanOrEqual(LIMITE_URL);
    expect(takeToFragment(deuxMains(5)).length).toBeLessThanOrEqual(LIMITE_URL);
    expect(takeToFragment(deuxMains(30)).length).toBeGreaterThan(LIMITE_URL);
  });
});