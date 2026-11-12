/**
 * La porte discrète vers la borne (cahier §12.1, §12.2) : un lien ordinaire,
 * atteint au clavier depuis l'accueil, qui ouvre la page en mode kiosque
 * (`?kiosk=1`). La borne elle-même vit dans `kiosk/` ; ce composant ne fait
 * que l'annoncer, sans la démarrer : rien n'est ouvert avant le clic.
 */
import type { JSX } from "react";
import type { Messages } from "../i18n/index.js";
import { KIOSK_PARAM } from "../kiosk/kiosk.js";

/** L'adresse de la borne, dans la langue de la page en cours. */
export function kioskHref(search: string): string {
  const parametres = new URLSearchParams(search);
  parametres.set(KIOSK_PARAM, "1");
  return `?${parametres.toString()}`;
}

export function KioskEntry({ m, search }: { readonly m: Messages; readonly search: string }): JSX.Element {
  return (
    <nav className="kiosk-entry" aria-label={m.home.kiosk}>
      <a href={kioskHref(search)}>{m.home.kiosk}</a>
      <p className="help">{m.home.kioskHint}</p>
    </nav>
  );
}
