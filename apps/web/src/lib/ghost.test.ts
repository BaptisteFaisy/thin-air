/**
 * Le fantôme de la page (cahier §8, parcours P11 ; AIR-F-50) : le volume
 * descend pendant le rejeu, remonte dès qu'il s'arrête, et aucune main ne reste
 * en cours quand il se tait. Le moteur est un double : aucun son n'est émis ici
 * (AIR-N-02), et aucune caméra n'est ouverte.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@thin-air/core";
import { GHOST_VOLUME_DB } from "../kiosk/kiosk.js";
import { createGhost } from "./ghost.js";
import type { Engine } from "./engine.js";

function moteurDouble(appels: Settings[]): Engine {
  return { setSettings: (settings: Settings) => appels.push(settings) } as unknown as Engine;
}

describe("le fantôme (P11, AIR-F-50)", () => {
  it("joue à faible volume, puis rend le volume réglé par la personne", () => {
    const appels: Settings[] = [];
    const fantome = createGhost({ current: moteurDouble(appels) });
    fantome.start(DEFAULT_SETTINGS);
    expect(appels[0]?.masterGainDb).toBe(GHOST_VOLUME_DB);
    fantome.stop(DEFAULT_SETTINGS);
    expect(appels[1]?.masterGainDb).toBe(DEFAULT_SETTINGS.masterGainDb);
  });

  it("se tait sans laisser de main en cours, même sans moteur", () => {
    const fantome = createGhost({ current: null });
    fantome.release();
    expect(fantome.hands.current).toEqual([]);
  });

  it("prépare son rejeu, mais ne joue pas avant la décision de la boucle", async () => {
    const fantome = createGhost({ current: null });
    await fantome.prepare();
    expect(fantome.hands.current).toEqual([]);
    fantome.release();
  });
});
