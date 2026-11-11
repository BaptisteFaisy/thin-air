/**
 * La boucle (cahier §7.10, §7.9 règle 2, §18) : durées, compensation du
 * retard, calage sur la grille, couches, fenêtre de programmation.
 * Propriété : AIR-P-17.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_SETTINGS, SAMPLE_RATE, withSettings } from "./defaults.js";
import {
  LoopRecorder,
  MAX_LAYERS,
  barSeconds,
  beatSeconds,
  compensate,
  emptySession,
  gridStepSeconds,
  loopEventsAt,
  loopSamples,
  loopSeconds,
  quantize,
} from "./loop.js";
import type { LoopLayer, MusicEvent, Session } from "./types.js";

const EPS = 1e-9;

function noteOn(t: number, midi: number, voice = "v", velocity = 0.5): MusicEvent {
  return { type: "noteOn", t, voice, midi, velocity };
}

function noteOff(t: number, voice = "v"): MusicEvent {
  return { type: "noteOff", t, voice };
}

function control(t: number, value: number, voice = "v"): MusicEvent {
  return { type: "control", t, voice, param: "gain", value };
}

/** Référence indépendante du repli dans la boucle : modulo positif. */
function wrapRef(t: number, length: number): number {
  const r = t % length;
  return r < 0 ? r + length : r;
}

function couche(id: number, events: readonly MusicEvent[], muted = false): LoopLayer {
  return { id, instrument: "phantom", events, muted };
}

function session(layers: readonly LoopLayer[], tempo = 90, bars = 4): Session {
  return {
    ...emptySession(withSettings({ tempo, loopBars: bars })),
    layers,
  };
}

describe("durées (§7.10)", () => {
  it("à 90 battements par minute : 2,667 s par mesure, 10,667 s pour quatre", () => {
    expect(barSeconds(90, 4)).toBeCloseTo(2.6667, 4);
    expect(loopSeconds(90, 4, 4)).toBeCloseTo(10.6667, 4);
    expect(loopSeconds(90, 1, 4)).toBeCloseTo(2.6667, 4);
    expect(loopSeconds(90, 2, 4)).toBeCloseTo(5.3333, 4);
    expect(beatSeconds(90)).toBeCloseTo(0.6667, 4);
    expect(gridStepSeconds("sixteenth", 90)).toBeCloseTo(0.1667, 4);
    expect(gridStepSeconds("eighth", 90)).toBeCloseTo(0.3333, 4);
    expect(gridStepSeconds("off", 90)).toBe(0);
  });

  it("recette §18 — quatre mesures à 90 font exactement 512 000 échantillons", () => {
    expect(loopSamples(90, 4, 4, SAMPLE_RATE)).toBe(512_000);
    expect(loopSamples(90, 4, 4) * 1).toBe(512_000);
    expect(512_000 / SAMPLE_RATE).toBeCloseTo(10.6667, 4);
  });

  it("bornes de tempo 60 et 140, une, deux et quatre mesures", () => {
    for (const tempo of [60, 90, 140]) {
      for (const bars of [1, 2, 4]) {
        const attendu = (bars * 4 * 60 * SAMPLE_RATE) / tempo;
        expect(loopSamples(tempo, bars, 4, SAMPLE_RATE)).toBe(Math.round(attendu));
        expect(loopSeconds(tempo, bars, 4) * SAMPLE_RATE).toBeCloseTo(attendu, 6);
      }
    }
    expect(loopSamples(60, 4, 4)).toBe(768_000);
    // 140 : 4 × 4 × 60 / 140 = 6,857142857 s, soit 329 142,857 échantillons.
    expect(loopSamples(140, 4, 4)).toBe(329_143);
  });

  it("un tempo absurde retombe sur le défaut plutôt que sur l'infini", () => {
    expect(barSeconds(0, 4)).toBeCloseTo(barSeconds(DEFAULT_SETTINGS.tempo, 4), 9);
    expect(barSeconds(Number.NaN, 4)).toBeCloseTo(barSeconds(DEFAULT_SETTINGS.tempo, 4), 9);
  });
});

