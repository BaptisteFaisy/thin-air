/**
 * La logique pure de l'hôte d'analyse (AIR-F-07, AIR-F-03) : protocole, ordre,
 * réponse tardive écartée, repli sur le fil principal. Le worker réel ne se
 * teste pas en CI (pas de Worker ni d'OffscreenCanvas fiables dans ce banc) :
 * sa propriété est marquée `it.todo` avec son identifiant, comme l'exige la
 * convention du dépôt.
 *
 * Tout est injecté : le « worker » est un double qui enregistre les messages
 * reçus et rejoue ceux du protocole — pas de DOM, pas de caméra, pas de modèle.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedHand } from "@thin-air/core";
import type { Landmarker } from "../landmarker.js";
import { fakeVideo } from "../testing.js";
import type { VisionFrame } from "../source.js";
import {
  asError,
  isHostToWorker,
  isWorkerToHost,
  messageOf,
  workerResult,
  type DetectMessage,
} from "./protocol.js";
import { createAnalysisHost, type WorkerLike } from "./host.js";

const MAIN: DetectedHand = { side: "left", score: 0.9, points: [[0.4, 0.5, 0]] };

/** Un double de `Worker` : enregistre ce qui part, rejoue ce qui arrive. */
class FakeWorker implements WorkerLike {
  readonly posted: unknown[] = [];
  readonly transfers: unknown[][] = [];
  onmessage: ((message: MessageEvent) => void) | null = null;
  terminated = false;

