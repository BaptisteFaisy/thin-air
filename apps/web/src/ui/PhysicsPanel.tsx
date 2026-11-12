/** Le mode « Show the physics » (parcours P5, AIR-F-53). */
import type { JSX } from "react";
import type { Instrument } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import type { StageDisplay } from "../state/display.js";
import { Panel } from "./Controls.js";
import { pathFor, toPolyline } from "./waveform.js";

export interface PhysicsPanelProps {
  readonly m: Messages;
  readonly instrument: Instrument;
  readonly display: StageDisplay;
  readonly onClose: () => void;
}

const LARGEUR = 240;
const HAUTEUR = 72;

const LECONS_LINK = "What the numbers say";

export function PhysicsPanel({ m, instrument, display, onClose }: PhysicsPanelProps): JSX.Element {
  const frequence = display.frequencyHz;
  const texte = frequence === null ? m.common.none : `${frequence.toFixed(1)} ${m.physics.frequencyUnit}`;
  const octave = frequence === null ? m.common.none : `${(frequence * 2).toFixed(1)} ${m.physics.frequencyUnit}`;
  return (
    <Panel title={m.physics.title} onClose={onClose} closeLabel={m.common.close}>
      <dl className="physics">
        <dt>{m.physics.note}</dt>
        <dd>{display.midi === null ? m.stage.noNote : display.note}</dd>
        <dt>{m.physics.frequency}</dt>
        <dd aria-live="polite">{texte}</dd>
        <dt>{m.physics.octave}</dt>
        <dd>{octave}</dd>
      </dl>
      <p className="help">{m.physics.wave}</p>
      <svg
        className="wave"
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        role="img"
        aria-label={`${m.physics.wave} — ${instrument.name}`}
      >
        <polyline points={toPolyline(pathFor(instrument.sound), LARGEUR, HAUTEUR)} />
      </svg>
      <p className="help">{m.physics.octave}</p>
    </Panel>
  );
}
