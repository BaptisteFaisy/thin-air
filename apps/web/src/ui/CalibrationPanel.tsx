/** Le panneau de calibration (cahier §7.4, AIR-F-09, écran §12.1). */
import type { JSX } from "react";
import type { Messages } from "../i18n/index.js";
import { isCalibrating, storedRect, type CalibrationState } from "../state/calibration.js";
import { Button, Panel } from "./Controls.js";

export interface CalibrationPanelProps {
  readonly m: Messages;
  readonly state: CalibrationState;
  readonly onStart: () => void;
  readonly onRestart: () => void;
  readonly onKeepDefault: () => void;
  readonly onClose: () => void;
}

/** Le rectangle obtenu, en pourcentages de l'image : lisible sans règle. */
export function rectText(rect: { u0: number; u1: number; v0: number; v1: number }): string {
  const pourcent = (valeur: number) => `${Math.round(valeur * 100)} %`;
  return `${pourcent(rect.u0)} → ${pourcent(rect.u1)} · ${pourcent(rect.v0)} → ${pourcent(rect.v1)}`;
}

export function CalibrationPanel(props: CalibrationPanelProps): JSX.Element {
  const { m, state } = props;
  const enCours = isCalibrating(state);
  const rect = storedRect(state);
  return (
    <Panel title={m.calibration.title} onClose={props.onClose} closeLabel={m.common.close}>
      <p className="help">{m.calibration.instruction}</p>
      {state.phase === "countdown" ? (
        <p className="countdown" aria-live="assertive">
          {m.calibration.countdown(state.remainingS)}
        </p>
      ) : null}
      {state.phase === "recording" ? (
        <p className="countdown" aria-live="polite">
          {m.calibration.counting} {m.calibration.countdown(state.remainingS)}
        </p>
      ) : null}
      {state.phase === "result" ? <p role="status">{m.calibration.result}</p> : null}
      {state.phase === "failed" ? <p role="alert">{m.calibration.tooSmall}</p> : null}
      <p className="rect">
        <code>{rectText(rect)}</code>
      </p>
      <p className="help">
        {rect.calibratedAt === null ? m.calibration.keep : m.calibration.save}
      </p>
      <div className="actions">
        {enCours ? null : <Button label={m.calibration.title} primary onClick={props.onStart} />}
        {state.phase === "failed" ? <Button label={m.calibration.keep} onClick={props.onKeepDefault} /> : null}
        <Button label={m.calibration.restart} onClick={props.onRestart} />
      </div>
    </Panel>
  );
}
