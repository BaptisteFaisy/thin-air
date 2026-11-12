/**
 * La chaîne de suivi se reconfigure en plein jeu (cahier §7.8, AIR-F-24) :
 * changer d'instrument, de gamme, d'aimant, de zone, de mode ou de rôle
 * n'interrompt ni la caméra ni l'analyse, et ne rejoue pas un geste en cours.
 *
 * Aucun son, aucun périphérique audio (AIR-N-02) : la source est une reprise
 * déterministe, l'horloge est injectée.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  defaultPlayRect,
  makeHand,
  poseFromPlay,
  type DetectedHand,
  type Instrument,
  type MusicEvent,
  type PlayRect,
  type Settings,
  type Take,
} from "@thin-air/core";
import { createReplaySource } from "@thin-air/vision";
import { PHANTOM, HARP, CHOIR } from "../state/presets.js";
import { createTracking } from "./tracking.js";

/** Un instrument de test : la pince déclenche une note, pour voir les doublons. */
const PINCE: Instrument = {
  format: "thin-air-instrument/1",
  name: "Pince",
  pointer: "palm",
  scale: { root: 60, steps: [0, 3, 5, 7, 10] },
  strings: { count: 4, axis: "u" },
  snap: 1,
  voices: 4,
  gestures: [{ hand: "any", gesture: "pinch", do: "pluck" }],
  sound: { engine: "osc", wave: "sine", releaseMs: 200 },
};

/** Une main ouverte, placée dans la zone de jeu (cahier §7.4). */
function mainOuverte(side: "left" | "right" = "right", u = 0.5): DetectedHand {
  return makeHand(poseFromPlay(u, 0.5, { side, open: 0.9, pinch: 0.9 }));
}

/** Une main fermée en pince, maintenue (cahier §7.6). */
function mainPincee(): DetectedHand {
  return makeHand(poseFromPlay(0.5, 0.5, { side: "right", open: 0.4, pinch: 0.05 }));
}

/**
 * La reprise déterministe : un plan d'images et une horloge qu'on avance. Les
 * images ne tombent que lorsque l'horloge passe le plan (cahier §7.2).
 */
interface Reprise {
  /** Les mains de l'image qui tombe à l'instant donné. */
  image(t: number): readonly DetectedHand[];
}

function reprise(frames: readonly DetectedHand[], fps = 30): Reprise {
  const take: Take = {
    format: "thin-air-take/1",
    fps,
    frames: frames.map((hand, index) => ({ t: index / fps, hands: [hand] })),
  };
  let horloge = 0;
  const enAttente: { fn: () => void; due: number }[] = [];
  const source = createReplaySource(take, {
    now: () => horloge,
    schedule: (fn, delayMs) => {
      enAttente.push({ fn, due: horloge + delayMs });
      return () => undefined;
    },
  });
  let recues: DetectedHand[] = [];
  source.onFrame((frame) => {
    recues = recues.concat(frame.hands);
  });
  void source.start();
  return {
    image(t) {
      horloge = t * 1000;
      let encore = true;
      while (encore) {
        encore = false;
        for (const attente of [...enAttente]) {
          if (attente.due > horloge + 1) continue;
          enAttente.splice(enAttente.indexOf(attente), 1);
          horloge = Math.max(horloge, attente.due);
          attente.fn();
          encore = true;
        }
      }
      const rendues = recues;
      recues = [];
      return rendues;
    },
  };
}

/** Une séance de test : la chaîne, les réglages et les événements rendus. */
interface Seance {
  readonly events: MusicEvent[];
  image(t: number, hands: readonly DetectedHand[]): void;
  reconfigurer(t: number, instrument: Instrument, settings: Settings, rect: PlayRect): void;
  /** La fin de séance : toute voix encore active doit s'éteindre (AIR-P-09). */
  finir(t: number): void;
}

function seance(
  instrument: Instrument,
  settings: Settings = DEFAULT_SETTINGS,
  rect: PlayRect = defaultPlayRect(),
): Seance {
  const suivi = createTracking(instrument, settings, rect);
  const events: MusicEvent[] = [];
  return {
    events,
    image(t, hands) {
      for (const event of suivi.push(t, hands)) events.push(event);
    },
    reconfigurer(t, instrument, settings, rect) {
      for (const event of suivi.reconfigurer(t, instrument, settings, rect)) events.push(event);
    },
    finir(t) {
      for (const event of suivi.end(t)) events.push(event);
    },
  };
}

