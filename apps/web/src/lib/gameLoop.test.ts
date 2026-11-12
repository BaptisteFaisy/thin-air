import { describe, expect, it } from "vitest";
import type { DetectedHand, MusicEvent } from "@thin-air/core";
import { GHOST_AFTER_S, ghostShouldStart, ghostShouldStop, releaseAll, tick } from "./gameLoop.js";
import type { Tracking } from "./tracking.js";

const note: MusicEvent = { type: "noteOn", t: 0, voice: "v1", midi: 60, velocity: 1 };
const mains: readonly DetectedHand[] = [];

function suiviDouble(events: readonly MusicEvent[]): Tracking & { readonly appels: string[] } {
  const appels: string[] = [];
  return {
    ready: true,
    appels,
    push: () => {
      appels.push("push");
      return events;
    },
    stall: () => {
      appels.push("stall");
      return events;
    },
    end: () => {
      appels.push("end");
      return events;
    },
    currentMidi: () => 60,
    reconfigurer: () => [],
  };
}

function sonnerieDouble(journal: string[]) {
  return {
    play: () => journal.push("play"),
    releaseAll: () => journal.push("releaseAll"),
  };
}

describe("boucle de jeu et fantôme (cahier §7.9, AIR-F-16, AIR-F-50)", () => {
  it("un pas de jeu : les événements partent au moteur et à l'affichage", () => {
    const journal: string[] = [];
    const recus: MusicEvent[][] = [];
    const suivi = suiviDouble([note]);
    const rendus = tick(1, mains, suivi, sonnerieDouble(journal), (events) => recus.push([...events]));
    expect(rendus).toEqual([note]);
    expect(journal).toEqual(["play"]);
    expect(recus.length).toBe(1);
  });

  it("rien ne sonne : le moteur n'est pas appelé pour rien", () => {
    const journal: string[] = [];
    tick(1, mains, suiviDouble([]), sonnerieDouble(journal), () => undefined);
    expect(journal).toEqual([]);
  });

  it("AIR-F-16 — le relâchement général passe par le suivi et par le moteur", () => {
    const journal: string[] = [];
    const recus: MusicEvent[][] = [];
    const suivi = suiviDouble([note]);
    releaseAll(2, suivi, sonnerieDouble(journal), (events) => recus.push([...events]));
    expect(suivi.appels).toEqual(["end"]);
    expect(journal).toEqual(["releaseAll"]);
    expect(recus.length).toBe(1);
  });

  it("AIR-F-50 — vingt secondes sans main, et le fantôme se met à jouer", () => {
    expect(GHOST_AFTER_S).toBe(20);
    expect(ghostShouldStart(19.9, false)).toBe(false);
    expect(ghostShouldStart(20, false)).toBe(true);
    expect(ghostShouldStart(60, true)).toBe(false);
  });

  it("AIR-F-50 — le fantôme s'arrête dès qu'une main paraît", () => {
    expect(ghostShouldStop(1, true)).toBe(true);
    expect(ghostShouldStop(0, true)).toBe(false);
    expect(ghostShouldStop(1, false)).toBe(false);
  });

  it.todo("AIR-P-11 — une image ne produit jamais plus de `maxVoices` voix — dépend du lot A3 (voices)");
  it.todo("AIR-P-12 — la même prise redonne la même liste d'événements — dépend du lot A3 (pipeline)");
});