describe("AIR-P-17 — la durée d'une boucle vaut exactement ses mesures", () => {
  it("pour tout tempo de 60 à 140 et 1, 2 ou 4 mesures", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 140 }),
        fc.constantFrom(1, 2, 4),
        fc.constantFrom(2, 3, 4, 6),
        (tempo, bars, beatsPerBar) => {
          const attendu = (bars * beatsPerBar * 60 * SAMPLE_RATE) / tempo;
          expect(loopSamples(tempo, bars, beatsPerBar, SAMPLE_RATE)).toBe(Math.round(attendu));
          expect(loopSeconds(tempo, bars, beatsPerBar)).toBeCloseTo(attendu / SAMPLE_RATE, 9);
          expect(bars * barSeconds(tempo, beatsPerBar)).toBeCloseTo(
            loopSeconds(tempo, bars, beatsPerBar),
            9,
          );
        },
      ),
      { seed: 20_261_113, numRuns: 200 },
    );
  });
});

describe("compensation du retard (§5.2, §7.10)", () => {
  it("105 ms de retard font 63 % d'une double croche à 90 (chiffres du cahier)", () => {
    const doubleCroche = gridStepSeconds("sixteenth", 90);
    expect(0.105 / doubleCroche).toBeCloseTo(0.63, 2);
    const pose = 4 * doubleCroche;
    const brut = [noteOn(pose + 0.105, 60)];
    const compense = compensate(brut, 0.105, loopSeconds(90, 4, 4));
    const instant = compense[0]?.t ?? -1;
    expect(instant).toBeCloseTo(pose, 9);
    expect((instant - pose) / doubleCroche).toBeCloseTo(0, 9);
  });

  it("avance chaque événement exactement du retard, en restant dans la boucle", () => {
    const boucle = loopSeconds(90, 4, 4);
    const events = [noteOn(0.05, 60), noteOff(0.4), control(1.2, 0.7), noteOn(9.0, 62)];
    const sortie = compensate(events, 0.105, boucle);
    const attendus = events.map((e) => wrapRef(e.t - 0.105, boucle)).sort((a, b) => a - b);
    sortie.forEach((e, i) => expect(e.t).toBeCloseTo(attendus[i] as number, 9));
    expect(sortie.every((e) => e.t >= 0 && e.t < boucle)).toBe(true);
    expect(sortie).toHaveLength(events.length);
  });

  it("un instant devenu négatif repasse en fin de boucle", () => {
    const boucle = loopSeconds(90, 1, 4);
    const sortie = compensate([noteOn(0.05, 60)], 0.105, boucle);
    expect(sortie[0]?.t).toBeCloseTo(boucle - 0.055, 9);
  });

  it("un retard plus long que la boucle reste dans la boucle", () => {
    const boucle = loopSeconds(90, 1, 4);
    const sortie = compensate([noteOn(1.0, 60)], 3 * boucle + 0.25, boucle);
    const t = sortie[0]?.t ?? -1;
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(boucle);
    expect(t).toBeCloseTo(wrapRef(1.0 - (3 * boucle + 0.25), boucle), 6);
  });

  it("un retard nul ne change que l'ordre des égalités, pas les instants", () => {
    const events = [noteOn(0.5, 60), noteOff(1.5), control(1.0, 0.2)];
    const sortie = compensate(events, 0, loopSeconds(90, 4, 4));
    expect(sortie.map((e) => e.t)).toEqual([0.5, 1.0, 1.5]);
  });

  it("AIR-P-17 — la compensation avance chaque événement du retard, dans la boucle", () => {
    // Tout est en millisecondes entières : l'arithmétique du test est exacte,
    // et la seule imprécision comparée est celle du code testé.
    const générateur = fc
      .array(
        fc.record({
          type: fc.constantFrom("noteOn" as const, "noteOff" as const),
          ms: fc.integer({ min: 0, max: 12_000 }),
          midi: fc.integer({ min: 40, max: 80 }),
        }),
        { minLength: 0, maxLength: 12 },
      )
      .chain((events) =>
        fc.tuple(
          fc.constant(events),
          fc.integer({ min: 0, max: 2_000 }),
          fc.integer({ min: 500, max: 12_000 }),
        ),
      );
    fc.assert(
      fc.property(générateur, ([events, retardMs, boucleMs]) => {
        const retard = retardMs / 1000;
        const boucle = boucleMs / 1000;
        const bruts: MusicEvent[] = events.map((e) =>
          e.type === "noteOn" ? noteOn(e.ms / 1000, e.midi) : noteOff(e.ms / 1000),
        );
        const sortie = compensate(bruts, retard, boucle);
        expect(sortie).toHaveLength(bruts.length);
        const attendus = bruts.map((e) => wrapRef(e.t - retard, boucle)).sort((a, b) => a - b);
        sortie.forEach((e, i) => {
          expect(e.t).toBeGreaterThanOrEqual(0);
          expect(e.t).toBeLessThan(boucle);
          expect(Math.abs(e.t - (attendus[i] as number))).toBeLessThan(1e-12);
        });
      }),
      { seed: 20_261_110, numRuns: 200 },
    );
  });
});

