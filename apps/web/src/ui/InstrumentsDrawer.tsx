/**
 * Le tiroir d'instruments (cahier §12.1) : les instruments livrés, les tiens,
 * « dupliquer », importer un fichier, et copier le lien de partage qui porte
 * l'instrument dans le fragment d'adresse (AIR-F-45). Tout se pilote au
 * clavier, chaque entrée dit son nom, son moteur et son aimant (§12.4).
 */
import { useState, type JSX } from "react";
import type { Instrument } from "@thin-air/core";
import type { Messages } from "../i18n/index.js";
import { duplicate, isBuiltIn } from "../state/instruments.js";
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

/** Nom, moteur et aimant : ce que chaque entrée raconte (§12.1). */
function Meta({ m, instrument }: { readonly m: Messages; readonly instrument: Instrument }): JSX.Element {
  return (
    <span className="meta">
      <span className="engine" aria-label={m.editor.engine}>
        {instrument.sound.engine}
      </span>
      <span className="snap" aria-label={m.editor.snap}>
        {instrument.snap}
      </span>
    </span>
  );
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
          <Meta m={m} instrument={instrument} />
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

function avecCopie(
  m: Messages,
  onDuplicate: (instrument: Instrument) => void,
): (instrument: Instrument) => void {
  return (instrument) => onDuplicate(duplicate(instrument, m.instruments.duplicateOf));
}

export function InstrumentsDrawer(props: DrawerProps): JSX.Element {
  const { m, library, current, link, onUse, onDuplicate, onEdit, onImport, onClose } = props;
  const [copie, setCopie] = useState<"idle" | "done" | "failed">("idle");
  const livres = library.filter(isBuiltIn);
  const tiens = library.filter((instrument) => !isBuiltIn(instrument));
  const dupliquer = avecCopie(m, onDuplicate);
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
      {liste(m, livres, current, onUse, dupliquer, onEdit)}
      <h3>{m.instruments.yours}</h3>
      {tiens.length === 0 ? <p className="help">{m.instruments.emptyMine}</p> : null}
      {liste(m, tiens, current, onUse, dupliquer, onEdit)}
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
      <Partage m={m} link={link} copie={copie} copier={() => void copier()} />
    </Panel>
  );
}

/** AIR-F-45 : le lien contient l'instrument, rien ne part sur le réseau. */
function Partage(props: {
  readonly m: Messages;
  readonly link: string;
  readonly copie: "idle" | "done" | "failed";
  readonly copier: () => void;
}): JSX.Element {
  const { m, link, copie, copier } = props;
  return (
    <div className="share">
      <label htmlFor="share-link">{m.instruments.copyLink}</label>
      <input id="share-link" type="text" readOnly value={link} onFocus={(event) => event.target.select()} />
      <Button label={m.instruments.copyLink} onClick={copier} />
      <p className="help" role="status">
        {copie === "done" ? m.instruments.copied : copie === "failed" ? m.instruments.linkFailed : m.instruments.shareHint}
      </p>
    </div>
  );
}
