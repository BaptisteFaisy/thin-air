/**
 * Les messages d'état (cahier §12.2) : un seul endroit les rend, dans l'ordre
 * donné par `notices()`. Le lecteur d'écran les annonce par `aria-live`.
 */
import type { JSX } from "react";
import type { Messages } from "../i18n/index.js";
import { modelPercent, type NoticeId, type UiState } from "../state/machine.js";

export interface NoticesProps {
  readonly m: Messages;
  readonly state: UiState;
  readonly ids: readonly NoticeId[];
  readonly rejectionReason: string | null;
  readonly onResumeAudio: () => void;
}

function texte(m: Messages, id: NoticeId, state: UiState, rejectionReason: string | null): string {
  switch (id) {
    case "cameraDenied":
      return `${m.camera.denied} ${m.camera.deniedHint}`;
    case "cameraAbsent":
      return `${m.camera.absent} ${m.camera.absentHint}`;
    case "modelLoading":
      return m.camera.modelLoading(modelPercent(state));
    case "modelFailed":
      return `${m.camera.modelFailed} ${m.camera.modelFailedHint}`;
    case "noHands":
      return `${m.stage.quiet} ${m.stage.quietHint}`;
    case "handAtEdge":
      return `${m.stage.edge} ${m.stage.edgeHint}`;
    case "tabHidden":
      return m.stage.hidden;
    case "audioSuspended":
      return m.stage.suspended;
    case "wirelessOutput":
      return m.latency.wireless;
    case "loopFull":
      return m.loop.full(6);
    case "midiUnavailable":
      return m.loop.midiUnavailable;
    case "instrumentRejected":
      return m.instruments.rejected(rejectionReason ?? m.common.none);
    case "ghostPlaying":
      return m.stage.ghost;
    default:
      return "";
  }
}

export function Notices({ m, state, ids, rejectionReason, onResumeAudio }: NoticesProps): JSX.Element {
  return (
    <ul className="notices" aria-live="polite" role="status">
      {ids.map((id) => (
        <li key={id} className={`notice notice-${id}`}>
          <span>{texte(m, id, state, rejectionReason)}</span>
          {id === "audioSuspended" ? (
            <button type="button" onClick={onResumeAudio}>
              {m.stage.resume}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
