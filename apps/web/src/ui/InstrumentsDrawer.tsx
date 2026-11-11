/** Le tiroir d'instruments (cahier §12.1) : livrés, les tiens, dupliquer, importer, copier le lien. */
import { useState, type JSX } from "react";
import type { Instrument } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import { BUILT_IN } from "../state/presets.js";
import { duplicate, isBuiltIn, shareLink } from "../state/instruments.js";
import { Button, Panel } from "./Controls.js";

export interface DrawerProps {
  readonly m: Messages;
  readonly library: readonly Instrument[];
  readonly current: Instrument;
  readonly link: string;
  readonly onUse: (instrument: Instrument) => void;
  readonly onDuplicate: (instrument: Instrument) => void;
  readonly onEdit: (instrument: Instrument) => void;
  readonly onImport: (raw: string) => void;
  readonly onClose: () => void;
}

function liste(
  m: Messages,
  instruments: readonly Instrument[],
  current: Instrument,
  onUse: (i: Instrument) => void,
  onDuplicate: (i: Instrument) => void,
  onEdit: (i: Instrument) => void,
): JSX.Element {
  return (
    <ul className="instruments">
      {instruments.map((instrument) => (
        <li key={instrument.name} aria-current={instrument.name === current.name}>
          <span className="name">{instrument.name}</span>
          <Button label={m.instruments.use} onClick={() => onUse(instrument)} />
          <Button label={m.instruments.duplicate} onClick={() => onDuplicate(instrument)} />
          {isBuiltIn(instrument) ? null : (
            <Button label={m.instruments.edit} onClick={() => onEdit(instrument)} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function InstrumentsDrawer(props: DrawerProps): JSX.Element {
  const { m, library, current, link, onUse, onDuplicate, onEdit, onImport, onClose } = props;
  const [copie, setCopie] = useState<"idle" | "done" | "failed">("idle");
  const tiens = library.filter((instrument) => !isBuiltIn(instrument));
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopie("done");
    } catch {
      setCopie("failed");
    }
  };
  return (
    <Panel title={m.instruments.title} onClose={onClose} closeLabel={m.common.close}>
      <h3>{m.instruments.builtIn}</h3>
      {liste(m, BUILT_IN, current, onUse, (i) => onDuplicate(duplicate(i, m.instruments.duplicateOf)), onEdit)}
      <h3>{m.instruments.yours}</h3>
      {tiens.length === 0 ? <p className="help">{m.loop.empty}</p> : null}
      {liste(m, tiens, current, onUse, (i) => onDuplicate(duplicate(i, m.instruments.duplicateOf)), onEdit)}
      <div className="import">
        <label htmlFor="instrument-file">{m.instruments.importFile}</label>
        <input
          id="instrument-file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const fichier = event.target.files?.[0];
            if (fichier === undefined) return;
            void fichier.text().then(onImport);
          }}
        />
        <p className="help">{m.instruments.importHint}</p>
      </div>
      <div className="share">
        <label htmlFor="share-link">{m.instruments.copyLink}</label>
        <input id="share-link" type="text" readOnly value={link} onFocus={(event) => event.target.select()} />
        <Button label={m.instruments.copyLink} onClick={() => void copier()} />
        <p className="help" role="status">
          {copie === "done" ? m.instruments.copied : copie === "failed" ? m.instruments.linkFailed : m.instruments.shareHint}
        </p>
      </div>
    </Panel>
  );
}

export { shareLink };
