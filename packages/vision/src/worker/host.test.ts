/**
 * Les tests de la logique pure du déport d'analyse (cahier §7.3, AIR-F-03,
 * AIR-F-07, AIR-F-31) : protocole, ordre, réponse tardive, repli.
 *
 * Le worker réel (MediaPipe dans un `Worker`) n'est pas pilotable en CI : la
 * preuve d'exécution hors du fil principal reste un `it.todo` nommé. Tout le
 * reste de la logique — file à un emplacement, horodatage de l'image, réponse
 * tardive écartée, repli sur le fil principal — est testé sans DOM, sans
 * caméra et sans modèle, en injectant un faux worker et un faux détecteur.
 */
import { describe, expect, it, vi } from "vitest";
import type { DetectedHand } from "@thin-air/core";
import { createAnalysisHost, type AnalysisHost, type WorkerLike } from "./host.js";
import { FrameGate, type WorkerDetect } from "./protocol.js";
import type { Landmarker } from "../landmarker.js";
import type { VisionFrame } from "../source.js";

const MAIN: DetectedHand = { side: "left", score: 0.9, points: [[0.4, 0.5, 0]] };

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

class FakeWorker implements WorkerLike {
  readonly sent: unknown[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  terminated = false;

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(data: unknown): void {
    this.onmessage?.({ data });
  }
}

interface Banc {
  readonly host: AnalysisHost;
  readonly worker: FakeWorker;
  readonly closes: ReturnType<typeof vi.fn>[];
  readonly detect: ReturnType<typeof vi.fn>;
  readonly frames: VisionFrame[];
}

function banc(options: { supportsWorker?: boolean } = {}): Banc {
  const worker = new FakeWorker();
  const closes: ReturnType<typeof vi.fn>[] = [];
  const detect = vi.fn((_video: unknown, _ts: number) => ({ hands: [MAIN], inferenceMs: 6 }));
  const landmarker: Landmarker = { detect, close: vi.fn() };

  const frames: VisionFrame[] = [];
  const host = createAnalysisHost({
    environment: {
      supportsWorker: () => options.supportsWorker ?? true,
      createWorker: () => worker,
      createBitmap: (video) => {
        void video;
        const close = vi.fn();
        closes.push(close);
        return Promise.resolve({ close } as unknown as ImageBitmap);
      },
      createLandmarker: async () => landmarker,
    },
  });
  host.onFrame((frame) => frames.push(frame));

  return { host, worker, closes, detect, frames };
}

function nbCloses(b: Banc): number {
  return b.closes.filter((close) => close.mock.calls.length > 0).length;
}

describe("FrameGate — une seule analyse par image (AIR-F-03)", () => {
  it("envoie la première image tout de suite", () => {
    const gate = new FrameGate();
    expect(gate.submitReady(7)).toEqual({ action: "send", replaced: null });
    expect(gate.inflight).toBe(7);
  });

  it("met une image en attente pendant qu'une analyse est en vol", () => {
    const gate = new FrameGate();
    gate.submitReady(1);
    expect(gate.submitReady(2)).toEqual({ action: "queued", replaced: null });
    expect(gate.queued).toBe(2);
  });

  it("remplace l'image en attente : la dernière arrivée gagne", () => {
    const gate = new FrameGate();
    gate.submitReady(1); // en vol
    gate.submitReady(2); // en attente
    expect(gate.submitReady(3)).toEqual({ action: "queued", replaced: 2 });
    expect(gate.queued).toBe(3);
  });

  it("accepte la réponse de l'image en vol et libère la suivante", () => {
    const gate = new FrameGate();
    gate.submitReady(1);
    gate.submitReady(2);
    expect(gate.respond(1)).toBe("accepted");
    expect(gate.nextQueued()).toBe(2);
    expect(gate.inflight).toBe(2);
  });

  it("écarte une réponse tardive (AIR-F-03, AIR-F-31)", () => {
    const gate = new FrameGate();
    gate.submitReady(1);
    expect(gate.respond(99)).toBe("late");
    expect(gate.inflight).toBe(1);
  });

  it("reset rend toute réponse future tardive", () => {
    const gate = new FrameGate();
    gate.submitReady(1);
    gate.reset();
    expect(gate.respond(1)).toBe("late");
  });
});

describe("AnalysisHost — mode worker", () => {
  it("passe à `ready` quand le worker a chargé le modèle", async () => {
    const b = banc();
    expect(b.worker.sent[0]).toMatchObject({ kind: "init", protocol: 1 });
    b.worker.respond({ kind: "ready" });
    await expect(b.host.ready).resolves.toBeUndefined();
    expect(b.host.state).toBe("ready");
  });

  it("envoie une image horodatée puis re-émet l'IMAGE, pas la réponse", async () => {
    const b = banc();
    b.worker.respond({ kind: "ready" });
    await b.host.ready;

    b.host.submit({} as HTMLVideoElement, 1.5);
    await flush();

    expect(b.worker.sent).toHaveLength(2);
    const detect = b.worker.sent[1] as WorkerDetect;
    expect(detect).toMatchObject({ kind: "detect", timestampMs: 1500 });

    b.worker.respond({ kind: "result", frameId: detect.frameId, hands: [MAIN], inferenceMs: 12 });
    expect(b.frames).toHaveLength(1);
    expect(b.frames[0]).toMatchObject({ t: 1.5, inferenceMs: 12 });
    expect(b.frames[0]?.hands).toEqual([MAIN]);
  });

  it("n'analyse qu'une fois chaque image : la dernière en attente gagne", async () => {
    const b = banc();
    b.worker.respond({ kind: "ready" });
    await b.host.ready;

    b.host.submit({} as HTMLVideoElement, 1); // en vol
    await flush();
    b.host.submit({} as HTMLVideoElement, 2); // en attente
    await flush();
    b.host.submit({} as HTMLVideoElement, 3); // remplace l'attente précédente
    await flush();

    const detects = () => b.worker.sent.filter((m) => (m as { kind: string }).kind === "detect");
    expect(detects()).toHaveLength(1);
    const firstId = (detects()[0] as WorkerDetect | undefined)?.frameId;
    // La bitmap de l'image 2, remplacée par la 3, est fermée.
    expect(nbCloses(b)).toBe(1);

    b.worker.respond({ kind: "result", frameId: firstId, hands: [MAIN], inferenceMs: 1 });
    await flush();
    expect(detects()).toHaveLength(2);
    expect((detects()[1] as WorkerDetect | undefined)?.timestampMs).toBe(3000);
  });

  it("écarte une réponse tardive : pas de seconde émission pour la même image", async () => {
    const b = banc();
    b.worker.respond({ kind: "ready" });
    await b.host.ready;

    b.host.submit({} as HTMLVideoElement, 1);
    await flush();
    const id = (b.worker.sent[1] as WorkerDetect).frameId;

    b.worker.respond({ kind: "result", frameId: id, hands: [MAIN], inferenceMs: 1 });
    b.worker.respond({ kind: "result", frameId: id, hands: [MAIN], inferenceMs: 1 });
    expect(b.frames).toHaveLength(1);
  });
});

describe("AnalysisHost — repli sur le fil principal", () => {
  it("analyse dans le fil principal quand le worker manque", async () => {
    const b = banc({ supportsWorker: false });
    expect(b.host.mode).toBe("main-thread");
    await b.host.ready;

    b.host.submit({} as HTMLVideoElement, 2);
    expect(b.detect).toHaveBeenCalledTimes(1);
    expect(b.frames).toHaveLength(1);
    expect(b.frames[0]).toMatchObject({ t: 2, inferenceMs: 6 });
  });

  it("retombe sur le fil principal si l'initialisation du worker échoue", async () => {
    const b = banc();
    expect(b.host.mode).toBe("worker");
    b.worker.respond({ kind: "error", frameId: null, message: "chargement impossible" });
    await b.host.ready;
    expect(b.host.mode).toBe("main-thread");
    expect(b.worker.terminated).toBe(true);

    b.host.submit({} as HTMLVideoElement, 3);
    expect(b.detect).toHaveBeenCalledTimes(1);
    expect(b.frames[0]?.t).toBe(3);
  });

  it("ferme proprement : plus aucune analyse ni émission ensuite", async () => {
    const b = banc({ supportsWorker: false });
    await b.host.ready;
    b.host.close();
    b.host.submit({} as HTMLVideoElement, 4);
    expect(b.detect).toHaveBeenCalledTimes(0);
    expect(b.frames).toHaveLength(0);
  });
});

describe("AnalysisHost — worker réel", () => {
  // Le worker réel charge MediaPipe dans un Worker : non pilotable en CI.
  it.todo("AIR-F-07 — l'analyse tourne hors du fil principal (worker réel)");
  it.todo("AIR-F-31 — le temps d'analyse mesuré remonte du worker au fil principal");
});