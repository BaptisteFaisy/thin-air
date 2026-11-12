/** Écran d'accueil (cahier §12.1) : deux portes, et la promesse de confidentialité. */
import type { JSX } from "react";
import type { Messages } from "../i18n/index.js";

export interface HomeProps {
  readonly m: Messages;
  readonly onStart: () => void;
  readonly onPointer: () => void;
}

export function Home({ m, onStart, onPointer }: HomeProps): JSX.Element {
  return (
    <main className="screen home">
      <h1>{m.meta.appName}</h1>
      <p className="tagline">{m.meta.tagline}</p>
      <p className="privacy" aria-live="polite">
        {m.home.privacyLine}
      </p>
      <p className="why">{m.home.privacyWhy}</p>
      <div className="actions">
        <button type="button" className="primary" onClick={onStart}>
          {m.home.start}
        </button>
        <button type="button" onClick={onPointer}>
          {m.home.playWithoutCamera}
        </button>
        {/* Raccord 1 : les leçons chiffrées sont atteignables depuis l'accueil.
            Le libellé vient du catalogue i18n (`lessons.link`), comme le reste. */}
        <a className="link-lecons" href="?lecons=1">
          {m.lessons.link}
        </a>
      </div>
      <ul className="notes">
        <li>{m.home.audioNote}</li>
        <li>{m.home.latencyNote}</li>
        <li>{m.home.keyboardHint}</li>
        <li>{m.home.cameraNote}</li>
      </ul>
    </main>
  );
}