  postMessage(message: unknown, transfer?: readonly unknown[]): void {
    this.posted.push(message);
    if (transfer !== undefined) this.transfers.push([...transfer]);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Simule un message du worker vers l'hôte. */
  reply(data: unknown): void {
    this.onmessage?.({ data } as unknown as MessageEvent);
  }
}

/** Les analyses demandées au worker, réduites à l'essentiel. */
function analysesDemandees(worker: FakeWorker | null): { id: number; timestampS: number }[] {
  return ((worker?.posted ?? []) as unknown[])
    .filter((m): m is DetectMessage => (m as { type?: unknown }).type === "detect")
    .map((m) => ({ id: m.id, timestampS: m.timestampS }));
}

/** Attend la fin des microtâches, pour les `await` internes de l'hôte. */
function souffle(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

interface Banc {
  readonly host: ReturnType<typeof createAnalysisHost>;
  readonly getWorker: () => FakeWorker | null;
  readonly getLandmarker: () => Landmarker | null;
  readonly frames: VisionFrame[];
  readonly bitmapCount: () => number;
  readonly createImageBitmap: ReturnType<typeof vi.fn>;
}

function banc(options: { readonly worker?: boolean; readonly offscreen?: boolean } = {}): Banc {
  let worker: FakeWorker | null = null;
  let landmarker: Landmarker | null = null;
  let bitmapCount = 0;

  const createWorker = vi.fn(() => {
    worker = new FakeWorker();
    return worker;
  });
  const createLandmarker = vi.fn(async () => {
    landmarker = {
      detect: vi.fn((_video: unknown, _timestampMs: number) => ({
        hands: [MAIN],
        inferenceMs: 6,
      })),
      close: vi.fn(),
    } as unknown as Landmarker;
    return landmarker;
  });
  const createImageBitmap = vi.fn(async (_source: unknown) => {
    bitmapCount += 1;
    return { close: vi.fn() } as unknown as ImageBitmap;
  });

  const host = createAnalysisHost({
    environment: {
      workerSupported: () => options.worker ?? true,
      offscreenSupported: () => options.offscreen ?? true,
      createWorker,
      createLandmarker,
      createImageBitmap,
    },
  });
  const frames: VisionFrame[] = [];
  host.onFrame((frame) => frames.push(frame));
  return {
    host,
    getWorker: () => worker,
    getLandmarker: () => landmarker,
    frames,
    bitmapCount: () => bitmapCount,
    createImageBitmap,
  };
}

/** Démarre et, en mode worker, joue le `ready` attendu. */
async function demarrer(options = {}): Promise<Banc> {
  const b = banc(options);
  const demarrage = b.host.start();
  await souffle();
  b.getWorker()?.reply({ type: "ready" });
  await demarrage;
  return b;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("protocole (worker/protocol)", () => {
  it("workerResult rend une VisionFrame exacte, horodatée à l'image", () => {
    expect(workerResult(7, 1.5, [MAIN], 4)).toEqual({
      type: "result",
      id: 7,
      frame: { t: 1.5, hands: [MAIN], inferenceMs: 4 },
    });
  });

  it("isWorkerToHost ne valide que les messages du worker", () => {
    expect(isWorkerToHost({ type: "ready" })).toBe(true);
    expect(isWorkerToHost({ type: "result", id: 1, frame: { t: 0, hands: [], inferenceMs: 0 } })).toBe(true);
    expect(isWorkerToHost({ type: "error", message: "x" })).toBe(true);
    expect(isWorkerToHost({ type: "detect" })).toBe(false);
    expect(isWorkerToHost(null)).toBe(false);
    expect(isWorkerToHost({})).toBe(false);
  });

  it("isHostToWorker ne valide que les messages du fil principal", () => {
    expect(isHostToWorker({ type: "init" })).toBe(true);
    expect(isHostToWorker({ type: "detect", id: 1, timestampS: 0, image: {} as ImageBitmap })).toBe(true);
    expect(isHostToWorker({ type: "close" })).toBe(true);
    expect(isHostToWorker({ type: "result" })).toBe(false);
    expect(isHostToWorker("init")).toBe(false);
  });

  it("les erreurs se réduisent à une chaîne et un objet Error", () => {
    expect(messageOf(new Error("échec"))).toBe("échec");
    expect(asError("pépin")).toBeInstanceOf(Error);
    expect(asError(new Error("déjà une erreur")).message).toBe("déjà une erreur");
  });
});

describe("hôte en mode worker (AIR-F-03, AIR-F-07)", () => {
  it("une image, une analyse : la dernière en attente remplace la précédente", async () => {
    const b = await demarrer();
    const { video } = fakeVideo();

    b.host.submit(video, 1.0);
    b.host.submit(video, 2.0);
    b.host.submit(video, 3.0);
    await souffle();

    expect(analysesDemandees(b.getWorker())).toEqual([{ id: 1, timestampS: 1.0 }]);

    b.getWorker()?.reply({
      type: "result",
      id: 1,
      frame: { t: 999, hands: [MAIN], inferenceMs: 5 },
    });
    await souffle();

    // L'image 2.0 est écrasée par la 3.0 : elle n'a jamais été analysée.
    expect(analysesDemandees(b.getWorker())).toEqual([
      { id: 1, timestampS: 1.0 },
      { id: 2, timestampS: 3.0 },
    ]);
    expect(b.frames.map((f) => f.t)).toEqual([1.0]);
    // Deux analyses demandées = deux bitmaps créées, pas trois.
    expect(b.bitmapCount()).toBe(2);
  });

  it("l'horodatage émis est celui de l'image, pas celui de la réponse (AIR-F-03)", async () => {
    const b = await demarrer();
    const { video } = fakeVideo();

    b.host.submit(video, 1.25);
    await souffle();
    b.getWorker()?.reply({ type: "result", id: 1, frame: { t: 987, hands: [MAIN], inferenceMs: 3 } });

    expect(b.frames).toHaveLength(1);
    expect(b.frames[0]?.t).toBe(1.25);
    expect(b.frames[0]?.inferenceMs).toBe(3);
  });

  it("une réponse tardive ou dupliquée est écartée", async () => {
    const b = await demarrer();
    const { video } = fakeVideo();

    b.host.submit(video, 1.0);
    await souffle();

    b.getWorker()?.reply({ type: "result", id: 99, frame: { t: 1.0, hands: [MAIN], inferenceMs: 3 } });
    expect(b.frames).toHaveLength(0);

    b.getWorker()?.reply({ type: "result", id: 1, frame: { t: 1.0, hands: [MAIN], inferenceMs: 3 } });
    expect(b.frames).toHaveLength(1);

    b.getWorker()?.reply({ type: "result", id: 1, frame: { t: 1.0, hands: [MAIN], inferenceMs: 3 } });
    expect(b.frames).toHaveLength(1);
  });

  it("une réponse reçue après stop() est écartée et le worker s'arrête", async () => {
    const b = await demarrer();
    const { video } = fakeVideo();

    b.host.submit(video, 1.0);
    await souffle();

    b.host.stop();
    expect(b.getWorker()?.terminated).toBe(true);
    expect(b.getWorker()?.posted.some((m) => (m as { type?: unknown }).type === "close")).toBe(true);

    b.getWorker()?.reply({ type: "result", id: 1, frame: { t: 1.0, hands: [MAIN], inferenceMs: 3 } });
    expect(b.frames).toHaveLength(0);
  });

  it("la bitmap est transférée au worker, jamais clonée", async () => {
    const b = await demarrer();
    const { video } = fakeVideo();

    b.host.submit(video, 1.0);
    await souffle();

    const dernier = b.getWorker()?.posted.at(-1) as { type: string; image: unknown } | undefined;
    expect(dernier?.type).toBe("detect");
    expect(b.getWorker()?.transfers).toHaveLength(1);
    expect(b.getWorker()?.transfers[0]).toHaveLength(1);
    expect(b.getWorker()?.transfers[0]?.[0]).toBe(dernier?.image);
  });
});

describe("hôte en repli sur le fil principal", () => {
  it("sans Worker, l'analyse se fait dans le fil principal avec la même API", async () => {
    const b = await demarrer({ worker: false });
    const { video } = fakeVideo();

    expect(b.host.mode).toBe("main");
    b.host.submit(video, 1.25);

    expect(b.getWorker()).toBeNull();
    expect(b.getLandmarker()?.detect).toHaveBeenCalledWith(video, 1250);
    expect(b.frames).toEqual([{ t: 1.25, hands: [MAIN], inferenceMs: 6 }]);
  });

  it("sans OffscreenCanvas, repli sur le fil principal même si Worker existe", async () => {
    const b = await demarrer({ worker: true, offscreen: false });
    expect(b.host.mode).toBe("main");
    expect(b.getWorker()).toBeNull();
  });

  it("une image déjà soumise n'est pas ré-analysée (AIR-F-03)", async () => {
    const b = await demarrer({ worker: false });
    const { video } = fakeVideo();

    b.host.submit(video, 1.0);
    b.host.submit(video, 1.0);

    expect(b.getLandmarker()?.detect).toHaveBeenCalledTimes(1);
  });
});

describe("worker réel (hors CI)", () => {
  it.todo("AIR-F-07 — le worker réel charge MediaPipe et renvoie les mains hors du fil principal", () => undefined);
});