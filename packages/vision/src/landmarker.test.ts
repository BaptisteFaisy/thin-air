/**
 * L'enveloppe du modèle (cahier §7.3) : seuils par défaut, GPU avec repli CPU,
 * `detect` synchrone et mesuré, modèle servi par le site — jamais un tiers.
 *
 * Aucun de ces tests ne charge MediaPipe ni le wasm : l'usine de détecteur est
 * injectée. C'est ce qui rend le repli GPU → CPU prouvable hors navigateur.
 */
import { describe, expect, it, vi } from "vitest";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  DEFAULT_CONFIDENCE,
  DEFAULT_MODEL_URL,
  DEFAULT_WASM_ROOT,
  createWithCpuFallback,
  loadLandmarker,
  wrapDetector,
  type DetectorFactory,
  type RawLandmarker,
} from "./landmarker.js";

const RESULTAT_VIDE = {
  landmarks: [],
  worldLandmarks: [],
  handedness: [],
  handednesses: [],
} as unknown as HandLandmarkerResult;

function fauxDetecteur(
  options: { readonly inferenceMs?: number; readonly onDetect?: (ts: number) => void } = {},
): RawLandmarker {
  let temps = 0;
  return {
    detectForVideo: (_video: unknown, timestampMs: number) => {
      options.onDetect?.(timestampMs);
      return RESULTAT_VIDE;
    },
    close: vi.fn(),
    /** Horloge interne du double : avance de `inferenceMs` à chaque appel. */
    get temps() {
      return temps;
    },
  } as RawLandmarker;
}

describe("les chemins du site (AIR-N-01)", () => {
  it("le modèle est servi par le site, en chemin relatif", () => {
    expect(DEFAULT_MODEL_URL).toBe("/models/hand_landmarker.task");
    expect(DEFAULT_MODEL_URL.startsWith("/")).toBe(true);
    expect(DEFAULT_MODEL_URL).not.toMatch(/^https?:/);
  });

  it("les fichiers d'exécution viennent du site aussi (§11.9)", () => {
    expect(DEFAULT_WASM_ROOT).toBe("/models/wasm");
  });

  it("les seuils de confiance sont à leur valeur par défaut (§7.3)", () => {
    expect(DEFAULT_CONFIDENCE).toBe(0.5);
  });
});

describe("createWithCpuFallback — AIR-N-07", () => {
  it("le processeur graphique est essayé en premier", async () => {
    const essais: string[] = [];
    const factory: DetectorFactory = async (delegate) => {
      essais.push(delegate);
      return fauxDetecteur();
    };
    const retenu = await createWithCpuFallback(factory);
    expect(essais).toEqual(["GPU"]);
    expect(retenu.delegate).toBe("GPU");
  });

  it("sans accélération graphique, le processeur prend le relais", async () => {
    const essais: string[] = [];
    const factory: DetectorFactory = async (delegate) => {
      essais.push(delegate);
      if (delegate === "GPU") throw new Error("WebGL indisponible");
      return fauxDetecteur();
    };
    const retenu = await createWithCpuFallback(factory);
    expect(essais).toEqual(["GPU", "CPU"]);
    expect(retenu.delegate).toBe("CPU");
  });

  it("un délégué explicitement demandé est respecté, sans repli", async () => {
    const essais: string[] = [];
    const factory: DetectorFactory = async (delegate) => {
      essais.push(delegate);
      return fauxDetecteur();
    };
    expect((await createWithCpuFallback(factory, "CPU")).delegate).toBe("CPU");
    expect(essais).toEqual(["CPU"]);
  });

  it("un processeur graphique explicitement demandé ne retombe pas", async () => {
    const factory: DetectorFactory = async () => {
      throw new Error("WebGL indisponible");
    };
    await expect(createWithCpuFallback(factory, "GPU")).rejects.toThrow("WebGL indisponible");
  });
});