describe("calage sur la grille (§7.10)", () => {
  const events = [
    noteOn(0.02, 60),
    noteOff(0.22),
    noteOn(0.35, 62),
    noteOff(0.5),
    control(0.1, 0.3),
  ];

  it("force 0 ne change rien du tout", () => {
    for (const grille of ["off", "eighth", "sixteenth"] as const) {
      expect(quantize(events, grille, 0, 90, 4)).toEqual(events);
    }
  });

  it("grille « off » ne change rien, même à force 1", () => {
    expect(quantize(events, "off", 1, 90, 4)).toEqual(events);
  });

  it("force 1 pose chaque attaque exactement sur la grille", () => {
    for (const grille of ["eighth", "sixteenth"] as const) {
      const pas = gridStepSeconds(grille, 90);
      const cales = quantize(events, grille, 1, 90, 4);
      for (const event of cales) {
        if (event.type !== "noteOn") continue;
        const multiple = event.t / pas;
        expect(Math.abs(multiple - Math.round(multiple))).toBeLessThan(1e-9);
      }
    }
  });

  it("les autres événements suivent le décalage de leur attaque", () => {
    const cales = quantize(events, "eighth", 1, 90, 4);
    const pas = gridStepSeconds("eighth", 90);
    const attaque = cales.find((e) => e.type === "noteOn" && e.midi === 60);
    const fin = cales.find((e) => e.type === "noteOff" && Math.abs(e.t - 0.22) < 0.2);
    expect(attaque?.t).toBeCloseTo(0, 9);
    // La note garde sa durée de 200 ms, seulement déplacée de 20 ms.
    expect(fin).toBeDefined();
    expect((fin?.t ?? 0) - (attaque?.t ?? 0)).toBeCloseTo(0.2, 9);
    expect(fin?.t).toBeCloseTo(0.2, 9);
    expect(pas).toBeCloseTo(1 / 3, 9);
  });

  it("une force intermédiaire déplace d'une fraction du chemin", () => {
    const cales = quantize([noteOn(0.1, 60)], "eighth", 0.5, 90, 4);
    expect(cales[0]?.t).toBeCloseTo(0.05, 9);
  });

  it("une attaque exactement sur la grille ne bouge pas", () => {
    const pas = gridStepSeconds("sixteenth", 90);
    const cales = quantize([noteOn(3 * pas, 60)], "sixteenth", 1, 90, 4);
    expect(cales[0]?.t).toBeCloseTo(3 * pas, 9);
  });

  it("AIR-P-17 — force 1 met toute attaque sur la grille, force 0 ne touche à rien", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ms: fc.integer({ min: 0, max: 10_000 }),
            midi: fc.integer({ min: 40, max: 80 }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        fc.constantFrom("eighth" as const, "sixteenth" as const),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 60, max: 140 }),
        (attaques, grille, force, tempo) => {
          const bruts: MusicEvent[] = attaques.map((a) => noteOn(a.ms / 1000, a.midi));
          expect(quantize(bruts, grille, 0, tempo, 4)).toEqual(bruts);
          const pas = gridStepSeconds(grille, tempo);
          for (const event of quantize(bruts, grille, 1, tempo, 4)) {
            if (event.type !== "noteOn") continue;
            const multiple = event.t / pas;
            expect(Math.abs(multiple - Math.round(multiple))).toBeLessThan(1e-7);
          }
          if (force > 0 && force < 1) {
            for (const event of quantize(bruts, grille, force, tempo, 4)) {
              expect(Number.isFinite(event.t)).toBe(true);
            }
          }
        },
      ),
      { seed: 20_261_111, numRuns: 200 },
    );
  });
});

