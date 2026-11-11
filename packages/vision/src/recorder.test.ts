/**
 * Les prises (cahier §7.11, AIR-F-47, AIR-F-57) : le flux des points et rien
 * d'autre — jamais l'image —, un téléchargement purement local, aucune requête.
 */
import { describe, expect, it, vi } from "vitest";
import type { DetectedHand, Take } from "@thin-air/core";
import { frameAt } from "./source.js";
import {
  createTakeRecorder,
  downloadTake,
  takeCarriesPointsOnly,
  takeFilename,
  takeToJson,
} from "./recorder.js";

const MAIN: DetectedHand = {
  side: "left",
  score: 0.93,
  points: Array.from({ length: 21 }, (_, index) => [index / 100, 0.5, 0] as [number, number, number]),
};

function prise(minimal?: Partial<Take>): Take {
  return {
    format: "thin-air-take/1",
    fps: 30,
    frames: [
      { t: 0, hands: [MAIN] },
      { t: 1 / 30, hands: [] },
    ],
    ...(minimal ?? {}),
  };
}

describe("createTakeRecorder — AIR-F-47", () => {
  it("enregistre les images poussées entre start et stop", () => {
    const enregistreur = createTakeRecorder(30);
    enregistreur.start();
    enregistreur.push(frameAt(0, [MAIN], 8));
    enregistreur.push(frameAt(1 / 30, [MAIN], 9));
    const take = enregistreur.stop();
    expect(take.format).toBe("thin-air-take/1");
    expect(take.fps).toBe(30);
    expect(take.frames).toHaveLength(2);
  });

  it("rien n'est enregistré avant start, ni après stop", () => {
    const enregistreur = createTakeRecorder();
    enregistreur.push(frameAt(0, [MAIN]));
    enregistreur.start();
    enregistreur.push(frameAt(0.1, [MAIN]));
    enregistreur.stop();
    enregistreur.push(frameAt(0.2, [MAIN]));
    expect(enregistreur.stop().frames).toHaveLength(1);
  });

  it("start remet la prise à zéro : une prise ne déborde pas sur la suivante", () => {
    const enregistreur = createTakeRecorder();
    enregistreur.start();
    enregistreur.push(frameAt(0, [MAIN]));
    enregistreur.start();
    enregistreur.push(frameAt(0, [MAIN]));
    expect(enregistreur.stop().frames).toHaveLength(1);
  });

  it("ne garde que l'instant, le côté, le score et les points — jamais l'image", () => {
    const enregistreur = createTakeRecorder();
    enregistreur.start();
    const frameAvecBruit = {
      ...frameAt(0.5, [MAIN], 12),
      imageData: "UNE_IMAGE",
      thumbnail: new Uint8Array([1, 2, 3]),
    };
    enregistreur.push(frameAvecBruit);
    const [image] = enregistreur.stop().frames;
    expect(Object.keys(image ?? {})).toEqual(["t", "hands"]);
    expect(Object.keys(image?.hands[0] ?? {})).toEqual(["side", "score", "points"]);
    expect(takeToJson(prise({ frames: [image!] }))).not.toContain("UNE_IMAGE");
  });

  it("le temps d'analyse de la source n'entre pas dans la prise", () => {
    const enregistreur = createTakeRecorder();
    enregistreur.start();
    enregistreur.push(frameAt(0, [MAIN], 42));
    expect(takeToJson(enregistreur.stop())).not.toContain("42");
  });

  it("copie les points : muter la source après coup ne change pas la prise", () => {
    const enregistreur = createTakeRecorder();
    const points: [number, number, number][] = [[0.1, 0.2, 0]];
    const mainMutable: DetectedHand = { side: "right", score: 1, points };
    enregistreur.start();
    enregistreur.push(frameAt(0, [mainMutable], 0));
    points[0] = [9, 9, 9];
    const [image] = enregistreur.stop().frames;
    expect(image?.hands[0]?.points[0]).toEqual([0.1, 0.2, 0]);
  });

  it("seconds mesure la durée enregistrée", () => {
    const enregistreur = createTakeRecorder();
    expect(enregistreur.seconds).toBe(0);
    enregistreur.start();
    enregistreur.push(frameAt(0, [MAIN]));
    enregistreur.push(frameAt(2.5, [MAIN]));
    expect(enregistreur.seconds).toBeCloseTo(2.5, 10);
  });

  it("une cadence absurde retombe sur 30 images/s", () => {
    expect(createTakeRecorder(0).stop().fps).toBe(30);
    expect(createTakeRecorder(-5).stop().fps).toBe(30);
    expect(createTakeRecorder(Number.NaN).stop().fps).toBe(30);
    expect(createTakeRecorder(60).stop().fps).toBe(60);
  });

  it("stop peut être rappelé : la même prise est rendue, sans image en plus", () => {
    const enregistreur = createTakeRecorder();
    enregistreur.start();
    enregistreur.push(frameAt(0, [MAIN]));
    const premiere = enregistreur.stop();
    const seconde = enregistreur.stop();
    expect(seconde.frames).toEqual(premiere.frames);
  });
});

