import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import {
  ghostMayPlay,
  initialUiState,
  LOOP_CAPACITY,
  modelPercent,
  mustReleaseAll,
  notices,
  pointerPlaying,
  reduceAll,
  reduceUi,
  type UiEvent,
} from "./machine.js";

const demarrage: readonly UiEvent[] = [{ type: "start" }, { type: "cameraGranted" }, { type: "modelReady" }];

describe("machine à états de l'écran (§12.2)", () => {
  it("avant le démarrage : rien n'est demandé, aucune note", () => {
    const etat = initialUiState();
    expect(etat.phase).toBe("idle");
    expect(etat.camera).toBe("before");
    expect(etat.audio).toBe("closed");
    expect(mustReleaseAll(etat)).toBe(true);
  });

  it("AIR-F-01 — « Start » demande la caméra avant toute autre chose", () => {
    const etat = reduceUi(initialUiState(), { type: "start" });
    expect(etat.phase).toBe("starting");
    expect(etat.camera).toBe("requesting");
    expect(etat.mode).toBe("camera");
  });

  it("AIR-F-02 — caméra refusée : le jeu bascule au pointeur, l'écran le dit", () => {
    const etat = reduceAll(initialUiState(), [{ type: "start" }, { type: "cameraDenied" }]);
    expect(etat.mode).toBe("pointer");
    expect(etat.phase).toBe("playing");
    expect(pointerPlaying(etat)).toBe(true);
    expect(notices(etat)).toContain("cameraDenied");
  });

  it("AIR-F-02 — aucune caméra trouvée : même repli, message distinct", () => {
    const etat = reduceAll(initialUiState(), [{ type: "start" }, { type: "cameraAbsent" }]);
    expect(notices(etat)).toContain("cameraAbsent");
    expect(pointerPlaying(etat)).toBe(true);
  });

  it("§12.2 — le chargement du modèle porte sa progression", () => {
    const etat = reduceAll(initialUiState(), [
      { type: "modelLoading" },
      { type: "modelProgress", ratio: 0.42 },
    ]);
    expect(etat.modelStatus).toBe("loading");
    expect(modelPercent(etat)).toBe(42);
    expect(notices(etat)).toContain("modelLoading");
  });

  it("§12.2 — une progression hors bornes est ramenée entre 0 et 1", () => {
    expect(modelPercent(reduceUi(initialUiState(), { type: "modelProgress", ratio: 4 }))).toBe(100);
    expect(modelPercent(reduceUi(initialUiState(), { type: "modelProgress", ratio: Number.NaN }))).toBe(0);
  });

  it("§12.2 — modèle en échec : jeu au pointeur avec le même moteur", () => {
    const etat = reduceAll(initialUiState(), [{ type: "start" }, { type: "modelFailed" }]);
    expect(etat.modelStatus).toBe("failed");
    expect(etat.mode).toBe("pointer");
    expect(notices(etat)).toContain("modelFailed");
  });

  it("§12.2 — zéro, une ou deux mains, et la main au bord", () => {
    const aucune = reduceUi(initialUiState(), { type: "hands", count: 0, atEdge: false });
    expect(aucune.hands.count).toBe(0);
    const deux = reduceUi(aucune, { type: "hands", count: 2, atEdge: true });
    expect(deux.hands.count).toBe(2);
    expect(deux.hands.atEdge).toBe(true);
    const enJeu = reduceAll(initialUiState(), [...demarrage, { type: "hands", count: 2, atEdge: true }]);
    expect(notices(enJeu)).toContain("handAtEdge");
    expect(notices(enJeu)).not.toContain("noHands");
  });

  it("§12.2 — un compte de mains invraisemblable reste dans 0, 1 ou 2", () => {
    expect(reduceUi(initialUiState(), { type: "hands", count: 7, atEdge: false }).hands.count).toBe(2);
    expect(reduceUi(initialUiState(), { type: "hands", count: -3, atEdge: false }).hands.count).toBe(0);
  });

  it("AIR-F-16 — onglet masqué ou audio suspendu : toutes les voix se relâchent", () => {
    const enJeu = reduceAll(initialUiState(), [...demarrage, { type: "audio", status: "running" }]);
    expect(mustReleaseAll(enJeu)).toBe(false);
    expect(mustReleaseAll(reduceUi(enJeu, { type: "visibility", hidden: true }))).toBe(true);
    expect(mustReleaseAll(reduceUi(enJeu, { type: "audio", status: "suspended" }))).toBe(true);
    expect(notices(reduceUi(enJeu, { type: "visibility", hidden: true }))).toContain("tabHidden");
  });

  it("AIR-F-32 — sortie sans fil probable au-delà du seuil des réglages", () => {
    const enJeu = reduceAll(initialUiState(), [...demarrage, { type: "latency", outputMs: 180 }]);
    expect(notices(enJeu, { wirelessWarnMs: DEFAULT_SETTINGS.wirelessWarnMs })).toContain("wirelessOutput");
    const filaire = reduceUi(enJeu, { type: "latency", outputMs: 12 });
    expect(notices(filaire, { wirelessWarnMs: DEFAULT_SETTINGS.wirelessWarnMs })).not.toContain("wirelessOutput");
  });

  it("§12.2 — boucle pleine à six couches, capacité lue de `core.loop`", () => {
    expect(LOOP_CAPACITY).toBe(6);
    const pleine = reduceUi(initialUiState(), { type: "layers", count: 6 });
    expect(notices(pleine)).toContain("loopFull");
    expect(reduceUi(pleine, { type: "layers", count: 99 }).layers).toBe(6);
  });

  it("§12.2 — MIDI indisponible : la fonction est masquée", () => {
    const etat = reduceUi(initialUiState(), { type: "midi", status: "unavailable" });
    expect(notices(etat)).toContain("midiUnavailable");
    expect(notices(reduceUi(etat, { type: "midi", status: "available" }))).not.toContain("midiUnavailable");
  });

  it("AIR-F-43 — un fichier d'instrument refusé porte sa raison", () => {
    const etat = reduceUi(initialUiState(), { type: "instrumentRejected", reason: "format" });
    expect(etat.rejection).toBe("format");
    expect(notices(etat)).toContain("instrumentRejected");
    expect(reduceUi(etat, { type: "instrumentAccepted" }).rejection).toBeNull();
  });

  it("AIR-F-50 — le fantôme ne joue que sans main, onglet visible", () => {
    const enJeu = reduceAll(initialUiState(), [...demarrage, { type: "audio", status: "running" }]);
    expect(ghostMayPlay(enJeu)).toBe(true);
    expect(ghostMayPlay(reduceUi(enJeu, { type: "hands", count: 1, atEdge: false }))).toBe(false);
    expect(ghostMayPlay(reduceUi(enJeu, { type: "visibility", hidden: true }))).toBe(false);
    expect(ghostMayPlay(initialUiState())).toBe(false);
  });

  it("§12.2 — un même état ne produit jamais deux fois le même message", () => {
    const etat = reduceAll(initialUiState(), [
      { type: "start" },
      { type: "cameraDenied" },
      { type: "modelFailed" },
      { type: "hands", count: 0, atEdge: false },
    ]);
    const ids = notices(etat, { cameraOk: true, quiet: true });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("« stop » rend l'état initial sans oublier la caméra ni le MIDI", () => {
    const etat = reduceAll(initialUiState(), [...demarrage, { type: "midi", status: "available" }]);
    const arret = reduceUi(etat, { type: "stop" });
    expect(arret.phase).toBe("idle");
    expect(arret.camera).toBe("granted");
    expect(arret.midi).toBe("available");
  });
});
