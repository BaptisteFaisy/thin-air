/** L'éditeur d'instrument (cahier §12.1, AIR-F-44) : gamme, fondamentale, étendue, cordes ou zones, aimant, son. */
import type { JSX } from "react";
import type { Instrument, ScaleName, SoundEngine } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import { edit, ENGINES, SCALE_NAMES, scaleNameOf, shapeOf, type EditPatch } from "../state/instruments.js";
import { Choice, Panel, Slider } from "./Controls.js";

export interface EditorProps {
  readonly m: Messages;
  readonly instrument: Instrument;
  readonly readOnly: boolean;
  readonly onChange: (instrument: Instrument) => void;
  readonly onClose: () => void;
}

function scaleOptions(m: Messages): readonly { value: ScaleName; label: string }[] {
  return SCALE_NAMES.map((nom) => ({ value: nom, label: `${nom} — ${m.editor.scale}` }));
}

function engineOptions(): readonly { value: SoundEngine; label: string }[] {
  return ENGINES.map((moteur) => ({ value: moteur, label: moteur }));
}

export function InstrumentEditor({ m, instrument, readOnly, onChange, onClose }: EditorProps): JSX.Element {
  const forme = shapeOf(instrument);
  const patch = (partiel: EditPatch) => onChange(edit(instrument, partiel));
  return (
    <Panel title={m.editor.title} onClose={onClose} closeLabel={m.common.close}>
      {readOnly ? <p className="help">{m.editor.duplicateFirst}</p> : null}
      <fieldset disabled={readOnly}>
        <Choice
          id="editor-scale"
          label={m.editor.scale}
          value={scaleNameOf(instrument)}
          options={scaleOptions(m)}
          onChange={(value) => patch({ scaleName: value })}
        />
        <Slider
          id="editor-root"
          label={m.editor.root}
          value={instrument.scale.root}
          min={24}
          max={96}
          step={1}
          onChange={(value) => patch({ root: value })}
        />
        <Geometrie m={m} instrument={instrument} forme={forme} patch={patch} />
        <Slider
          id="editor-snap"
          label={m.editor.snap}
          help={m.editor.snapHelp}
          value={instrument.snap}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => patch({ snap: value })}
        />
        <Choice
          id="editor-engine"
          label={m.editor.engine}
          value={instrument.sound.engine}
          options={engineOptions()}
          onChange={(value) => patch({ engine: value })}
        />
      </fieldset>
    </Panel>
  );
}

/** Étendue et nombre de cordes ou de zones (AIR-F-44). */
function Geometrie(props: {
  readonly m: Messages;
  readonly instrument: Instrument;
  readonly forme: { readonly kind: string; readonly count: number };
  readonly patch: (partiel: EditPatch) => void;
}): JSX.Element {
  const { m, instrument, forme, patch } = props;
  const etendue = instrument.range;
  return (
    <>
      {etendue === undefined ? null : (
        <>
          <Slider
            id="editor-low"
            label={m.editor.rangeLow}
            value={etendue.low}
            min={0}
            max={127}
            step={1}
            onChange={(value) => patch({ low: value, high: Math.max(value, etendue.high) })}
          />
          <Slider
            id="editor-high"
            label={m.editor.rangeHigh}
            value={etendue.high}
            min={0}
            max={127}
            step={1}
            onChange={(value) => patch({ low: Math.min(value, etendue.low), high: value })}
          />
        </>
      )}
      {forme.kind === "range" ? null : (
        <Slider
          id="editor-count"
          label={forme.kind === "strings" ? m.editor.strings : m.editor.zones}
          value={forme.count}
          min={1}
          max={32}
          step={1}
          onChange={(value) => patch({ count: value })}
        />
      )}
    </>
  );
}