/** Les hauteurs jouées : les `noteOn` et les variations de hauteur. */
function hauteursJouees(events: readonly MusicEvent[]): number[] {
  return events.flatMap((event) => {
    if (event.type === "noteOn") return [event.midi];
    if (event.type === "control" && event.param === "pitch") return [event.value];
    return [];
  });
}

/** Les hauteurs d'une gamme : les degrés sur trois octaves. */
function hauteursGamme(root: number, steps: readonly number[]): number[] {
  return Array.from({ length: 3 }, (_, octave) => steps.map((step) => root + 12 * octave + step)).flat();
}

/** Les voix encore allumées après la fin de séance : aucune (AIR-P-09). */
function voicesRestantes(events: readonly MusicEvent[]): string[] {
  const actives = new Set<string>();
  for (const event of events) {
    if (event.type === "noteOn") actives.add(event.voice);
    else if (event.type === "noteOff") actives.delete(event.voice);
  }
  return [...actives].sort();
}

describe("inventaire des commandes en cours de séance (§7.8, §12.2, AIR-F-24)", () => {
  it("la reprise déterministe rend les mêmes images à chaque fois", () => {
    const premiere = reprise([mainOuverte(), mainOuverte()]);
    const seconde = reprise([mainOuverte(), mainOuverte()]);
    expect(premiere.image(0)).toEqual(seconde.image(0));
    expect(premiere.image(1 / 30)).toHaveLength(1);
  });

  it("changer d'instrument : les voix s'éteignent, la nouvelle géométrie sert", () => {
    const session = seance(PHANTOM);
    session.image(0.1, [mainOuverte()]);
    session.image(0.2, [mainOuverte()]);
    expect(hauteursJouees(session.events)).not.toHaveLength(0);

    const avant = session.events.length;
    session.reconfigurer(0.3, HARP, DEFAULT_SETTINGS, defaultPlayRect());
    const relaches = session.events.slice(avant).filter((e) => e.type === "noteOff");
    expect(relaches.length).toBeGreaterThan(0);
    session.finir(0.4);
    expect(voicesRestantes(session.events)).toEqual([]);
  });

  it("la note qui suit appartient à la NOUVELLE gamme", () => {
    const reglage: Settings = { ...DEFAULT_SETTINGS, magnet: 1 };
    const zone = defaultPlayRect();
    const session = seance(PHANTOM, reglage, zone);
    session.image(0.1, [mainOuverte()]);
    const avant = hauteursJouees(session.events).length;
    expect(avant).toBeGreaterThan(0);

    const autre: Instrument = { ...PHANTOM, scale: { root: 55, steps: [0, 2, 4, 7, 9] } };
    session.reconfigurer(0.2, autre, reglage, zone);
    session.image(0.3, [mainOuverte()]);
    const apres = hauteursJouees(session.events).slice(avant);
    const gamme = hauteursGamme(55, [0, 2, 4, 7, 9]);
    expect(apres.length).toBeGreaterThan(0);
    for (const midi of apres) expect(gamme).toContain(midi);
  });

  it("l'aimant s'applique à la note qui suit", () => {
    const zone = defaultPlayRect();
    const faible = seance(PHANTOM, { ...DEFAULT_SETTINGS, magnet: 0 }, zone);
    const fort = seance(PHANTOM, { ...DEFAULT_SETTINGS, magnet: 1 }, zone);
    faible.image(0.1, [mainOuverte()]);
    fort.image(0.1, [mainOuverte()]);
    expect(hauteursJouees(faible.events)).not.toEqual(hauteursJouees(fort.events));
  });

  it("une pince maintenue ne se déclenche pas deux fois", () => {
    const zone = defaultPlayRect();
    const session = seance(PINCE, DEFAULT_SETTINGS, zone);
    session.image(0.1, [mainPincee()]);
    const premier = hauteursJouees(session.events).length;
    expect(premier).toBe(1);

    // Un réglage change pendant que la pince reste fermée.
    session.reconfigurer(0.2, PINCE, { ...DEFAULT_SETTINGS, magnet: 1 }, zone);
    session.image(0.3, [mainPincee()]);
    expect(hauteursJouees(session.events).length).toBe(premier);
  });

  it("le mode gaucher inverse les rôles : la note suit l'autre main", () => {
    const zone = defaultPlayRect();
    const session = seance(PHANTOM, DEFAULT_SETTINGS, zone);
    const gauche = mainOuverte("left", 0.2);
    const droite = mainOuverte("right", 0.8);
    session.image(0.1, [gauche, droite]);
    const avant = hauteursJouees(session.events);
    expect(avant.length).toBeGreaterThan(0);
    session.reconfigurer(0.2, PHANTOM, { ...DEFAULT_SETTINGS, leftHanded: true }, zone);
    session.image(0.3, [gauche, droite]);
    const apres = hauteursJouees(session.events).slice(avant.length);
    expect(apres.length).toBeGreaterThan(0);
    // La note suit désormais la main gauche, plus basse dans la zone.
    expect(apres[apres.length - 1] ?? 0).toBeLessThan(avant[avant.length - 1] ?? 0);
  });

  it("la zone de jeu calibrée s'applique : la note se déplace", () => {
    const zone = defaultPlayRect();
    const session = seance(PHANTOM, DEFAULT_SETTINGS, zone);
    const main = mainOuverte("right", 0.8);
    session.image(0.1, [main]);
    const avant = hauteursJouees(session.events);
    expect(avant.length).toBeGreaterThan(0);
    const zoneEtroite = { u0: 0.45, u1: 0.55, v0: 0.1, v1: 0.9, calibratedAt: null } as PlayRect;
    session.reconfigurer(0.2, PHANTOM, DEFAULT_SETTINGS, zoneEtroite);
    session.image(0.3, [main]);
    const apres = hauteursJouees(session.events).slice(avant.length);
    expect(apres.length).toBeGreaterThan(0);
    expect(apres[apres.length - 1]).not.toBe(avant[avant.length - 1]);
  });

  it("le mode une main s'applique à la note qui suit", () => {
    const zone = defaultPlayRect();
    const deux = seance(PHANTOM, DEFAULT_SETTINGS, zone);
    const une = seance(PHANTOM, { ...DEFAULT_SETTINGS, oneHand: true }, zone);
    const main = mainOuverte();
    deux.image(0.1, [main]);
    une.image(0.1, [main]);
    const gains = (s: Seance): number[] =>
      s.events.flatMap((e) => (e.type === "control" && e.param === "gain" ? [e.value] : []));
    expect(gains(une)).not.toEqual(gains(deux));
  });

  it("changer deux fois de suite : la dernière configuration fait foi", () => {
    const zone = defaultPlayRect();
    const session = seance(PHANTOM, DEFAULT_SETTINGS, zone);
    session.image(0.1, [mainOuverte()]);
    session.reconfigurer(0.2, HARP, DEFAULT_SETTINGS, zone);
    session.reconfigurer(0.3, CHOIR, DEFAULT_SETTINGS, zone);
    session.image(0.4, [mainOuverte()]);
    session.finir(0.5);
    expect(voicesRestantes(session.events)).toEqual([]);
  });

  it("changer d'instrument quand la main sort du cadre : aucune note ne reste", () => {
    const zone = defaultPlayRect();
    const session = seance(PHANTOM, DEFAULT_SETTINGS, zone);
    session.image(0.1, [mainOuverte()]);
    session.image(0.2, []);
    session.reconfigurer(0.3, HARP, DEFAULT_SETTINGS, zone);
    session.image(0.4, []);
    session.finir(0.5);
    expect(voicesRestantes(session.events)).toEqual([]);
  });

  it("changer d'instrument pendant le délai de grâce : la note se relâche", () => {
    const zone = defaultPlayRect();
    const session = seance(PHANTOM, DEFAULT_SETTINGS, zone);
    session.image(0.1, [mainOuverte()]);
    // La main disparaît : le délai de grâce tient la dernière mesure.
    session.image(0.2, []);
    session.reconfigurer(0.25, HARP, DEFAULT_SETTINGS, zone);
    session.image(0.3, []);
    session.finir(0.4);
    expect(voicesRestantes(session.events)).toEqual([]);
  });
});
