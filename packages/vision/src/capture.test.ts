/**
 * Capture (cahier §7.2, AIR-F-01 à 03) : contraintes exactes, erreurs
 * distinctes et lisibles, détection du rappel par image vidéo, repli.
 * Tout est testé sur des doubles minimaux : aucun DOM, aucune caméra.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CaptureError,
  cameraConstraints,
  captureErrorFor,
  hasVideoFrameCallback,
  openCamera,
  stopStream,
} from "./capture.js";

interface PisteFaux {
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function fauxFlux(pistes = 1): { flux: MediaStream; arrets: PisteFaux[] } {
  const arrets: PisteFaux[] = [];
  for (let i = 0; i < pistes; i += 1) {
    arrets.push({ stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  }
  const flux = {
    getTracks: () => arrets,
    getVideoTracks: () => arrets,
  } as unknown as MediaStream;
  return { flux, arrets };
}

function fauxVideo(): HTMLVideoElement & { play: ReturnType<typeof vi.fn> } {
  return {
    srcObject: null,
    currentTime: 0,
    play: vi.fn(async () => undefined),
  } as unknown as HTMLVideoElement & { play: ReturnType<typeof vi.fn> };
}

function stubCamera(getUserMedia: (contraintes: unknown) => Promise<MediaStream>): void {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cameraConstraints — les contraintes du cahier §7.2", () => {
  it("demande 640 × 480, 60 images/s souhaitées, 24 au minimum, caméra frontale", () => {
    expect(cameraConstraints()).toEqual({
      video: {
        width: 640,
        height: 480,
        frameRate: { ideal: 60, min: 24 },
        facingMode: "user",
      },
      audio: false,
    });
  });

  it("AIR-F-56 — jamais d'audio, quelle que soit l'option passée", () => {
    const contraintes = cameraConstraints({ width: 1280, facingMode: "environment" });
    expect(contraintes.audio).toBe(false);
    expect(Object.keys(contraintes)).not.toContain("microphone");
  });

  it("les réglages passés remplacent les défauts", () => {
    const contraintes = cameraConstraints({
      width: 320,
      height: 240,
      frameRateIdeal: 30,
      frameRateMin: 15,
      facingMode: "environment",
    }) as { video: Record<string, unknown> };
    expect(contraintes.video).toEqual({
      width: 320,
      height: 240,
      frameRate: { ideal: 30, min: 15 },
      facingMode: "environment",
    });
  });
});

describe("hasVideoFrameCallback — le point « à vérifier » (annexe D)", () => {
  it("vrai quand le navigateur propose le rappel par image vidéo", () => {
    const video = { requestVideoFrameCallback: () => 1 };
    expect(hasVideoFrameCallback(video)).toBe(true);
  });

  it("faux sinon : c'est le signal du repli sur requestAnimationFrame", () => {
    expect(hasVideoFrameCallback({})).toBe(false);
    expect(hasVideoFrameCallback({ requestVideoFrameCallback: 3 })).toBe(false);
  });

  it("faux sur une valeur absente, sans lever d'exception", () => {
    expect(hasVideoFrameCallback(undefined)).toBe(false);
    expect(hasVideoFrameCallback(null)).toBe(false);
    expect(hasVideoFrameCallback("video")).toBe(false);
  });
});

describe("captureErrorFor — des erreurs distinctes et lisibles", () => {
  it.each([
    ["NotAllowedError", "permission-denied"],
    ["PermissionDeniedError", "permission-denied"],
    ["SecurityError", "permission-denied"],
    ["NotFoundError", "no-camera"],
    ["DevicesNotFoundError", "no-camera"],
    ["OverconstrainedError", "no-camera"],
    ["NotReadableError", "camera-busy"],
    ["TrackStartError", "camera-busy"],
    ["QuelqueChoseDInconnu", "no-camera"],
  ])("%s → %s", (nom, attendu) => {
    const erreur = captureErrorFor({ name: nom });
    expect(erreur).toBeInstanceOf(CaptureError);
    expect(erreur.kind).toBe(attendu);
    expect(erreur.message.length).toBeGreaterThan(20);
    expect(erreur.cause).toEqual({ name: nom });
  });

  it("permission refusée et aucune caméra sont deux états différents", () => {
    expect(captureErrorFor({ name: "NotAllowedError" }).kind).not.toBe(
      captureErrorFor({ name: "NotFoundError" }).kind,
    );
  });

  it("les deux cas renvoient au jeu sans caméra (AIR-F-02)", () => {
    expect(captureErrorFor({ name: "NotAllowedError" }).fallbackToPointer).toBe(true);
    expect(captureErrorFor({ name: "NotFoundError" }).fallbackToPointer).toBe(true);
    expect(captureErrorFor({ name: "NotReadableError" }).fallbackToPointer).toBe(false);
  });
});

describe("openCamera — la demande, sans audio", () => {
  it("attache le flux à la vidéo et lance la lecture", async () => {
    const { flux } = fauxFlux();
    const video = fauxVideo();
    const demandes: unknown[] = [];
    stubCamera(async (contraintes) => {
      demandes.push(contraintes);
      return flux;
    });

    await openCamera(video, { width: 640 });

    expect(demandes).toEqual([
      { video: { width: 640, height: 480, frameRate: { ideal: 60, min: 24 }, facingMode: "user" }, audio: false },
    ]);
    expect(video.srcObject).toBe(flux);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it("permission retirée ou refusée → CaptureError « permission-denied »", async () => {
    const video = fauxVideo();
    stubCamera(async () => {
      throw Object.assign(new Error("refus"), { name: "NotAllowedError" });
    });
    await expect(openCamera(video)).rejects.toMatchObject({ kind: "permission-denied" });
    expect(video.srcObject).toBeNull();
  });

  it("aucune caméra → CaptureError « no-camera »", async () => {
    stubCamera(async () => {
      throw Object.assign(new Error("absente"), { name: "NotFoundError" });
    });
    await expect(openCamera(fauxVideo())).rejects.toMatchObject({ kind: "no-camera" });
  });

  it("navigateur sans mediaDevices (page non sécurisée) → « unsupported »", async () => {
    vi.stubGlobal("navigator", {});
    await expect(openCamera(fauxVideo())).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("lecture refusée → « play-failed », sans laisser croire que l'image est là", async () => {
    const { flux } = fauxFlux();
    const video = {
      srcObject: null,
      play: vi.fn(async () => {
        throw new Error("bloqué");
      }),
    } as unknown as HTMLVideoElement;
    stubCamera(async () => flux);
    await expect(openCamera(video)).rejects.toMatchObject({ kind: "play-failed" });
  });
});

describe("stopStream — la caméra s'éteint vraiment", () => {
  it("arrête toutes les pistes", () => {
    const { flux, arrets } = fauxFlux(2);
    stopStream(flux);
    expect(arrets[0]?.stop).toHaveBeenCalledOnce();
    expect(arrets[1]?.stop).toHaveBeenCalledOnce();
  });

  it("un flux absent ne fait rien", () => {
    expect(() => stopStream(null)).not.toThrow();
    expect(() => stopStream(undefined)).not.toThrow();
  });
});
