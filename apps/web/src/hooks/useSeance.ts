/**
 * La séance assemblée : état, démarrage, boucle d'images, effets et
 * aiguillage des panneaux. Les composants ne font plus qu'afficher.
 */
import { useCallback, useMemo, useRef } from "react";
import type { MusicEvent } from "@thin-air/core";
import { langFrom, messagesFor } from "../i18n/index.js";
import { reduceDisplay } from "../state/display.js";
import { storedRect } from "../state/calibration.js";
import { gestionnaires } from "../state/handlers.js";
import { construireModele, type Miroir } from "../scene/modele.js";
import type { SceneModel } from "../scene/geometry.js";
import type { FrameRequest } from "../scene/SceneCanvas.js";
import { useReducedMotion } from "./useReducedMotion.js";
import { usePointerHands, type PointerState } from "./usePointerHands.js";
import { useSession, type SessionApi } from "./useSession.js";
import { useSeanceData, type SeanceData } from "./useSeanceData.js";
import { useSeanceEffects } from "./useSeanceEffects.js";
import type { PanelHandlers } from "../ui/Panels.js";
import type { Messages } from "../i18n/en.js";

export interface Seance {
  readonly m: Messages;
  readonly reducedMotion: boolean;
  readonly data: SeanceData;
  readonly session: SessionApi;
  readonly modele: (frame: FrameRequest) => SceneModel;
  readonly handlers: PanelHandlers;
  readonly sceneRef: { readonly current: HTMLElement | null };
}

export function useSeance(): Seance {
  const m = useMemo(() => messagesFor(langFrom(typeof window === "undefined" ? "" : window.location.search)), []);
  const reducedMotion = useReducedMotion();
  const data = useSeanceData();
  const miroir = useRef<Miroir>({} as Miroir);
  const precedent = useRef<SceneModel | null>(null);
  const sceneRef = useRef<HTMLElement | null>(null);

  data.onEventsRef.current = useCallback((events: readonly MusicEvent[]) => {
    data.setDisplay((avant) => reduceDisplay(avant, events, miroir.current.instrument));
    if (miroir.current.recording) miroir.current.enregistres.push(...events);
  }, [data]);

  const session = useSession(data.instrument, data.settings, data.onEventsRef.current);
  const rect = storedRect(data.calibration);
  const pointer = usePointerHands(sceneRef, {
    enabled: session.state.mode === "pointer" && session.state.phase === "playing",
    rect,
    instrument: data.instrument,
    onPluck: data.setHovered,
    onPause: () => void session.resumeAudio(),
  });

  majMiroir(miroir, data, session, rect, reducedMotion, pointer);
  useSeanceEffects({ session, data, rect, miroir });

  const modele = useCallback((frame: FrameRequest) => construireModele(miroir.current, precedent, frame), []);
  return { m, reducedMotion, data, session, modele, handlers: gestionnaires({ data, session, m }), sceneRef };
}

/** L'état courant, rassemblé pour la boucle d'images et la calibration. */
function majMiroir(
  miroir: { current: Miroir },
  data: SeanceData,
  session: SessionApi,
  rect: Miroir["rect"],
  reducedMotion: boolean,
  pointer: { readonly current: PointerState },
): void {
  miroir.current = {
    instrument: data.instrument,
    settings: data.settings,
    display: data.display,
    rect,
    reducedMotion,
    loop: data.loop,
    recording: data.loop.recording,
    mode: session.state.mode,
    playing: session.state.phase === "playing",
    handsCount: session.state.hands.count,
    enregistres: data.enregistres.current,
    suivi: miroir.current.suivi ?? null,
    sansMainDepuis: miroir.current.sansMainDepuis ?? null,
    pointer,
    cameraHands: session.handsRef,
    hovered: data.hovered,
  };
}