describe("takeCarriesPointsOnly — la preuve de vie privée", () => {
  it("une prise honnête ne porte que des points", () => {
    expect(takeCarriesPointsOnly(prise())).toBe(true);
  });

  it("une clé d'image, un identifiant ou une miniature la font refuser", () => {
    const avecImage = { ...prise(), image: "data:" } as unknown as Take;
    expect(takeCarriesPointsOnly(avecImage)).toBe(false);
    const imageBruyante = {
      ...prise(),
      frames: [{ t: 0, hands: [MAIN], jpeg: new Uint8Array([1]) }],
    } as unknown as Take;
    expect(takeCarriesPointsOnly(imageBruyante)).toBe(false);
    const mainBruyante = {
      ...prise(),
      frames: [{ t: 0, hands: [{ ...MAIN, deviceId: "abc" }] }],
    } as unknown as Take;
    expect(takeCarriesPointsOnly(mainBruyante)).toBe(false);
  });

  it("un point qui n'est pas un triplet de nombres finis est refusé", () => {
    const casse = {
      ...prise(),
      frames: [{ t: 0, hands: [{ ...MAIN, points: [[0.1, Number.NaN, 0]] }] }],
    } as unknown as Take;
    expect(takeCarriesPointsOnly(casse)).toBe(false);
  });

  it("une prise vide reste conforme", () => {
    expect(takeCarriesPointsOnly(prise({ frames: [] }))).toBe(true);
  });
});

describe("le poids de la prise (§7.11)", () => {
  it.todo(
    "AIR-P-20 — coder puis décoder une prise en entiers de 16 bits conserve les points au pas de codage près — dépend du lot A4 (schema.encodeTake/decodeTake)",
  );
});

describe("takeToJson et takeFilename", () => {
  it("l'aller-retour JSON rend exactement la prise", () => {
    const take = prise();
    expect(JSON.parse(takeToJson(take))).toEqual(take);
  });

  it("un nom fourni est respecté, sinon un nom déterministe", () => {
    expect(takeFilename(prise(), "ma-prise.json")).toBe("ma-prise.json");
    expect(takeFilename(prise())).toBe("thin-air-take-2frames.json");
    expect(takeFilename(prise(), "   ")).toBe("thin-air-take-2frames.json");
  });
});

describe("downloadTake — local, sans aucun envoi (AIR-F-57)", () => {
  it("écrit un blob JSON et propose le fichier, sans requête réseau", () => {
    const fetchEspion = vi.fn();
    vi.stubGlobal("fetch", fetchEspion);
    const appels: string[] = [];
    downloadTake(prise(), "prise.json", {
      createBlobUrl: (json) => {
        appels.push(`blob:${json.length}`);
        return "blob:local";
      },
      releaseBlobUrl: (url) => appels.push(`libere:${url}`),
      saveAs: (url, filename) => appels.push(`save:${url}:${filename}`),
    });
    expect(appels[0]).toMatch(/^blob:/);
    expect(appels[1]).toBe("save:blob:local:prise.json");
    expect(appels[2]).toBe("libere:blob:local");
    expect(fetchEspion).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("l'URL est libérée même si le téléchargement échoue", () => {
    const release = vi.fn();
    expect(() =>
      downloadTake(prise(), "prise.json", {
        createBlobUrl: () => "blob:local",
        releaseBlobUrl: release,
        saveAs: () => {
          throw new Error("refusé");
        },
      }),
    ).toThrow("refusé");
    expect(release).toHaveBeenCalledOnce();
  });

  it("aucun chemin réseau dans le contenu écrit", () => {
    const json = takeToJson(prise());
    expect(json).not.toMatch(/https?:\/\//);
    expect(json).not.toContain("fetch");
  });
});
