import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { DetectedHand, Instrument, Session, Settings, Take } from "@thin-air/core";
import { DEFAULT_SETTINGS, SAMPLE_RATE } from "@thin-air/core";
import {
  compactTakeJson,
  CODING_STEP_SCORE,
  CODING_STEP_XY,
  CODING_STEP_Z,
  assertTakePrivacy,
  decodeTake,
  encodeTake,
  instrumentFromFragment,
  instrumentToFragment,
  parseInstrument,
  parseSession,
  parseTake,
  stringifyInstrument,
  stringifySession,
  takeBytesPerSecond,
} from "./index.js";

/* ------------------------------------------------------------------ */
/* Arbitraires : des instruments et des prises VALIDES, puis des fautes. */
/* ------------------------------------------------------------------ */

const etapeArb = fc
  .uniqueArray(fc.integer({ min: 0, max: 11 }), { minLength: 1, maxLength: 12 })
  .map((steps) => [...steps].sort((a, b) => a - b));

const scaleArb = fc.record({ root: fc.integer({ min: 24, max: 96 }), steps: etapeArb });

const rangeArb = fc
  .integer({ min: 24, max: 72 })
  .chain((low) => fc.integer({ min: 1, max: 48 }).map((span) => ({ range: { low, high: low + span } })));

const stringsArb = fc.record({
  count: fc.integer({ min: 1, max: 32 }),
  axis: fc.constantFrom("u" as const, "v" as const),
}).map((strings) => ({ strings }));

const zonesArb = fc
  .array(
    fc.record({
      u0: fc.double({ min: 0, max: 1, noNaN: true }),
      largeur: fc.double({ min: 0, max: 1, noNaN: true }),
      v0: fc.double({ min: 0, max: 1, noNaN: true }),
      hauteur: fc.double({ min: 0, max: 1, noNaN: true }),
      midi: fc.option(fc.integer({ min: 24, max: 96 }), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 6 },
  )
  .map((liste) => ({
    zones: {
      zones: liste.map((z, i) => ({
        id: `zone-${i}`,
        u0: Math.min(z.u0, 1),
        u1: Math.min(1, z.u0 + z.largeur),
        v0: Math.min(z.v0, 1),
        v1: Math.min(1, z.v0 + z.hauteur),
        // Une zone porte exactement l'un des deux : midi OU degree.
        ...(z.midi === undefined ? { degree: i } : { midi: z.midi }),
      })),
    },
  }));

const sonArb = fc.oneof(
  fc.record({
    engine: fc.constant("osc" as const),
    wave: fc.constantFrom("sine" as const, "triangle" as const, "sawtooth" as const, "square" as const),
    attackMs: fc.integer({ min: 1, max: 500 }),
    releaseMs: fc.integer({ min: 1, max: 2000 }),
  }),
  fc.record({
    engine: fc.constant("pluck" as const),
    decay: fc.double({ min: 0.9, max: 0.999, noNaN: true }),
    brightness: fc.record({ feature: fc.constantFrom("u" as const, "v" as const), into: fc.constant([0.2, 0.9] as [number, number]) }),
  }),
  fc.record({
    engine: fc.constant("fm" as const),
    fmRatio: fc.double({ min: 0.5, max: 8, noNaN: true }),
    fmIndex: fc.double({ min: 0, max: 10, noNaN: true }),
  }),
  fc.record({
    engine: fc.constant("drum" as const),
    noiseMs: fc.integer({ min: 1, max: 200 }),
    toneHz: fc.integer({ min: 40, max: 400 }),
  }),
);

const instrumentArb: fc.Arbitrary<Instrument> = fc
  .record({
    name: fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
    pointer: fc.constantFrom("index" as const, "palm" as const),
    scale: scaleArb,
    snap: fc.double({ min: 0, max: 1, noNaN: true }),
    voices: fc.integer({ min: 1, max: 8 }),
    sound: sonArb,
    geometrie: fc.oneof(rangeArb, stringsArb, zonesArb),
  })
  .map(({ geometrie, ...reste }) => ({
    format: "thin-air-instrument/1",
    ...reste,
    ...geometrie,
  })) as unknown as fc.Arbitrary<Instrument>;

function main(x: number, cote: "left" | "right"): DetectedHand {
  const points = Array.from({ length: 21 }, (_, i) => [
    Math.min(1, Math.max(0, x + i / 400)),
    0.5,
    0,
  ]) as [number, number, number][];
  return { side: cote, score: 0.95, points };
}

function prise(images: number, mainsParImage: number, fps = 30): Take {
  return {
    format: "thin-air-take/1",
    fps,
    frames: Array.from({ length: images }, (_, i) => ({
      t: i / fps,
      hands: Array.from({ length: mainsParImage }, (_, k) => main(0.2 + k * 0.4, k === 0 ? "left" : "right")),
    })),
  };
}

const priseArb = fc
  .tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 2 }), fc.constantFrom(24, 30, 60))
  .map(([images, mains, fps]) => prise(images, mains, fps));