describe("LoopRecorder (§7.10)", () => {
  const reglages = withSettings({ tempo: 90, loopBars: 4 });
  const boucle = loopSeconds(90, 4, 4);

  it("enregistre des événements datés depuis le début de la prise", () => {
    const recorder = new LoopRecorder(reglages);
    recorder.start(100);
    recorder.record(noteOn(100.5, 60));
    recorder.record(noteOff(100.9));
    const layer = recorder.stop(102, "phantom");
    expect(layer).not.toBeNull();
    expect(layer?.instrument).toBe("phantom");
    expect(layer?.muted).toBe(false);
    expect(layer?.events.map((e) => e.t)).toHaveLength(2);
    expect(layer?.events[0]?.t).toBeCloseTo(0.5, 9);
    expect(layer?.events[1]?.t).toBeCloseTo(0.9, 9);
    expect(recorder.layers).toHaveLength(1);
  });

  it("retire le retard estimé à l'arrêt", () => {
    const recorder = new LoopRecorder(reglages);
    recorder.latencyS = 0.105;
    recorder.start(0);
    recorder.record(noteOn(4 / 3 + 0.105, 60));
    const layer = recorder.stop(2, "phantom");
    expect(layer?.events[0]?.t).toBeCloseTo(4 / 3, 9);
  });

  it("ignore la fin de prise au-delà de la boucle et les instants négatifs", () => {
    const recorder = new LoopRecorder(reglages);
    recorder.start(10);
    recorder.record(noteOn(9.5, 60));
    recorder.record(noteOn(10.1, 61));
    recorder.record(noteOn(10 + boucle + 1, 62));
    const layer = recorder.stop(11, "phantom");
    expect(layer?.events.map((e) => (e.type === "noteOn" ? e.midi : -1))).toEqual([61]);
  });

  it("refuse une septième couche et rend null", () => {
    const recorder = new LoopRecorder(reglages);
    for (let i = 0; i < MAX_LAYERS; i++) {
      recorder.start(0);
      recorder.record(noteOn(0.1 * i, 60 + i));
      expect(recorder.stop(1, `voix-${i}`)).not.toBeNull();
    }
    expect(recorder.layers).toHaveLength(MAX_LAYERS);
    recorder.start(0);
    recorder.record(noteOn(0.5, 70));
    expect(recorder.stop(1, "trop")).toBeNull();
    expect(recorder.layers).toHaveLength(MAX_LAYERS);
  });

  it("retire la dernière couche, coupe une couche, efface tout", () => {
    const recorder = new LoopRecorder(reglages);
    for (let i = 0; i < 3; i++) {
      recorder.start(0);
      recorder.record(noteOn(0.1 + i, 60 + i));
      recorder.stop(1, `voix-${i}`);
    }
    const ids = recorder.layers.map((l) => l.id);
    expect(recorder.removeLastLayer()?.id).toBe(ids[2]);
    expect(recorder.layers).toHaveLength(2);
    expect(recorder.setLayerMuted(ids[0] as number, true)).toBe(true);
    expect(recorder.layers[0]?.muted).toBe(true);
    expect(recorder.toggleLayerMuted(ids[0] as number)).toBe(true);
    expect(recorder.layers[0]?.muted).toBe(false);
    expect(recorder.setLayerMuted(999, true)).toBe(false);
    expect(recorder.removeLastLayer()?.id).toBe(ids[1]);
    expect(recorder.removeLastLayer()?.id).toBe(ids[0]);
    expect(recorder.removeLastLayer()).toBeUndefined();
    recorder.start(0);
    recorder.record(noteOn(0.2, 60));
    recorder.clear();
    expect(recorder.layers).toHaveLength(0);
    expect(recorder.isRecording).toBe(false);
  });

  it("sans start, record ne fait rien et stop rend null", () => {
    const recorder = new LoopRecorder(reglages);
    recorder.record(noteOn(0.1, 60));
    expect(recorder.stop(1, "phantom")).toBeNull();
    expect(recorder.layers).toHaveLength(0);
  });
});

