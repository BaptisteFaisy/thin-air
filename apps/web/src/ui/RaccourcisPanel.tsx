/**
 * Le panneau « Raccourcis clavier » : la liste du manifeste
 * (docs/raccourcis.json), lisible à l'écran, dans la langue de la page.
 *
 * Une seule source de vérité : ce composant lit `state/raccourcis.ts`, qui
 * lit le JSON contrôlé par `scripts/check-raccourcis.mjs`. Aucune touche
 * n'est recopiée ici — sinon le manifeste et l'affichage divergeraient.
 */
import type { JSX } from "react";
import type { Messages } from "../i18n/index.js";
import { actionsPourEcran, ecransOrdonnes, labelFor, libelleEcran, RACCOURCIS } from "../state/raccourcis.js";
import { Panel } from "./Controls.js";

export interface RaccourcisPanelProps {
  readonly m: Messages;
  readonly onClose: () => void;
}

/** La langue de la page, déduite du libellé `meta.lang` (en ou fr). */
function langueDu(m: Messages): "fr" | "en" {
  return m.meta.lang === "fr" ? "fr" : "en";
}

/** Une liste de touches, lisibles et séparées par des virgules. */
function touchesJointes(touches: readonly string[]): string {
  return touches.join(", ");
}

export function RaccourcisPanel({ m, onClose }: RaccourcisPanelProps): JSX.Element {
  const lang = langueDu(m);
  return (
    <Panel title={m.stage.raccourcis} onClose={onClose} closeLabel={m.common.close}>
      <p className="help">{labelFor(RACCOURCIS.regle, lang)}</p>
      <table className="raccourcis">
        <thead>
          <tr>
            <th scope="col">{m.raccourcis.action}</th>
            <th scope="col">{m.raccourcis.touches}</th>
            <th scope="col">{m.raccourcis.ecran}</th>
          </tr>
        </thead>
        <tbody>{lignes(lang)}</tbody>
      </table>
    </Panel>
  );
}

/** Une ligne par action, dans l'ordre des écrans puis des actions. */
function lignes(lang: "fr" | "en"): JSX.Element[] {
  const lignes: JSX.Element[] = [];
  for (const ecran of ecransOrdonnes()) {
    for (const action of actionsPourEcran(ecran)) {
      const raison = action.touches.length === 0 ? labelFor(action.raison, lang) : null;
      lignes.push(
        <tr key={action.id}>
          <th scope="row">{labelFor(action.libelle, lang)}</th>
          <td>
            {action.touches.length > 0 ? (
              <span className="touches">{touchesJointes(action.touches)}</span>
            ) : (
              <span className="raison">{raison}</span>
            )}
          </td>
          <td>{libelleEcran(action.ecran, lang)}</td>
        </tr>,
      );
    }
  }
  return lignes;
}