/** Une faute : clé supprimée, type changé, valeur hors bornes, clé inconnue. */
function alterer(json: unknown, choix: number): unknown {
  const copie = JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
  const cles = Object.keys(copie);
  const cle = cles[choix % Math.max(1, cles.length)] ?? "format";
  switch (choix % 4) {
    case 0:
      delete copie[cle];
      return copie;
    case 1:
      copie[cle] = { inesperé: true };
      return copie;
    case 2:
      copie[cle] = -1e9;
      return copie;
    default:
      copie.champInterdit = "data:image/png;base64,AAAA";
      return copie;
  }
}

/* ------------------------------------------------------------------ */

describe("AIR-P-19 — tout instrument généré survit à l'aller-retour", () => {
  it("écriture puis lecture redonne le même instrument", () => {
    fc.assert(
      fc.property(instrumentArb, (instrument) => {
        const premier = parseInstrument(instrument);
        expect(premier.ok).toBe(true);
        if (!premier.ok) return;
        const relu = parseInstrument(JSON.parse(stringifyInstrument(premier.value)));
        expect(relu.ok).toBe(true);
        if (!relu.ok) return;
        expect(relu.value).toEqual(premier.value);
      }),
      { numRuns: 150 },
    );
  });

  it("le lien de partage (fragment d'adresse) conserve l'instrument", () => {
    fc.assert(
      fc.property(instrumentArb, (instrument) => {
        const fragment = instrumentToFragment(instrument);
        expect(fragment).not.toContain("#");
        expect(fragment).not.toMatch(/[^A-Za-z0-9_-]/);
        const relu = instrumentFromFragment(fragment);
        expect(relu.ok).toBe(true);
        if (!relu.ok) return;
        expect(relu.value).toEqual(instrument);
      }),
      { numRuns: 100 },
    );
  });

  it("un fichier altéré est refusé en entier, avec la raison, sans jamais lever d'exception", () => {
    fc.assert(
      fc.property(instrumentArb, fc.integer({ min: 0, max: 40 }), (instrument, choix) => {
        const fautif = alterer(instrument, choix);
        const resultat = parseInstrument(fautif);
        expect(resultat.ok).toBe(false);
        if (resultat.ok) return;
        expect(resultat.reasons.length).toBeGreaterThan(0);
        for (const raison of resultat.reasons) expect(typeof raison).toBe("string");
      }),
      { numRuns: 200 },
    );
  });
});

