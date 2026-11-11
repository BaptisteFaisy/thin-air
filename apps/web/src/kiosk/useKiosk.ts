/**
 * Le câblage de la borne : la caméra, le modèle, la prise rejouée, le moteur
 * et la machine à états, rassemblés derrière un seul hook. `Kiosk.tsx` ne
 * fait qu'afficher. Chaque fonction tient sous cinquante lignes.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { DetectedHand, Instrument, MusicEvent, PlayRect, Settings } from "@thin-air/core";
import { DEFAULT_SETTINGS, defaultPlayRect } from "@thin-air/core";
import { createEngine, type Engine } from "../lib/engine.js";
import { createTracking, type Tracking } from "../lib/tracking.js";
import { releaseAll, tick } from "../lib/gameLoop.js";
import { ASPECT, construireModele, sonnerie, type Miroir } from "../scene/modele.js";
import type { HandInput, SceneModel } from "../scene/geometry.js";
import type { FrameRequest } from "../scene/SceneCanvas.js";
import { emptyDisplay, reduceDisplay, type StageDisplay } from "../state/display.js";
import { emptyLoop } from "../state/loopState.js";
import type { PointerState } from "../hooks/usePointerHands.js";
import { mainsToInputs, MODEL_URL } from "../hooks/useSession.js";
import { useReducedMotion } from "../hooks/useReducedMotion.js";
import { ghostSettings, kioskInstrument, kioskSettings, priseFantome } from "./kiosk.js";
import {
  initialKioskState,
  reduceKiosk,
  type KioskAction,
  type KioskEvent,
  type KioskFault,
  type KioskState,
} from "./kioskState.js";

const POINTEUR_INACTIF: PointerState = { u: 0.5, v: 0.5, active: false, hovered: null };

/** Tout ce que la borne partage entre ses effets, dans des refs mutables. */
interface Contexte {
  videoRef: RefObject<HTMLVideoElement | null>;
  engineRef: { current: Engine | null };
  suiviRef: { current: Tracking | null };
  replayRef: { current: { start(): Promise<void>; stop(): void } | null };
  sourceRef: { current: { stop(): void } | null };
  cameraRef: { current: readonly DetectedHand[] };
  fantomeRef: { current: readonly DetectedHand[] };
  mainsRef: { current: readonly HandInput[] };
  displayRef: { current: StageDisplay };
  machineRef: { current: KioskState };
  fileRef: { current: KioskEvent[] };
  rectRef: { current: PlayRect };
  reducedMotionRef: { current: boolean };
  miroirRef: { current: Miroir };
  precedentRef: { current: SceneModel | null };
}

function creerContexte(): Contexte {
  return {
    videoRef: { current: null },
    engineRef: { current: null },
    suiviRef: { current: null },
    replayRef: { current: null },
    sourceRef: { current: null },
    cameraRef: { current: [] },
    fantomeRef: { current: [] },
    mainsRef: { current: [] },
    displayRef: { current: emptyDisplay() },
    machineRef: { current: initialKioskState() },
    fileRef: { current: [] },
    rectRef: { current: defaultPlayRect() },
    reducedMotionRef: { current: false },
    miroirRef: { current: {} as Miroir },
    precedentRef: { current: null },
  };
}

/** Les mains à traiter : celles de la personne, sinon celles du fantôme. */
function mainsPour(
  machine: KioskState,
  camera: readonly DetectedHand[],
  fantome: readonly DetectedHand[],
): readonly DetectedHand[] {
  if (machine.phase === "occupied") return camera;
  return machine.ghost ? fantome : [];
}

/** Un battement de jeu : suivi → événements → moteur, ou relâchement (AIR-F-16). */
function pasDeJeu(
  t: number,
  mains: readonly DetectedHand[],
  ctx: Contexte,
  instrument: Instrument,
  settings: Settings,
  onEvents: (events: readonly MusicEvent[]) => void,
): void {
  if (ctx.suiviRef.current === null && ctx.engineRef.current !== null) {
    ctx.suiviRef.current = createTracking(instrument, settings, ctx.rectRef.current, ASPECT);
  }
  const suivi = ctx.suiviRef.current;
  if (suivi === null) return;
  if (ctx.machineRef.current.tabHidden) releaseAll(t, suivi, sonnerie(ctx.engineRef.current), onEvents);
  else tick(t, mains, suivi, sonnerie(ctx.engineRef.current), onEvents);
}

/** Met à jour ce que la scène lit, tel que `construireModele` l'attend. */
function majMiroir(
  ctx: Contexte,
  instrument: Instrument,
  settings: Settings,
  reducedMotion: boolean,
): void {
  ctx.miroirRef.current = {
    instrument,
    settings,
    display: ctx.displayRef.current,
    rect: ctx.rectRef.current,
    reducedMotion,
    loop: emptyLoop(settings),
    recording: false,
    mode: "camera",
    playing: true,
    handsCount: ctx.mainsRef.current.length,
    enregistres: [],
    suivi: ctx.suiviRef.current,
    sansMainDepuis: null,
    pointer: { current: POINTEUR_INACTIF },
    cameraHands: ctx.mainsRef,
    hovered: null,
  };
}

/** Le moteur, puis la prise à rejouer en boucle, à la demande (AIR-F-01). */
async function demarrerMoteur(
  ctx: Contexte,
  instrument: Instrument,
  settings: Settings,
  annule: () => boolean,
): Promise<void> {
  const engine = await createEngine(instrument, settings);
  if (annule()) {
    engine.close();
    return;
  }
  ctx.engineRef.current = engine;
  engine.setSettings(settings);
  const vision = await import("@thin-air/vision");
  if (annule()) return;
  const replay = vision.createReplaySource(priseFantome(), { loop: true });
  replay.onFrame((frame) => {
    ctx.fantomeRef.current = frame.hands;
  });
  ctx.replayRef.current = replay;
}

