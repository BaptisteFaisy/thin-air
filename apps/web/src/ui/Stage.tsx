/**
 * L'écran de jeu (cahier §12.1) : la scène, le nom de l'instrument, la note en
 * cours AUSSI en texte, la jauge de volume, le retard, et les messages d'état.
 */
import type { JSX } from "react";
import type { Instrument } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import type { StageDisplay } from "../state/display.js";
import type { LatencyParts } from "../state/latency.js";
import type { NoticeId, UiState } from "../state/machine.js";
import { shapeOf } from "../state/instruments.js";
import { LatencyReadout } from "./LatencyReadout.js";
import { Notices } from "./Notices.js";
import { SceneCanvas, type FrameRequest } from "../scene/SceneCanvas.js";
import type { SceneModel } from "../scene/geometry.js";

export type PanelId = "instruments" | "loop" | "calibration" | "settings" | "physics" | null;

export interface StageProps {
  readonly m: Messages;
  readonly state: UiState;
  readonly instrument: Instrument;
  readonly display: StageDisplay;
  readonly parts: LatencyParts;
  readonly wireless: boolean;
  readonly notices: readonly NoticeId[];
  readonly rejectionReason: string | null;
  readonly model: (frame: FrameRequest) => SceneModel;
  readonly videoRef: { readonly current: HTMLVideoElement | null };
  readonly showCamera: boolean;
  readonly reducedMotion: boolean;
  readonly openPanel: PanelId;
  readonly onOpenPanel: (panel: PanelId) => void;
  readonly onResumeAudio: () => void;
  readonly hoveredLabel: string | null;
  readonly stageRef: { readonly current: HTMLElement | null };
}

/** La jauge : un niveau linéaire, et le texte en dB quand il existe. */
export function gaugePercent(display: StageDisplay): number {
  return Math.round(Math.min(1, Math.max(0, display.gain)) * 100);
}

export function Stage(props: StageProps): JSX.Element {
  const { m, state, instrument, display, parts, wireless, notices } = props;
  return (
    <main className="screen stage" ref={props.stageRef as never}>
      <SceneCanvas
        label={`${m.meta.appName} — ${instrument.name}`}
        model={props.model}
        videoRef={props.videoRef}
        showCamera={props.showCamera}
      />
      <Hud props={props} />
      <Notices
        m={m}
        state={state}
        ids={notices}
        rejectionReason={props.rejectionReason}
        onResumeAudio={props.onResumeAudio}
      />
      <LatencyReadout m={m} parts={parts} wireless={wireless} />
      <BarreOutils props={props} />
      <video ref={props.videoRef as never} className="camera-source" playsInline muted aria-hidden="true" />
    </main>
  );
}

/** Ce qui est dit en texte, à côté du canevas (§12.4) : note, jauge, mode. */
function Hud({ props }: { readonly props: StageProps }): JSX.Element {
  const { m, state, instrument, display } = props;
  const forme = shapeOf(instrument);
  const note = display.midi === null ? m.stage.noNote : display.note;
  const dB = display.gainDb === null ? m.common.none : `${Math.round(display.gainDb)} ${m.stage.volumeUnit}`;
  return (
    <div className="hud">
      <p className="instrument">
        <span className="label">{m.stage.instrument}</span> {instrument.name}
        <span className="shape">{formeTexte(m, forme)}</span>
      </p>
      <p className="note" aria-live="polite">
        <span className="label">{m.stage.currentNote}</span> {note}
      </p>
      <p className="gauge">
        <span className="label" id="volume-label">
          {m.stage.volume}
        </span>
        <span
          role="meter"
          aria-labelledby="volume-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={gaugePercent(display)}
          className="bar"
        >
          <span className="fill" style={{ width: `${gaugePercent(display)}%` }} />
        </span>
        <span className="db">{dB}</span>
      </p>
      {props.hoveredLabel === null ? null : <p className="hovered">{props.hoveredLabel}</p>}
      {state.mode === "pointer" ? <p className="pointer">{m.stage.pointer}</p> : null}
      {props.reducedMotion ? <p className="reduced">{m.settings.reducedMotion}</p> : null}
    </div>
  );
}

function formeTexte(m: Messages, forme: { kind: string; count: number }): string {
  if (forme.kind === "strings") return ` · ${m.editor.strings} ${forme.count}`;
  if (forme.kind === "zones") return ` · ${m.editor.zones} ${forme.count}`;
  return "";
}

/** Les écrans s'ouvrent par des boutons ordinaires, jamais dans le canevas. */
function BarreOutils({ props }: { readonly props: StageProps }): JSX.Element {
  const { m, openPanel, onOpenPanel } = props;
  const ouvre = (panneau: PanelId) => () => onOpenPanel(panneau);
  return (
    <nav className="toolbar" aria-label={m.meta.appName}>
      <button type="button" onClick={ouvre("instruments")}>
        {m.stage.open}
      </button>
      <button type="button" onClick={ouvre("loop")}>
        {m.stage.loop}
      </button>
      <button type="button" onClick={ouvre("calibration")}>
        {m.stage.calibration}
      </button>
      <button type="button" onClick={ouvre("settings")}>
        {m.stage.settings}
      </button>
      <button
        type="button"
        aria-pressed={openPanel === "physics"}
        onClick={() => onOpenPanel(openPanel === "physics" ? null : "physics")}
      >
        {openPanel === "physics" ? m.stage.hidePhysics : m.stage.physics}
      </button>
    </nav>
  );
}
