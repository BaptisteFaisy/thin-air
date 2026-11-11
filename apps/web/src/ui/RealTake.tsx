/**
 * La page « prise réelle » (lot N7, cahier §7.3 à §7.5, annexe D) : route
 * `?record=1`. Trois scénarios guidés, un décompte visuel, l'enregistrement
 * avec l'enregistreur existant (`createTakeRecorder` : les points seulement,
 * jamais l'image — AIR-F-47), et le téléchargement local (`downloadTake` :
 * un `blob:`, aucun réseau — AIR-F-57). Aucun son : cette page n'ouvre aucun
 * moteur audio (AIR-N-02).
 *
 * Les images poussées dans l'enregistreur sont les images BRUTES de la source
 * caméra (`mirrored` non demandé : le côté n'est pas renversé). C'est le but
 * du scénario `left-hand-only` : lire la convention du modèle telle qu'elle
 * sort du modèle (§7.3), pas telle qu'un traitement la présenterait.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { langFrom, messagesFor, type Messages } from "../i18n/index.js";
import { MODEL_URL, WASM_ROOT } from "../hooks/useSession.js";
import {
  REAL_TAKE_INITIAL,
  REAL_TAKE_SCENARIOS,
  realTakeScenario,
  reduceRealTake,
  stepAt,
  type RealTakeScenario,
  type RealTakeState,
} from "../state/realTake.js";
import { Button } from "./Controls.js";

type CameraPhase = "off" | "starting" | "ready" | "failed";

interface SourceArret {
  stop(): void;
}

export function RealTakePage(): JSX.Element {
  const m = useMemo(
    () => messagesFor(langFrom(typeof window === "undefined" ? "" : window.location.search)),
    [],
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<{ start(): void; push(f: never): void; stop(): unknown } | null>(null);
  const sourceRef = useRef<SourceArret | null>(null);
  const stateRef = useRef<RealTakeState>(REAL_TAKE_INITIAL);
  const [state, setState] = useState<RealTakeState>(REAL_TAKE_INITIAL);
  const [camera, setCamera] = useState<CameraPhase>("off");
  const [modelPct, setModelPct] = useState(0);

  const appliquer = useCallback((suivant: RealTakeState) => {
    stateRef.current = suivant;
    setState(suivant);
  }, []);

  const ouvrirCamera = useCallback(async () => {
    setCamera("starting");
    try {
      const vision = await import("@thin-air/vision");
      const video = videoRef.current;
      if (video === null) throw new Error("video");
      await vision.openCamera(video, { frameRateIdeal: DEFAULT_SETTINGS.frameRateIdeal });
      const enregistreur = vision.createTakeRecorder(DEFAULT_SETTINGS.frameRateIdeal);
      recorderRef.current = enregistreur as never;
      const source = vision.createCameraSource(video, {
        frameRateIdeal: DEFAULT_SETTINGS.frameRateIdeal,
        environment: {
          createLandmarker: () =>
            vision.loadLandmarker({
              modelUrl: MODEL_URL,
              wasmRoot: WASM_ROOT,
              numHands: DEFAULT_SETTINGS.numHands,
              onProgress: (ratio) => setModelPct(Math.round(ratio * 100)),
            }),
        },
      });
      sourceRef.current = source;
      source.onFrame((frame) => enregistreur.push(frame));
      await source.start();
      setCamera("ready");
    } catch {
      setCamera("failed");
    }
  }, []);

  /** L'horloge d'une seconde : décompte, enregistrement, puis téléchargement. */
  const tick = useCallback(() => {
    const avant = stateRef.current;
    const suivant = reduceRealTake(avant, { type: "tick" });
    if (suivant.phase === "recording" && avant.phase === "countdown") {
      (recorderRef.current as { start(): void } | null)?.start();
    }
    if (suivant.phase === "done" && avant.phase === "recording" && suivant.filename !== null) {
      const prise = (recorderRef.current as { stop(): never } | null)?.stop();
      if (prise !== undefined && prise !== null) {
        telecharger(prise, suivant.filename);
      }
    }
    appliquer(suivant);
  }, [appliquer]);

  useHorloge(state.phase, tick);
  const scenario = state.scenarioId === null ? null : realTakeScenario(state.scenarioId);
  return (
    <main className="real-take">
      <h1>{m.realTake.title}</h1>
      <p className="help">{m.realTake.intro}</p>
      <p className="help">{m.realTake.privacy}</p>
      <video ref={videoRef} playsInline muted style={{ display: "none" }} aria-hidden="true" />
      <Camera m={m} camera={camera} modelPct={modelPct} onOpen={() => void ouvrirCamera()} />
      {camera === "ready" ? <Scenarios m={m} state={state} scenario={scenario} onPick={appliquer} /> : null}
      {state.phase !== "pick" && scenario !== null ? <Suivi m={m} state={state} scenario={scenario} /> : null}
      {state.phase === "done" && state.filename !== null ? (
        <Fini m={m} filename={state.filename} onReset={() => appliquer(reduceRealTake(stateRef.current, { type: "reset" }))} />
      ) : null}
      <p className="help">
        <a href=".">{m.realTake.back}</a>
      </p>
    </main>
  );
}