/** La caméra puis le modèle ; chaque panne devient un événement de la machine. */
async function demarrerCamera(ctx: Contexte, annule: () => boolean): Promise<void> {
  const vision = await import("@thin-air/vision");
  if (annule()) return;
  const video = ctx.videoRef.current;
  try {
    if (video === null) throw new Error("video");
    await vision.openCamera(video, { frameRateIdeal: DEFAULT_SETTINGS.frameRateIdeal });
    const flux = video.srcObject as MediaStream | null;
    flux?.getVideoTracks().forEach((piste) =>
      piste.addEventListener("ended", () => ctx.fileRef.current.push({ type: "cameraLost" })),
    );
  } catch {
    ctx.fileRef.current.push({ type: "cameraDenied" });
    return;
  }
  try {
    await vision.loadLandmarker({ modelUrl: MODEL_URL, numHands: 2 });
    const source = vision.createCameraSource(video, {
      frameRateIdeal: DEFAULT_SETTINGS.frameRateIdeal,
      onStats: () => undefined,
    });
    await source.start();
    if (annule()) {
      source.stop();
      return;
    }
    ctx.sourceRef.current = source;
    source.onFrame((frame) => {
      ctx.cameraRef.current = vision.normaliseSides(frame.hands, true);
    });
    ctx.fileRef.current.push({ type: "cameraBack", atMs: performance.now() });
  } catch {
    ctx.fileRef.current.push({ type: "modelError" });
  }
}

/** Une action décidée par la machine, exécutée par la borne. */
async function appliqueAction(
  ctx: Contexte,
  settings: Settings,
  setFault: (fault: KioskFault | null) => void,
  action: KioskAction,
): Promise<void> {
  switch (action) {
    case "ghostStart":
      void ctx.replayRef.current?.start();
      ctx.engineRef.current?.setSettings(ghostSettings(settings));
      break;
    case "ghostStop":
      ctx.replayRef.current?.stop();
      ctx.engineRef.current?.setSettings(settings);
      break;
    case "releaseAll":
      if (ctx.suiviRef.current !== null) {
        releaseAll(performance.now() / 1000, ctx.suiviRef.current, sonnerie(ctx.engineRef.current), () => undefined);
      }
      break;
    case "messageShow":
      setFault(ctx.machineRef.current.fault);
      break;
    case "messageHide":
      setFault(null);
      break;
    default:
      break;
  }
}

/** La boucle d'images : événements du monde → machine → actions → scène. */
function roule(
  ctx: Contexte,
  instrument: Instrument,
  settings: Settings,
  setFault: (fault: KioskFault | null) => void,
): () => void {
  let actif = true;
  const onEvents = (events: readonly MusicEvent[]) => {
    ctx.displayRef.current = reduceDisplay(ctx.displayRef.current, events, instrument);
  };
  const passer = (evenement: KioskEvent) => {
    const transition = reduceKiosk(ctx.machineRef.current, evenement);
    ctx.machineRef.current = transition.state;
    transition.actions.forEach((action) => void appliqueAction(ctx, settings, setFault, action));
  };
  const image = (maintenant: number) => {
    if (!actif) return;
    let enAttente = ctx.fileRef.current.shift();
    while (enAttente !== undefined) {
      passer(enAttente);
      enAttente = ctx.fileRef.current.shift();
    }
    const mains = mainsPour(ctx.machineRef.current, ctx.cameraRef.current, ctx.fantomeRef.current);
    ctx.mainsRef.current = mainsToInputs(mains, settings.leftHanded, ctx.rectRef.current);
    passer(mains.length > 0 ? { type: "handSeen", atMs: maintenant } : { type: "handGone", atMs: maintenant });
    passer({ type: "tick", atMs: maintenant });
    pasDeJeu(maintenant / 1000, mains, ctx, instrument, settings, onEvents);
    majMiroir(ctx, instrument, settings, ctx.reducedMotionRef.current);
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
  return () => {
    actif = false;
  };
}

/** Ce que le composant lit. */
export interface KioskVue {
  readonly fault: KioskFault | null;
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly modele: (frame: FrameRequest) => SceneModel;
}

export function useKiosk(): KioskVue {
  const instrument = useMemo(kioskInstrument, []);
  const settings = useMemo(kioskSettings, []);
  const reducedMotion = useReducedMotion();
  const [fault, setFault] = useState<KioskFault | null>(null);

  const ctxRef = useRef<Contexte | null>(null);
  if (ctxRef.current === null) ctxRef.current = creerContexte();
  const ctx = ctxRef.current;
  ctx.reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    let annule = false;
    void demarrerMoteur(ctx, instrument, settings, () => annule);
    void demarrerCamera(ctx, () => annule);
    return () => {
      annule = true;
      ctx.sourceRef.current?.stop();
      ctx.replayRef.current?.stop();
      ctx.engineRef.current?.close();
    };
  }, [ctx, instrument, settings]);

  useEffect(() => {
    const change = () =>
      ctx.fileRef.current.push({
        type: document.hidden ? "tabHidden" : "tabVisible",
        atMs: performance.now(),
      });
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, [ctx]);

  useEffect(() => roule(ctx, instrument, settings, setFault), [ctx, instrument, settings]);

  return {
    fault,
    videoRef: ctx.videoRef,
    modele: (frame: FrameRequest) => construireModele(ctx.miroirRef.current, ctx.precedentRef, frame),
  };
}