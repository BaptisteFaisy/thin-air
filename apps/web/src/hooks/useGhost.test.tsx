// @vitest-environment happy-dom
/**
 * AIR-F-01 — avant le clic « Start », rien ne prépare le fantôme, donc aucun
 * son ne peut sortir de lui. Le rejeu (`createReplaySource`) n'est chargé
 * qu'après le démarrage de la séance ; à l'idle, le fantôme reste endormi.
 * Aucun `AudioContext` n'est créé ici : le moteur et la vision sont remplacés
 * par un double minimal (AIR-N-02).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { createReplaySource } from "@thin-air/vision";
import { useGhost } from "./useGhost.js";
import type { SessionApi } from "./useSession.js";

vi.mock("@thin-air/vision", () => ({
  createReplaySource: vi.fn(() => ({
    onFrame: vi.fn(),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
  })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Un double de séance : assez pour le hook, sans caméra ni moteur. */
function sessionEnPhase(phase: "idle" | "playing"): SessionApi {
  return {
    engineRef: { current: null },
    state: { phase, ghost: "idle" },
  } as unknown as SessionApi;
}

function Monte({ session }: { readonly session: SessionApi }): null {
  useGhost(session, DEFAULT_SETTINGS);
  return null;
}

/** Monte le hook dans un vrai rendu, rend un démontage à appeler dans `act`. */
async function monter(session: SessionApi): Promise<{ demontage: () => Promise<void> }> {
  const conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  const racine = createRoot(conteneur);
  await act(async () => {
    racine.render(<Monte session={session} />);
  });
  return {
    demontage: async () => {
      await act(async () => racine.unmount());
      conteneur.remove();
    },
  };
}

describe("AIR-F-01 — aucun son avant le clic Start", () => {
  beforeEach(() => {
    vi.mocked(createReplaySource).mockClear();
  });

  it("ne monte pas le rejeu du fantôme tant que la séance est à l'idle", async () => {
    const { demontage } = await monter(sessionEnPhase("idle"));
    await act(async () => {});
    expect(createReplaySource).not.toHaveBeenCalled();
    await demontage();
  });

  it("prépare le rejeu une fois la séance démarrée", async () => {
    const { demontage } = await monter(sessionEnPhase("playing"));
    await act(async () => {});
    expect(createReplaySource).toHaveBeenCalled();
    await demontage();
  });
});
