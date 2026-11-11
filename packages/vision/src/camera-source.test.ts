/**
 * La source caméra (cahier §7.2, AIR-F-03, AIR-F-06, AIR-N-08).
 *
 * Ni DOM, ni caméra, ni modèle : l'environnement est injecté, la vidéo et le
 * flux sont des doubles minimaux. On y prouve le comptage des analyses, les
 * mesures remontées, le conseil « plus de lumière », la pause sur onglet
 * masqué, la caméra débranchée et l'extinction propre.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedHand } from "@thin-air/core";
import { createCameraSource, isNewFrame, presentFramesDefault, type CameraEnvironment } from "./camera-source.js";
import type { Landmarker } from "./landmarker.js";
import { fakeStream, fakeVideo, manualClock, stubCameraDevice } from "./testing.js";
import type { VisionFrame } from "./source.js";

const MAIN_GAUCHE: DetectedHand = { side: "left", score: 0.9, points: [[0.4, 0.5, 0]] };

interface Banc {
  readonly source: ReturnType<typeof createCameraSource>;
  readonly frames: VisionFrame[];
  readonly stats: { frameIntervalMs: number; inferenceMs: number }[];
  readonly conseils: number[];
  readonly horloge: ReturnType<typeof manualClock>;
  readonly analyses: number[];
  readonly pistes: { stop: ReturnType<typeof vi.fn> }[];
  image(mediaTimeS: number): void;
  masquer(): void;
  montrer(): void;
  debrancher(): void;
}

function banc(options: {
  readonly mirrored?: boolean;
  readonly inferenceMs?: number;
  readonly mains?: readonly DetectedHand[];
  readonly thresholdS?: number;
} = {}): Banc {
  const horloge = manualClock();
  const { flux, pistes } = fakeStream();
  const { video } = fakeVideo();
  stubCameraDevice(flux);

  let surImage: ((mediaTimeS: number) => void) | null = null;
  let surVisibilite: ((cache: boolean) => void) | null = null;
  let surFinDePiste: (() => void) | null = null;
  const analyses: number[] = [];
  const landmarker: Landmarker = {
    detect: (_video, timestampMs) => {
      analyses.push(timestampMs);
      return { hands: options.mains ?? [MAIN_GAUCHE], inferenceMs: options.inferenceMs ?? 6 };
    },
    close: vi.fn(),
  };

  const environment: Partial<CameraEnvironment> = {
    now: horloge.now,
    createLandmarker: async () => landmarker,
    presentFrames: (_video, handler) => {
      surImage = handler;
      return () => {
        surImage = null;
      };
    },
    watchVisibility: (cb) => {
      surVisibilite = cb;
      return () => {
        surVisibilite = null;
      };
    },
    watchTrackEnded: (_stream, cb) => {
      surFinDePiste = cb;
      return () => {
        surFinDePiste = null;
      };
    },
  };

  const frames: VisionFrame[] = [];
  const stats: { frameIntervalMs: number; inferenceMs: number }[] = [];
  const conseils: number[] = [];
  const source = createCameraSource(video, {
    mirrored: options.mirrored,
    noHandsThresholdS: options.thresholdS,
    onStats: (mesure) => stats.push(mesure),
    onNoHands: (secondes) => conseils.push(secondes),
    environment,
  });
  source.onFrame((frame) => frames.push(frame));

  return {
    source,
    frames,
    stats,
    conseils,
    horloge,
    analyses,
    pistes,
    image: (mediaTimeS) => surImage?.(mediaTimeS),
    masquer: () => surVisibilite?.(true),
    montrer: () => surVisibilite?.(false),
    debrancher: () => surFinDePiste?.(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCameraSource — AIR-F-03, une image, une analyse", () => {
  it("démarre sur le clic : la caméra est demandée sans audio, puis le modèle", async () => {
    const banc0 = banc();
    expect(banc0.source.state).toBe("idle");
    await banc0.source.start();
    expect(banc0.source.state).toBe("running");
    expect(banc0.source.kind).toBe("camera");
  });

  it("chaque image nouvelle est analysée une fois, avec son horodatage réel", async () => {
    const b = banc();
    await b.source.start();
    b.image(0.5);
    b.image(0.5); // la même image : déjà analysée
    b.image(0.516);
    b.image(0.4); // plus ancienne : ignorée
    expect(b.analyses).toEqual([500, 516]);
    expect(b.frames).toHaveLength(2);
  });

  it("l'horodatage émis est celui de l'image, pas celui de l'analyse", async () => {
    const b = banc();
    await b.source.start();
    b.horloge.advance(900);
    b.image(1.25);
    expect(b.frames[0]?.t).toBeCloseTo(1.25, 10);
    expect(b.frames[0]?.hands).toEqual([MAIN_GAUCHE]);
  });

  it("le temps d'analyse du modèle est mesuré et remonté (§5.1)", async () => {
    const b = banc({ inferenceMs: 11 });
    await b.source.start();
    b.image(0.1);
    b.horloge.advance(20);
    b.image(0.2);
    expect(b.frames[1]?.inferenceMs).toBe(11);
    expect(b.stats[1]).toEqual({ frameIntervalMs: 20, inferenceMs: 11 });
  });

  it("l'intervalle entre images est mesuré ; zéro à la première", async () => {
    const b = banc();
    await b.source.start();
    b.image(0);
    expect(b.stats[0]?.frameIntervalMs).toBe(0);
    b.horloge.advance(16);
    b.image(0.016);
    expect(b.stats[1]?.frameIntervalMs).toBe(16);
  });

  it("AIR-F-04 — les deux mains détectées passent, dans l'ordre du modèle", async () => {
    const deux = banc({
      mains: [
        { side: "left", score: 0.9, points: [[0.2, 0.5, 0]] },
        { side: "right", score: 0.8, points: [[0.7, 0.5, 0]] },
      ],
    });
    await deux.source.start();
    deux.image(0.3);
    expect(deux.frames[0]?.hands).toHaveLength(2);
    expect(deux.frames[0]?.hands.map((main) => main.side)).toEqual(["left", "right"]);
  });

  it.todo(
    "AIR-F-04 — le rôle d'une main est conservé par continuité tant qu'elle n'a pas disparu plus d'une demi-seconde — dépend du lot B1 (core.roles)",
  );

  it("mirrored = true inverse les côtés annoncés (§7.3)", async () => {
    const b = banc({ mirrored: true });
    await b.source.start();
    b.image(0.1);
    expect(b.frames[0]?.hands[0]?.side).toBe("right");
  });

  it("par défaut l'image brute est envoyée au modèle : le côté ne bouge pas", async () => {
    const b = banc();
    await b.source.start();
    b.image(0.1);
    expect(b.frames[0]?.hands[0]?.side).toBe("left");
  });

  it("rien n'est analysé avant start, ni après stop", async () => {
    const b = banc();
    b.image(0.1);
    expect(b.analyses).toEqual([]);
    await b.source.start();
    b.image(0.2);
    b.source.stop();
    b.image(0.3);
    expect(b.analyses).toEqual([200]);
  });

  it("isNewFrame refuse l'image déjà vue et accepte la suivante", () => {
    expect(isNewFrame(1, 1)).toBe(false);
    expect(isNewFrame(1, 0.9)).toBe(false);
    expect(isNewFrame(1, 1.0000001)).toBe(true);
    expect(isNewFrame(-1, 0)).toBe(true);
  });
});

describe("createCameraSource — AIR-F-06, le conseil", () => {
  it("trois secondes d'images sans main conseillent plus de lumière ou de recul", async () => {
    const b = banc({ mains: [] });
    await b.source.start();
    for (let i = 0; i <= 30; i += 1) b.image(i / 10);
    expect(b.conseils).toEqual([3]);
  });

  it("une main vue avant trois secondes coupe le conseil", async () => {
    const b = banc({ mains: [] });
    await b.source.start();
    b.image(0);
    b.image(1);
    expect(b.conseils).toEqual([]);
  });

  it("le seuil est réglable", async () => {
    const b = banc({ mains: [], thresholdS: 1 });
    await b.source.start();
    b.image(0);
    b.image(1.2);
    expect(b.conseils).toEqual([1]);
  });
});

describe("createCameraSource — AIR-N-08, les états clairs", () => {
  it("onglet masqué : la source se met en pause et rend une image sans main", async () => {
    const b = banc();
    await b.source.start();
    b.image(0.5);
    b.masquer();
    expect(b.source.state).toBe("paused");
    const derniere = b.frames[b.frames.length - 1];
    expect(derniere?.hands).toEqual([]);
    expect(derniere?.t).toBeGreaterThan(0.5);
    b.image(0.6);
    expect(b.analyses).toEqual([500]);
  });

  it("onglet revenu : l'analyse reprend sans redemander la caméra", async () => {
    const b = banc();
    await b.source.start();
    b.image(0.5);
    b.masquer();
    b.montrer();
    expect(b.source.state).toBe("running");
    b.image(0.6);
    expect(b.analyses).toEqual([500, 600]);
  });

  it("caméra débranchée ou permission retirée : état arrêté, image sans main", async () => {
    const b = banc();
    await b.source.start();
    b.image(0.5);
    b.debrancher();
    expect(b.source.state).toBe("stopped");
    expect(b.frames[b.frames.length - 1]?.hands).toEqual([]);
    b.image(0.6);
    expect(b.analyses).toEqual([500]);
    b.montrer();
    expect(b.source.state).toBe("stopped");
  });

  it("stop éteint la caméra : les pistes sont arrêtées", async () => {
    const b = banc();
    await b.source.start();
    b.source.stop();
    expect(b.pistes[0]?.stop).toHaveBeenCalledOnce();
  });

  it("stop sans start ne rend aucune image et n'éteint rien", () => {
    const b = banc();
    b.source.stop();
    expect(b.frames).toEqual([]);
    expect(b.pistes[0]?.stop).not.toHaveBeenCalled();
  });

  it("stop est idempotent", async () => {
    const b = banc();
    await b.source.start();
    b.source.stop();
    b.source.stop();
    expect(b.pistes[0]?.stop).toHaveBeenCalledOnce();
  });

  it("un redémarrage garde t croissant même si le flux repart de zéro", async () => {
    const b = banc();
    await b.source.start();
    b.image(2);
    b.source.stop();
    await b.source.start();
    b.image(0.1);
    const instants = b.frames.map((frame) => frame.t);
    for (let i = 1; i < instants.length; i += 1) {
      expect(instants[i]!).toBeGreaterThan(instants[i - 1]!);
    }
  });
});

describe("presentFramesDefault — le repli sur requestAnimationFrame (§7.2)", () => {
  it("utilise requestVideoFrameCallback quand il existe, avec son horodatage réel", () => {
    type Rappel = (now: number, meta: { mediaTime?: number }) => void;
    const rappels: Rappel[] = [];
    const annule = vi.fn();
    const video = {
      requestVideoFrameCallback: (cb: Rappel) => {
        rappels.push(cb);
        return 7;
      },
      cancelVideoFrameCallback: annule,
    };
    const vus: number[] = [];
    const detacher = presentFramesDefault(video as unknown as HTMLVideoElement, (t) => vus.push(t));
    rappels[0]?.(1, { mediaTime: 0.25 });
    rappels[1]?.(2, {}); // pas d'horodatage réel : image ignorée
    expect(vus).toEqual([0.25]);
    detacher();
    expect(annule).toHaveBeenCalled();
  });

  it("sans requestVideoFrameCallback, surveille le temps de la vidéo à chaque rafraîchissement", () => {
    const file: FrameRequestCallback[] = [];
    const annule = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      file.push(cb);
      return file.length;
    });
    vi.stubGlobal("cancelAnimationFrame", annule);
    const video = { currentTime: 0.4 } as unknown as HTMLVideoElement;
    const vus: number[] = [];
    const detacher = presentFramesDefault(video, (t) => vus.push(t));

    file.shift()?.(0);
    file.shift()?.(16); // le temps n'a pas bougé : aucune nouvelle image
    (video as unknown as { currentTime: number }).currentTime = 0.416;
    file.shift()?.(32);

    expect(vus).toEqual([0.4, 0.416]);
    detacher();
    expect(annule).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sans aucun rappel disponible, ne plante pas", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    const video = { currentTime: 0 } as unknown as HTMLVideoElement;
    const detacher = presentFramesDefault(video, () => undefined);
    expect(() => detacher()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
