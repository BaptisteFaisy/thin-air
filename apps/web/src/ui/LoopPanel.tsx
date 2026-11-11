/** Le panneau de la boucle (cahier §7.10, §12.1, parcours P4). */
import type { JSX } from "react";
import { MAX_LAYERS } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import { BARS_CHOICES, currentBeat, isFull, loopLengthS, type LoopState } from "../state/loopState.js";
import { Button, Panel, Slider } from "./Controls.js";

export interface LoopPanelProps {
  readonly m: Messages;
  readonly loop: LoopState;
  readonly midiAvailable: boolean;
  readonly onTempo: (tempo: number) => void;
  readonly onBars: (bars: number) => void;
  readonly onRecord: () => void;
  readonly onStop: () => void;
  readonly onRemoveLast: () => void;
  readonly onToggleMute: (id: number) => void;
  readonly onClear: () => void;
  readonly onExportWav: () => void;
  readonly onExportMidi: () => void;
  readonly onClose: () => void;
}

export function LoopPanel(props: LoopPanelProps): JSX.Element {
  const { m, loop } = props;
  return (
    <Panel title={m.loop.title} onClose={props.onClose} closeLabel={m.common.close}>
      <Slider
        id="loop-tempo"
        label={`${m.loop.tempo} (${m.loop.tempoUnit})`}
        value={loop.tempo}
        min={60}
        max={140}
        step={1}
        onChange={props.onTempo}
      />
      <ChoixMesures m={m} loop={loop} onBars={props.onBars} />
      <p className="help">
        {m.loop.beat(currentBeat(loop), loop.beatsPerBar)} · {loopLengthS(loop).toFixed(2)} s
      </p>
      <h3>{m.loop.layers}</h3>
      <Couches m={m} loop={loop} onToggleMute={props.onToggleMute} />
      <Commandes props={props} />
      <p className="help">{m.loop.compensating}</p>
    </Panel>
  );
}

function ChoixMesures(props: {
  readonly m: Messages;
  readonly loop: LoopState;
  readonly onBars: (bars: number) => void;
}): JSX.Element {
  const { m, loop, onBars } = props;
  return (
    <fieldset className="bars">
      <legend>{m.loop.bars}</legend>
      {BARS_CHOICES.map((bars) => (
        <label key={bars}>
          <input
            type="radio"
            name="loop-bars"
            value={bars}
            checked={loop.bars === bars}
            onChange={() => onBars(bars)}
          />
          {bars}
        </label>
      ))}
    </fieldset>
  );
}

function Couches(props: {
  readonly m: Messages;
  readonly loop: LoopState;
  readonly onToggleMute: (id: number) => void;
}): JSX.Element {
  const { m, loop, onToggleMute } = props;
  if (loop.layers.length === 0) return <p className="help">{m.loop.empty}</p>;
  return (
    <ul className="layers">
      {loop.layers.map((couche, index) => (
        <li key={couche.id}>
          <span>{m.loop.layerLabel(index + 1, couche.instrument)}</span>
          <Button label={couche.muted ? m.loop.unmute : m.loop.mute} onClick={() => onToggleMute(couche.id)} />
        </li>
      ))}
    </ul>
  );
}

/** AIR-F-34, 36, 38, 39 : enregistrer, retirer, effacer, exporter. */
function Commandes({ props }: { readonly props: LoopPanelProps }): JSX.Element {
  const { m, loop, midiAvailable } = props;
  const vide = loop.layers.length === 0;
  return (
    <>
      <p className="help" aria-live="polite">
        {`${loop.layers.length}/${MAX_LAYERS}`} {isFull(loop) ? m.loop.full(MAX_LAYERS) : ""}
      </p>
      <div className="actions">
        {loop.recording ? (
          <Button label={m.loop.stop} primary onClick={props.onStop} />
        ) : (
          <Button label={m.loop.record} primary onClick={props.onRecord} disabled={isFull(loop)} />
        )}
        <Button label={m.loop.removeLast} onClick={props.onRemoveLast} disabled={vide} />
        <Button label={m.loop.clear} onClick={props.onClear} disabled={vide} />
        <Button label={m.loop.exportWav} onClick={props.onExportWav} disabled={vide} />
        {midiAvailable ? (
          <Button label={m.loop.exportMidi} onClick={props.onExportMidi} disabled={vide} />
        ) : (
          <p className="help">{m.loop.midiUnavailable}</p>
        )}
      </div>
    </>
  );
}