describe("wrapDetector — detect est synchrone et mesuré (§5.1)", () => {
  it("mesure le temps d'analyse autour de l'appel", () => {
    let horloge = 100;
    const brut: RawLandmarker = {
      detectForVideo: () => {
        horloge += 7;
        return RESULTAT_VIDE;
      },
      close: () => undefined,
    };
    const landmarker = wrapDetector(brut, "CPU", () => horloge);
    const resultat = landmarker.detect({} as HTMLVideoElement, 10);
    expect(resultat.inferenceMs).toBe(7);
    expect(resultat.hands).toEqual([]);
  });

  it("l'horodatage transmis au modèle est strictement croissant", () => {
    const recus: number[] = [];
    const brut: RawLandmarker = {
      detectForVideo: (_v, ts) => {
        recus.push(ts);
        return RESULTAT_VIDE;
      },
      close: () => undefined,
    };
    const landmarker = wrapDetector(brut, "GPU", () => 0);
    const video = {} as HTMLVideoElement;
    landmarker.detect(video, 16);
    landmarker.detect(video, 16);
    landmarker.detect(video, 12);
    landmarker.detect(video, 48);
    expect(recus).toEqual([16, 17, 18, 48]);
  });

  it("rend les mains traduites du résultat brut", () => {
    const brut: RawLandmarker = {
      detectForVideo: () =>
        ({
          landmarks: [Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))],
          worldLandmarks: [],
          handedness: [[{ score: 0.9, index: 0, categoryName: "Left", displayName: "Left" }]],
          handednesses: [],
        }) as unknown as HandLandmarkerResult,
      close: () => undefined,
    };
    const { hands } = wrapDetector(brut, "CPU", () => 0).detect({} as HTMLVideoElement, 1);
    expect(hands).toHaveLength(1);
    expect(hands[0]?.side).toBe("left");
    expect(hands[0]?.points).toHaveLength(21);
  });

  it("close ferme le détecteur, et deux fermetures ne font rien de plus", () => {
    const close = vi.fn();
    const landmarker = wrapDetector({ detectForVideo: () => RESULTAT_VIDE, close }, "CPU", () => 0);
    landmarker.close();
    landmarker.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("analyser après fermeture est une erreur claire, pas un silence", () => {
    const landmarker = wrapDetector(fauxDetecteur(), "CPU", () => 0);
    landmarker.close();
    expect(() => landmarker.detect({} as HTMLVideoElement, 1)).toThrow(/fermé/);
  });
});

describe("loadLandmarker — l'enveloppe complète", () => {
  it("construit le détecteur sans charger le paquet MediaPipe si l'usine est fournie", async () => {
    const factory = vi.fn(async () => fauxDetecteur());
    const landmarker = await loadLandmarker({ createDetector: factory });
    expect(factory).toHaveBeenCalledOnce();
    expect(landmarker.detect({} as HTMLVideoElement, 5).hands).toEqual([]);
  });

  it("signale l'avancement du chargement de 0 à 1", async () => {
    const etapes: number[] = [];
    await loadLandmarker({
      createDetector: async () => fauxDetecteur(),
      onProgress: (ratio) => etapes.push(ratio),
    });
    expect(etapes[0]).toBe(0);
    expect(etapes[etapes.length - 1]).toBe(1);
    expect(etapes.every((ratio) => ratio >= 0 && ratio <= 1)).toBe(true);
  });

  it("demande le processeur, puis le processeur de secours en cas d'échec", async () => {
    const essais: string[] = [];
    await loadLandmarker({
      createDetector: async (delegate) => {
        essais.push(delegate);
        if (delegate === "GPU") throw new Error("pas de GPU");
        return fauxDetecteur();
      },
    });
    expect(essais).toEqual(["GPU", "CPU"]);
  });

  it("le délégué retenu est lisible et l'analyse est mesurée", async () => {
    const landmarker = await loadLandmarker({ createDetector: async () => fauxDetecteur() });
    expect(landmarker.detect({} as HTMLVideoElement, 1).inferenceMs).toBeGreaterThanOrEqual(0);
    expect((landmarker as { delegate?: string }).delegate).toBe("GPU");
  });

  it("une erreur des deux côtés remonte telle quelle", async () => {
    await expect(
      loadLandmarker({
        createDetector: async () => {
          throw new Error("modèle introuvable");
        },
      }),
    ).rejects.toThrow("modèle introuvable");
  });
});
