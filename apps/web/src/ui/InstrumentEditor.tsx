/**
 * L'éditeur d'instrument (cahier §12.1, AIR-F-44) : gamme, fondamentale,
 * étendue, nombre de cordes ou de zones, aimant, moteur.
 *
 * La validation est EN DIRECT : le schéma du lot A4 (`parseInstrument`) est
 * rejoué à chaque changement, ses raisons s'affichent près du champ concerné,
 * et l'enregistrement reste désactivé tant que le fichier est refusé. Aucun
 * champ inventé : le schéma est strict, un refus bloque la sauvegarde.
 */
import { useMemo, useState, type JSX } from "react";
import type { Instrument, ScaleName, SoundEngine } from "@thin-air/core";
import { parseInstrument } from "@thin-air/schema";
import type { Messages } from "../i18n/index.js";
import {
  edit,
  ENGINES,
  reasonFields,
  SCALE_NAMES,
  scaleNameOf,
  shapeOf,
  type EditPatch,
  type EditorField,
  type ReasonsByField,
} from "../state/instruments.js";
import { Button, Choice, Panel, Slider, TextField } from "./Controls.js";

export interface EditorProps {
  readonly m: Messages;
  readonly instrument: Instrument;
  readonly readOnly: boolean;
  readonly onSave: (instrument: Instrument) => void;
  readonly onClose: () => void;
}

function scaleOptions(): readonly { value: ScaleName; label: string }[] {
  return SCALE_NAMES.map((nom) => ({ value: nom, label: nom }));
}

function engineOptions(): readonly { value: SoundEngine; label: string }[] {
  return ENGINES.map((moteur) => ({ value: moteur, label: moteur }));
}

/** Les raisons d'un champ, annoncées au lecteur d'écran (§12.4). */
function Erreurs({ raisons }: { readonly raisons: readonly string[] }): JSX.Element | null {
  if (raisons.length === 0) return null;
  return (
    <div className="errors" role="alert">
      {raisons.map((raison) => (
        <p key={raison} className="error">
          {raison}
        </p>
      ))}
    </div>
  );
}

export function InstrumentEditor({ m, instrument, readOnly, onSave, onClose }: EditorProps): JSX.Element {
  const [brouillon, setBrouillon] = useState<Instrument>(instrument);
  const resultat = useMemo(() => parseInstrument(brouillon), [brouillon]);
  const parChamp: ReasonsByField = useMemo(
    () => reasonFields(resultat.ok ? [] : resultat.reasons),
    [resultat],
  );
  const forme = shapeOf(brouillon);
  const patch = (partiel: EditPatch) => setBrouillon((avant) => edit(avant, partiel));
  return (
    <Panel title={m.editor.title} onClose={onClose} closeLabel={m.common.close}>
      {readOnly ? <p className="help">{m.editor.duplicateFirst}</p> : null}
      <fieldset disabled={readOnly}>
        <Erreurs raisons={parChamp.form} />
        <TextField
          id="editor-name"
          label={m.editor.name}
          value={brouillon.name}
          invalid={parChamp.name.length > 0}
          onChange={(value) => patch({ name: value })}
        />
        <Erreurs raisons={parChamp.name} />
        <Choice
          id="editor-scale"
          label={m.editor.scale}
          value={scaleNameOf(brouillon)}
          options={scaleOptions()}
          invalid={parChamp.scale.length > 0}
          onChange={(value) => patch({ scaleName: value })}
        />
        <Erreurs raisons={parChamp.scale} />
        <Slider
          id="editor-root"
          label={m.editor.root}
          value={brouillon.scale.root}
          min={24}
          max={96}
          step={1}
          invalid={parChamp.root.length > 0}
          onChange={(value) => patch({ root: value })}
        />
        <Erreurs raisons={parChamp.root} />
        <Geometrie m={m} instrument={brouillon} forme={forme} parChamp={parChamp} patch={patch} />
        <Slider
          id="editor-snap"
          label={m.editor.snap}
          help={m.editor.snapHelp}
          value={brouillon.snap}
          min={0}
          max={1}
          step={0.05}
          invalid={parChamp.snap.length > 0}
          onChange={(value) => patch({ snap: value })}
        />
        <Erreurs raisons={parChamp.snap} />
        <Choice
          id="editor-engine"
          label={m.editor.engine}
          value={brouillon.sound.engine}
          options={engineOptions()}
          invalid={parChamp.sound.length > 0}
          onChange={(value) => patch({ engine: value })}
        />
        <Erreurs raisons={parChamp.sound} />
        <div className="editor-actions">
          <Button
            label={m.editor.save}
            primary
            disabled={readOnly || !resultat.ok}
            onClick={() => {
              if (resultat.ok) onSave(resultat.value);
            }}
          />
          <Button label={m.common.cancel} onClick={onClose} />
        </div>
      </fieldset>
    </Panel>
  );
}

/** Étendue et nombre de cordes ou de zones (AIR-F-44). */
function Geometrie(props: {
  readonly m: Messages;
  readonly instrument: Instrument;
  readonly forme: { readonly kind: string; readonly count: number };
  readonly parChamp: Readonly<Record<EditorField, readonly string[]>>;
  readonly patch: (partiel: EditPatch) => void;
}): JSX.Element {
  const { m, instrument, forme, parChamp, patch } = props;
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
            invalid={parChamp.range.length > 0}
            onChange={(value) => patch({ low: value, high: Math.max(value, etendue.high) })}
          />
          <Slider
            id="editor-high"
            label={m.editor.rangeHigh}
            value={etendue.high}
            min={0}
            max={127}
            step={1}
            invalid={parChamp.range.length > 0}
            onChange={(value) => patch({ low: Math.min(value, etendue.low), high: value })}
          />
          <Erreurs raisons={parChamp.range} />
        </>
      )}
      {forme.kind === "range" ? null : (
        <>
          <Slider
            id="editor-count"
            label={forme.kind === "strings" ? m.editor.strings : m.editor.zones}
            value={forme.count}
            min={1}
            max={32}
            step={1}
            invalid={parChamp.count.length > 0}
            onChange={(value) => patch({ count: value })}
          />
          <Erreurs raisons={parChamp.count} />
        </>
      )}
    </>
  );
}