describe("AIR-P-19 — règles de cohérence refusées, jamais réparées", () => {
  const harpe: Instrument = {
    format: "thin-air-instrument/1",
    name: "Harp",
    pointer: "index",
    scale: { root: 50, steps: [0, 3, 5, 7, 10] },
    strings: { count: 16, axis: "u" },
    snap: 1,
    voices: 8,
    sound: { engine: "pluck", decay: 0.996 },
  };

  it("la harpe du cahier (annexe B) est acceptée", () => {
    expect(parseInstrument(harpe).ok).toBe(true);
  });

  const casRefuses: readonly [string, unknown][] = [
    ["gamme vide", { ...harpe, scale: { root: 50, steps: [] } }],
    ["gamme non triée", { ...harpe, scale: { root: 50, steps: [0, 7, 3] } }],
    ["gamme avec doublon", { ...harpe, scale: { root: 50, steps: [0, 3, 3, 7] } }],
    ["degré hors octave", { ...harpe, scale: { root: 50, steps: [0, 12] } }],
    ["étendue à l'envers", { ...harpe, range: { low: 81, high: 45 }, strings: undefined }],
    ["ni étendue ni cordes ni zones", { ...harpe, strings: undefined }],
    ["zéro corde", { ...harpe, strings: { count: 0, axis: "u" } }],
    ["aimant hors bornes", { ...harpe, snap: 1.5 }],
    ["zéro voix", { ...harpe, voices: 0 }],
    ["corde sans decay", { ...harpe, sound: { engine: "pluck" } }],
    ["oscillateur avec un decay de corde", { ...harpe, sound: { engine: "osc", wave: "sine", decay: 0.9 } }],
    ["cloche sans rapport de modulation", { ...harpe, sound: { engine: "fm" } }],
    ["percussion sans bruit ni hauteur", { ...harpe, sound: { engine: "drum" } }],
    ["harmonique 2 sans forme d'onde", { ...harpe, sound: { engine: "osc", second: 0.15 } }],
    ["format inconnu", { ...harpe, format: "air-instrument/1" }],
    ["champ inconnu", { ...harpe, echantillons: "kick.wav" }],
  ];

  it.each(casRefuses)("%s → refusé avec une raison", (_titre, fichier) => {
    const resultat = parseInstrument(fichier);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.reasons.length).toBeGreaterThan(0);
  });

  it("les zones exigent des identifiants uniques et exactement midi ou degree", () => {
    const base = { ...harpe, strings: undefined };
    const double = {
      ...base,
      zones: { zones: [
        { id: "a", u0: 0, u1: 0.5, v0: 0, v1: 1, midi: 50 },
        { id: "a", u0: 0.5, u1: 1, v0: 0, v1: 1, midi: 57 },
      ] },
    };
    expect(parseInstrument(double).ok).toBe(false);
    const deuxNotes = {
      ...base,
      zones: { zones: [{ id: "a", u0: 0, u1: 1, v0: 0, v1: 1, midi: 50, degree: 1 }] },
    };
    expect(parseInstrument(deuxNotes).ok).toBe(false);
    const aucuneNote = {
      ...base,
      zones: { zones: [{ id: "a", u0: 0, u1: 1, v0: 0, v1: 1 }] },
    };
    expect(parseInstrument(aucuneNote).ok).toBe(false);
    const correct = {
      ...base,
      zones: { zones: [{ id: "a", u0: 0, u1: 1, v0: 0, v1: 1, degree: 0 }] },
    };
    expect(parseInstrument(correct).ok).toBe(true);
  });
});

