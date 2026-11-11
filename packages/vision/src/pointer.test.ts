/**
 * Jouer sans caméra (AIR-F-02, parcours P2) : le pointeur et le clavier
 * rendent des `VisionFrame` au même format que la caméra. Aucun DOM ici : les
 * événements et l'horloge sont injectés.
 */
import { describe, expect, it } from "vitest";
import { createKeyboardSource, createPointerSource } from "./pointer.js";
import { INDEX_INDEX } from "./virtual-hand.js";
import { manualClock } from "./testing.js";
import type { VisionFrame } from "./source.js";

interface BancPointeur {
  readonly source: ReturnType<typeof createPointerSource>;
  readonly frames: VisionFrame[];
  readonly horloge: ReturnType<typeof manualClock>;
  deplacer(u: number, v: number, down?: boolean): void;
}

function bancPointeur(options: Parameters<typeof createPointerSource>[1] = {}): BancPointeur {
  const horloge = manualClock();
  let handler: ((sample: { u: number; v: number; down: boolean }) => void) | null = null;
  const frames: VisionFrame[] = [];
  const source = createPointerSource({} as HTMLElement, {
    fps: 30,
    ...options,
    environment: {
      now: horloge.now,
      tick: horloge.tick,
      onPointer: (_cible, surPointeur) => {
        handler = surPointeur;
        return () => {
          handler = null;
        };
      },
      onKey: () => () => undefined,
    },
  });
  source.onFrame((frame) => frames.push(frame));
  return {
    source,
    frames,
    horloge,
    deplacer: (u, v, down = false) => handler?.({ u, v, down }),
  };
}

interface BancClavier {
  readonly source: ReturnType<typeof createKeyboardSource>;
  readonly frames: VisionFrame[];
  touche(code: string, down: boolean): void;
}

function bancClavier(options: Parameters<typeof createKeyboardSource>[0] = {}): BancClavier {
  const horloge = manualClock();
  let handler: ((sample: { code: string; down: boolean }) => void) | null = null;
  const frames: VisionFrame[] = [];
  const source = createKeyboardSource({
    fps: 30,
    ...options,
    environment: {
      now: horloge.now,
      tick: horloge.tick,
      onPointer: () => () => undefined,
      onKey: (_cible, surTouche) => {
        handler = surTouche;
        return () => {
          handler = null;
        };
      },
    },
  });
  source.onFrame((frame) => frames.push(frame));
  return {
    source,
    frames,
    touche: (code, down) => handler?.({ code, down }),
  };
}

function derniereMain(frames: readonly VisionFrame[]) {
  const frame = frames[frames.length - 1];
  return frame?.hands[0];
}

