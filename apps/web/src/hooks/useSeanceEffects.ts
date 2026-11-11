/** Les effets de la séance : persistance, détection MIDI, sonde de retard, boucles. */
import { useEffect } from "react";
import type { PlayRect } from "@thin-air/core";
import { ecrireMine, ecrireRect, ecrireSettings, lireRect } from "../lib/storage.js";
import { isBuiltIn } from "../state/instruments.js";
import { mesurerRetard } from "../state/latencyProbe.js";
import { detecterMidi, type SessionApi } from "./useSession.js";
import { useBoucleJeu } from "./useBoucleJeu.js";
import { useCalibrationLoop } from "./useCalibrationLoop.js";
import type { Miroir } from "../scene/modele.js";
import type { SeanceData } from "./useSeanceData.js";

export interface EffetsDeps {
  readonly session: SessionApi;
  readonly data: SeanceData;
  readonly rect: PlayRect;
  readonly miroir: { current: Miroir };
}

/** AIR-F-54 : les réglages restent sur l'appareil, aucune requête réseau. */
function useSettingsPersistence(session: SessionApi, data: SeanceData): void {
  const { settings, setSettings } = data;
  useEffect(() => {
    ecrireSettings(settings);
    session.setSettings(settings);
  }, [session, settings, setSettings]);
}

/** AIR-F-09 : la zone calibrée est conservée sur l'appareil. */
function useRectPersistence(session: SessionApi, rect: PlayRect): void {
  useEffect(() => {
    session.rectRef.current = rect;
    ecrireRect(rect);
  }, [rect, session]);
  useEffect(() => {
    session.rectRef.current = lireRect();
  }, [session]);
}

/** AIR-F-54 : les instruments de l'utilisateur restent sur l'appareil. */
function useLibraryPersistence(data: SeanceData): void {
  const { library } = data;
  useEffect(() => {
    ecrireMine(library.filter((instrument) => !isBuiltIn(instrument)));
  }, [library]);
}

/** §7.12 : Web MIDI est détecté, la fonction est masquée quand il manque. */
function useMidiDetection(session: SessionApi): void {
  useEffect(() => {
    session.dispatch({ type: "midi", status: detecterMidi() ? "available" : "unavailable" });
  }, [session]);
}

/** AIR-F-31 : le retard affiché est resondé une fois par seconde. */
function useLatencyProbe(session: SessionApi, data: SeanceData): void {
  const { setParts } = data;
  const camera = data.settings.cameraLatencyMs;
  useEffect(() => {
    const sonde = window.setInterval(() => setParts(mesurerRetard(session.engineRef.current, camera)), 1000);
    return () => window.clearInterval(sonde);
  }, [camera, session, setParts]);
}

export function useSeanceEffects(deps: EffetsDeps): void {
  const { session, data, rect, miroir } = deps;
  useSettingsPersistence(session, data);
  useRectPersistence(session, rect);
  useLibraryPersistence(data);
  useMidiDetection(session);
  useLatencyProbe(session, data);
  useBoucleJeu({ session, miroir, etat: session.state, onEvents: data.onEventsRef.current });
  useCalibrationLoop(data.calibration, data.setCalibration, miroir);
}