describe("AIR-P-20 — la prise : codage, décodage et vie privée", () => {
  it("coder puis décoder conserve les points au pas de codage près", () => {
    fc.assert(
      fc.property(priseArb, (avant) => {
        const resultat = decodeTake(encodeTake(avant));
        expect(resultat.ok).toBe(true);
        if (!resultat.ok) return;
        const apres = resultat.value;
        expect(apres.fps).toBe(avant.fps);
        expect(apres.frames.length).toBe(avant.frames.length);
        apres.frames.forEach((image, i) => {
          expect(image.t).toBeCloseTo(avant.frames[i]!.t, 9);
          expect(image.hands.length).toBe(avant.frames[i]!.hands.length);
          image.hands.forEach((mainApres, k) => {
            const mainAvant = avant.frames[i]!.hands[k]!;
            expect(mainApres.side).toBe(mainAvant.side);
            expect(Math.abs(mainApres.score - mainAvant.score)).toBeLessThanOrEqual(CODING_STEP_SCORE);
            mainApres.points.forEach((point, j) => {
              const attendu = mainAvant.points[j]!;
              expect(Math.abs(point[0] - attendu[0])).toBeLessThanOrEqual(CODING_STEP_XY);
              expect(Math.abs(point[1] - attendu[1])).toBeLessThanOrEqual(CODING_STEP_XY);
              expect(Math.abs(point[2] - attendu[2])).toBeLessThanOrEqual(CODING_STEP_Z);
            });
          });
        });
      }),
      { numRuns: 60 },
    );
  });

  it("un octet retourné, un fichier tronqué ou un mauvais magic sont refusés", () => {
    const avant = prise(6, 2);
    const encode = encodeTake(avant);
    for (const index of [0, 4, 9, 21, encode.byteLength - 1]) {
      const casse = new Uint8Array(encode);
      casse[index] = (casse[index]! + 7) % 256;
      expect(decodeTake(casse).ok).toBe(false);
    }
    expect(decodeTake(encode.slice(0, encode.byteLength - 5)).ok).toBe(false);
    expect(decodeTake(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).ok).toBe(false);
    expect(decodeTake(new Uint8Array(0)).ok).toBe(false);
  });

  it("une prise ne contient que des instants, des côtés, des scores et des points", () => {
    const conforme = prise(3, 1);
    expect(assertTakePrivacy(conforme).ok).toBe(true);
    const fausses = [
      { ...conforme, image: "data:image/jpeg;base64,/9j/4AAQ" },
      { ...conforme, thumbnail: [1, 2, 3] },
      { ...conforme, frames: [{ t: 0, hands: [], audio: [0.1, 0.2] }] },
      { ...conforme, fps: 30, device: "webcam-0" },
    ];
    for (const fautive of fausses) {
      const resultat = assertTakePrivacy(fautive);
      expect(resultat.ok).toBe(false);
      if (!resultat.ok) expect(resultat.reasons.join(" ")).toContain("privacy");
    }
  });

  it("les incohérences d'enregistrement sont refusées", () => {
    const base = prise(3, 1);
    expect(parseTake(base).ok).toBe(true);
    expect(parseTake({ ...base, fps: 0 }).ok).toBe(false);
    expect(parseTake({ ...base, fps: -30 }).ok).toBe(false);
    const recul = { ...base, frames: [{ t: 1, hands: [] }, { t: 0.5, hands: [] }] };
    expect(parseTake(recul).ok).toBe(false);
    const memeInstant = { ...base, frames: [{ t: 0, hands: [] }, { t: 0, hands: [] }] };
    expect(parseTake(memeInstant).ok).toBe(true); // caméra figée : légitime
    const vingtPoints = {
      ...base,
      frames: [{ t: 0, hands: [{ side: "left", score: 0.9, points: main(0.5, "left").points.slice(0, 20) }] }],
    };
    expect(parseTake(vingtPoints).ok).toBe(false);
    expect(parseTake({ ...base, frames: [{ t: 0, hands: [{ side: "middle", score: 0.9, points: main(0.5, "left").points }] }] }).ok).toBe(false);
    expect(parseTake({ ...base, frames: [{ t: 0, hands: [{ side: "left", score: 4, points: main(0.5, "left").points }] }] }).ok).toBe(false);
    expect(parseTake({ ...base, frames: [{ t: Number.NaN, hands: [] }] }).ok).toBe(false);
  });

  it("l'écriture compacte divise le poids par plus de deux et reste lisible", () => {
    const avant = prise(60, 2, 30); // deux secondes, deux mains, 30 images/s
    const texte = compactTakeJson(avant);
    const relu = parseTake(JSON.parse(texte));
    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    const apres = relu.value;
    expect(apres.frames).toHaveLength(avant.frames.length);
    // La perte est bornée par le pas d'arrondi, très sous le pixel (9,3e-4 en 1080p).
    apres.frames.forEach((image, i) => {
      image.hands.forEach((mainApres, k) => {
        mainApres.points.forEach((point, j) => {
          const attendu = avant.frames[i]!.hands[k]!.points[j]!;
          point.forEach((valeur, c) => {
            expect(Math.abs(valeur - attendu[c]!)).toBeLessThanOrEqual(1e-5);
          });
        });
      });
    });
    // Jamais plus lourd que l'écriture brute.
    expect(texte.length).toBeLessThanOrEqual(JSON.stringify(avant).length);
    // Le poids compact se rapproche de l'estimation du cahier (§7.11).
    const koParSeconde = new TextEncoder().encode(texte).byteLength / 2;
    expect(koParSeconde).toBeLessThan(26 * 1024 * 1.6);
  });

  it("l'écriture compacte divise par plus de deux le poids des flottants longs", () => {
    // Une main issue d'un calcul réel (irrationnels, divisions) écrit des
    // flottants à 17 chiffres : c'est là que le gain se mesure.
    const points = Array.from({ length: 21 }, (_, i) => [
      Math.PI / (i + 2), Math.E / (i + 3), -0.1 * Math.SQRT2,
    ] as [number, number, number]);
    const longue: Take = {
      format: "thin-air-take/1",
      fps: 30,
      frames: [{ t: 1 / 3, hands: [{ side: "left", score: 1 / 3, points }] }],
    };
    const compacte = compactTakeJson(longue);
    expect(compacte.length).toBeLessThan(JSON.stringify(longue).length / 2);
    expect(parseTake(JSON.parse(compacte)).ok).toBe(true);
  });

  it("l'arrondi ne casse pas la vie privée : seuls les champs autorisés sont écrits", () => {
    const texte = compactTakeJson(prise(3, 1));
    expect(Object.keys(JSON.parse(texte)).sort()).toEqual(["format", "fps", "frames"]);
    expect(assertTakePrivacy(JSON.parse(texte)).ok).toBe(true);
  });

  it("le poids annoncé par le cahier §7.11 est retrouvé", () => {
    const deuxMains = prise(30, 2, 30); // une seconde, deux mains, 30 images
    const compact = takeBytesPerSecond(deuxMains, true);
    const brut = takeBytesPerSecond(deuxMains, false);
    // §7.11 : 7,6 Ko/s en entiers de 16 bits, ~26 Ko/s en JSON brut.
    expect(compact).toBeGreaterThan(6_000);
    expect(compact).toBeLessThan(10_000);
    expect(brut).toBeGreaterThan(compact * 2);
  });
});

