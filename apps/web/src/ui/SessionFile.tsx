/**
 * Le fichier de session, dans le panneau Boucle (cahier §7.10, §12.1) :
 * enregistrer la session sur l'appareil, puis la rouvrir depuis un fichier. Le
 * fichier porte la boucle, ses couches et les réglages — jamais de son, et
 * aucune requête ne part (AIR-N-01). Un fichier refusé annonce ses RAISONS
 * (AIR-F-43) : rien n'est ouvert en silence. Tout se pilote au clavier.
 */
import { useState, type JSX } from "react";
import type { Messages } from "../i18n/index.js";
import type { SessionResult } from "../state/sessionFile.js";
import { Button } from "./Controls.js";

export interface SessionFileProps {
  readonly m: Messages;
  readonly onSave: () => boolean;
  readonly onOpen: (raw: string) => SessionResult;
}

/** Ce que le panneau dit de la dernière tentative : rien, écrit, ou refusé. */
type Etat =
  | { readonly kind: "repos" }
  | { readonly kind: "sauve" }
  | { readonly kind: "ecritureRefusee" }
  | { readonly kind: "refuse"; readonly reasons: readonly string[] };

export function SessionFile({ m, onSave, onOpen }: SessionFileProps): JSX.Element {
  const [etat, setEtat] = useState<Etat>({ kind: "repos" });
  return (
    <section className="session-file" aria-label={m.loop.session}>
      <h3>{m.loop.session}</h3>
      <div className="actions">
        <Button label={m.loop.saveSession} onClick={() => setEtat(onSave() ? { kind: "sauve" } : { kind: "ecritureRefusee" })} />
        <Ouverture m={m} onOpen={onOpen} onEtat={setEtat} />
      </div>
      <p className="help" role="status">
        {annonce(m, etat)}
      </p>
      <p className="help">{m.loop.openHint}</p>
    </section>
  );
}

/** Le choix du fichier : la relecture passe par le schéma, jamais par un essai. */
function Ouverture({ m, onOpen, onEtat }: {
  readonly m: Messages;
  readonly onOpen: (raw: string) => SessionResult;
  readonly onEtat: (etat: Etat) => void;
}): JSX.Element {
  return (
    <div className="import">
      <label htmlFor="session-file">{m.loop.openSession}</label>
      <input
        id="session-file"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const fichier = event.target.files?.[0];
          if (fichier === undefined) return;
          void fichier.text().then((raw) => {
            const resultat = onOpen(raw);
            onEtat(resultat.ok ? { kind: "repos" } : { kind: "refuse", reasons: resultat.reasons });
          });
        }}
      />
    </div>
  );
}

function annonce(m: Messages, etat: Etat): string {
  if (etat.kind === "sauve") return m.loop.sessionSaved;
  if (etat.kind === "ecritureRefusee") return m.loop.saveFailed;
  if (etat.kind === "refuse") return m.loop.sessionRefused(etat.reasons.join(" ; "));
  return "";
}