describe("fenêtre de programmation (§7.9 règle 2)", () => {
  it("le minuteur (25 ms, fenêtre 100 ms) ne perd ni ne double aucun événement", () => {
    const boucle = loopSeconds(90, 4, 4);
    const mesure = barSeconds(90, 4);
    // Une voix par événement : chaque événement se compte sans ambiguïté.
    const events: MusicEvent[] = [
      noteOn(0, 60, "a"),
      noteOff(0.6, "a"),
      noteOn(mesure, 62, "b"),
      noteOff(mesure + 0.5, "b"),
      noteOn(boucle - 0.01, 64, "c"),
      control(2.5, 0.5, "d"),
    ];
    const ma = session([couche(1, events)]);
    const pas = 0.025;
    const fenetre = 0.1;
    // Le minuteur du §7.9, règle 2 : un passage toutes les 25 ms, qui programme
    // la fenêtre qui vient. Le curseur garantit qu'aucune fenêtre n'est rejouée.
    const programme: MusicEvent[] = [];
    let curseur = 0;
    let passages = 0;
    const passagesTotal = Math.ceil((3 * boucle) / pas);
    // Les instants du minuteur sont des millisecondes entières : le curseur ne
    // dérive pas, et le test ne mesure pas l'arithmétique de son propre banc.
    const ms = (valeur: number): number => Math.round(valeur * 1000) / 1000;
    for (let i = 0; i < passagesTotal; i++) {
      const debut = ms(i * pas);
      const fin = ms(debut + fenetre);
      if (fin <= curseur) continue;
      programme.push(...loopEventsAt(ma, curseur, fin - curseur));
      curseur = fin;
      passages++;
    }
    expect(passages).toBe(passagesTotal);
    // Trois tours complets, plus la fenêtre en cours au-delà du troisième.
    expect(curseur).toBeGreaterThanOrEqual(3 * boucle);
    const tours = 3;
    for (const evenement of events) {
      const siens = programme.filter(
        (e) => e.voice === evenement.voice && e.type === evenement.type,
      );
      // Un tour entièrement couvert = exactement une programmation.
      expect(siens.filter((e) => e.t < tours * boucle), evenement.voice).toHaveLength(tours);
      for (let tour = 0; tour < tours; tour++) {
        const dansLeTour = siens.filter((e) => e.t >= tour * boucle && e.t < (tour + 1) * boucle);
        expect(dansLeTour, `${evenement.voice} tour ${tour}`).toHaveLength(1);
        expect(dansLeTour[0]?.t).toBeCloseTo(tour * boucle + evenement.t, 6);
      }
    }
    // Aucun instant programmé deux fois, et la sortie reste triée.
    const cles = programme.map((e) => `${e.type}:${e.voice}:${e.t.toFixed(9)}`);
    expect(new Set(cles).size).toBe(cles.length);
    const instants = programme.map((e) => e.t);
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
  });

  it("ignore les couches muettes et trie par instant", () => {
    const ma = session([
      couche(1, [noteOn(0.5, 60), noteOn(0.2, 62)], true),
      couche(2, [noteOn(0.4, 64), noteOn(0.1, 65)]),
    ]);
    const dus = loopEventsAt(ma, 0, 0.6);
    expect(dus).toHaveLength(2);
    expect(dus[0]?.t).toBeCloseTo(0.1, 9);
    expect(dus[1]?.t).toBeCloseTo(0.4, 9);
    expect(dus.every((e) => e.type === "noteOn" && (e.midi === 64 || e.midi === 65))).toBe(true);
  });

  it("une couche non muette mais vide ne produit rien ; session vide : rien", () => {
    expect(loopEventsAt(session([couche(1, [])]), 0, 1)).toEqual([]);
    expect(loopEventsAt(emptySession(DEFAULT_SETTINGS), 0, 1)).toEqual([]);
  });

  it("une fenêtre nulle ou négative ne rend aucun événement", () => {
    const ma = session([couche(1, [noteOn(0.5, 60)])]);
    expect(loopEventsAt(ma, 0, 0)).toEqual([]);
    expect(loopEventsAt(ma, 0, -1)).toEqual([]);
  });

  it("un événement sur une frontière de mesure tombe une seule fois par tour", () => {
    const ma = session([couche(1, [noteOn(barSeconds(90, 4), 60)])]);
    const hauteur = barSeconds(90, 4);
    expect(loopEventsAt(ma, 0, hauteur)).toEqual([]);
    expect(loopEventsAt(ma, hauteur, 0.025).map((e) => e.t)).toEqual([hauteur]);
    expect(loopEventsAt(ma, barSeconds(90, 4) * 3, 0.025)).toEqual([]);
  });
});

describe("emptySession (§7.10, §7.13)", () => {
  it("reprend les réglages et ne contient aucune couche", () => {
    const reglages = withSettings({ tempo: 120, loopBars: 2, beatsPerBar: 3 });
    const ma = emptySession(reglages);
    expect(ma.format).toBe("thin-air-session/1");
    expect(ma.tempo).toBe(120);
    expect(ma.bars).toBe(2);
    expect(ma.beatsPerBar).toBe(3);
    expect(ma.layers).toEqual([]);
    expect(ma.settings).toBe(reglages);
    expect(loopEventsAt(ma, 3.7, 0.1)).toEqual([]);
  });
});