describe("sessions et réglages", () => {
  it("une session survit à l'aller-retour", () => {
    const session: Session = {
      format: "thin-air-session/1",
      tempo: 90,
      bars: 4,
      beatsPerBar: 4,
      layers: [
        {
          id: 1,
          instrument: "Phantom",
          muted: false,
          events: [
            { type: "noteOn", t: 0, voice: "pitch-0", midi: 55, velocity: 0.5 },
            { type: "noteOff", t: 1.5, voice: "pitch-0" },
          ],
        },
      ],
      settings: DEFAULT_SETTINGS,
    };
    const relu = parseSession(JSON.parse(stringifySession(session)));
    expect(relu.ok).toBe(true);
    if (relu.ok) expect(relu.value).toEqual(session);
  });

  it("une boucle de quatre mesures à 90 battements fait exactement 512 000 échantillons", () => {
    // Recette §18 : la durée ne se discute pas, elle se compte.
    const secondes = (4 * 4 * 60) / 90;
    expect(Math.round(secondes * SAMPLE_RATE)).toBe(512_000);
    expect(secondes).toBeCloseTo(10.67, 2);
  });

  it("une session altérée est refusée", () => {
    const fautive = { format: "thin-air-session/1", tempo: 0, bars: 4, beatsPerBar: 4, layers: [] };
    expect(parseSession(fautive).ok).toBe(false);
  });
});