describe("createPointerSource — la souris fait une main", () => {
  it("est une source de mains au même format que la caméra", async () => {
    const banc = bancPointeur();
    expect(banc.source.kind).toBe("pointer");
    await banc.source.start();
    const frame = banc.frames[0];
    expect(frame?.hands).toHaveLength(1);
    expect(frame?.hands[0]?.points).toHaveLength(21);
    expect(frame?.inferenceMs).toBe(0);
    expect(Number.isFinite(frame?.t ?? Number.NaN)).toBe(true);
  });

  it("rien n'est émis avant start (AIR-F-01 : pas de caméra avant le clic)", () => {
    const banc = bancPointeur();
    banc.deplacer(0.5, 0.5);
    expect(banc.frames).toHaveLength(0);
  });

  it("le curseur est le bout de l'index, retourné comme une image en miroir", async () => {
    const banc = bancPointeur();
    await banc.source.start();
    banc.deplacer(0.8, 0.5);
    const main = derniereMain(banc.frames);
    expect(main?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.2, 10);
    expect(main?.points[INDEX_INDEX]?.[1]).toBeCloseTo(0.5, 10);
  });

  it("un appui fait pincer la main, un relâchement l'ouvre", async () => {
    const banc = bancPointeur();
    await banc.source.start();
    banc.deplacer(0.5, 0.5, true);
    const pincee = derniereMain(banc.frames);
    expect(pincee?.points[4]).toEqual(pincee?.points[8]);
    banc.deplacer(0.5, 0.5, false);
    const ouverte = derniereMain(banc.frames);
    expect(ouverte?.points[4]).not.toEqual(ouverte?.points[8]);
  });

  it("le côté demandé est annoncé", async () => {
    const banc = bancPointeur({ side: "left" });
    await banc.source.start();
    expect(derniereMain(banc.frames)?.side).toBe("left");
  });

  it("un battement régulier entretient la main, même curseur immobile", async () => {
    const banc = bancPointeur();
    await banc.source.start();
    banc.deplacer(0.4, 0.4);
    const avant = banc.frames.length;
    banc.horloge.advance(100); // ≈ trois périodes à 30 images/s
    expect(banc.frames.length).toBeGreaterThanOrEqual(avant + 2);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.6, 10);
    expect(banc.frames.every((frame) => Number.isFinite(frame.t))).toBe(true);
  });

  it("stop rend une image sans main et coupe les événements", async () => {
    const banc = bancPointeur();
    await banc.source.start();
    banc.deplacer(0.3, 0.3);
    banc.source.stop();
    const derniere = banc.frames[banc.frames.length - 1];
    expect(derniere?.hands).toEqual([]);
    const compte = banc.frames.length;
    banc.deplacer(0.9, 0.9);
    expect(banc.frames).toHaveLength(compte);
  });

  it("deux start de suite ne doublent pas les abonnements", async () => {
    const banc = bancPointeur();
    await banc.source.start();
    await banc.source.start();
    banc.deplacer(0.4, 0.4);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.6, 10);
  });
});

describe("createKeyboardSource — le clavier joue, sans caméra", () => {
  it("aucune main tant qu'aucune touche n'est tenue", async () => {
    const banc = bancClavier();
    await banc.source.start();
    expect(banc.frames[banc.frames.length - 1]?.hands).toEqual([]);
  });

  it("une touche tenue pose la main sur sa colonne", async () => {
    const banc = bancClavier();
    await banc.source.start();
    banc.touche("KeyA", true);
    const main = derniereMain(banc.frames);
    expect(main).toBeDefined();
    expect(main?.points[INDEX_INDEX]?.[0]).toBeCloseTo(1, 10);
    banc.touche("KeyK", true);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0, 10);
  });

  it("relâcher toutes les touches retire la main : aucune note tenue", async () => {
    const banc = bancClavier();
    await banc.source.start();
    banc.touche("KeyG", true);
    banc.touche("KeyG", false);
    expect(banc.frames[banc.frames.length - 1]?.hands).toEqual([]);
  });

  it("les flèches déplacent la main, les autres touches ne font rien", async () => {
    const banc = bancClavier();
    await banc.source.start();
    banc.touche("ArrowRight", true);
    const apres = derniereMain(banc.frames);
    expect(apres?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.45, 10);
    banc.touche("ArrowUp", true);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[1]).toBeCloseTo(0.45, 10);
    banc.touche("Escape", true);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[1]).toBeCloseTo(0.45, 10);
  });

  it("keyboardVolume : main gauche, colonne fixe, seule la hauteur bouge", async () => {
    const banc = bancClavier({ keyboardVolume: true, side: "left" });
    await banc.source.start();
    banc.touche("KeyK", true);
    expect(derniereMain(banc.frames)?.side).toBe("left");
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.5, 10);
    banc.touche("ArrowDown", true);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[0]).toBeCloseTo(0.5, 10);
    expect(derniereMain(banc.frames)?.points[INDEX_INDEX]?.[1]).toBeCloseTo(0.55, 10);
  });

  it("stop vide les touches tenues et rend une image sans main", async () => {
    const banc = bancClavier();
    await banc.source.start();
    banc.touche("KeyG", true);
    banc.source.stop();
    expect(banc.frames[banc.frames.length - 1]?.hands).toEqual([]);
  });
});