/** Le téléchargement passe par l'enveloppe existante du lot B5 (blob:, aucun réseau). */
async function telecharger(prise: unknown, filename: string): Promise<void> {
  const vision = await import("@thin-air/vision");
  vision.downloadTake(prise as Parameters<typeof vision.downloadTake>[0], filename);
}

function Camera(props: {
  readonly m: Messages;
  readonly camera: CameraPhase;
  readonly modelPct: number;
  readonly onOpen: () => void;
}): JSX.Element {
  const { m, camera } = props;
  return (
    <section>
      {camera === "off" ? <Button label={m.realTake.openCamera} primary onClick={props.onOpen} /> : null}
      {camera === "starting" ? (
        <p role="status">
          {props.modelPct > 0 ? m.realTake.modelLoading(props.modelPct) : m.camera.requesting}
        </p>
      ) : null}
      {camera === "failed" ? <p role="alert">{m.realTake.cameraFailed}</p> : null}
    </section>
  );
}

function Scenarios(props: {
  readonly m: Messages;
  readonly state: RealTakeState;
  readonly scenario: RealTakeScenario | null;
  readonly onPick: (state: RealTakeState) => void;
}): JSX.Element {
  const { m, state } = props;
  const enMarche = state.phase !== "pick" && state.phase !== "done";
  return (
    <section aria-label={m.realTake.choose}>
      <h2>{m.realTake.choose}</h2>
      <ul className="real-take-scenarios">
        {REAL_TAKE_SCENARIOS.map((scenario) => (
          <li key={scenario.id}>
            <Button
              label={m.realTake.purposes[scenario.purposeKey]}
              disabled={enMarche}
              onClick={() => props.onPick(reduceRealTake(state, { type: "pick", id: scenario.id }))}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Suivi(props: {
  readonly m: Messages;
  readonly state: RealTakeState;
  readonly scenario: RealTakeScenario;
}): JSX.Element {
  const { m, state, scenario } = props;
  return (
    <section role="status" aria-live="polite">
      {state.phase === "countdown" ? <p className="real-take-countdown">{m.realTake.countdown(state.countdownS)}</p> : null}
      {state.phase === "recording" ? (
        <>
          <p className="real-take-step">{m.realTake.steps[stepAt(scenario, state.elapsedS).key]}</p>
          <p>{m.realTake.recording(state.elapsedS, scenario.durationS)}</p>
        </>
      ) : null}
    </section>
  );
}

function Fini(props: { readonly m: Messages; readonly filename: string; readonly onReset: () => void }): JSX.Element {
  const { m } = props;
  return (
    <section role="status">
      <p>{m.realTake.done(props.filename)}</p>
      <Button label={m.realTake.again} onClick={props.onReset} />
      <p className="help">{m.realTake.nextStep}</p>
    </section>
  );
}

/** Une seconde par pas, seulement pendant le décompte et l'enregistrement. */
function useHorloge(phase: RealTakeState["phase"], tick: () => void): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const actif = phase === "countdown" || phase === "recording";
  useEffect(() => {
    if (!actif) return undefined;
    const id = setInterval(() => tickRef.current(), 1000);
    return () => clearInterval(id);
  }, [actif]);
}
