import type { JSX } from "react";

/**
 * Écran d'accueil (cahier §12.1) : « Start », « Play without a camera », et
 * une ligne — « Your camera image never leaves this page ».
 *
 * Les libellés sont contrôlés par `scripts/hooks/wording-guard.mjs` : le
 * vocabulaire imposé est en §5.4 du cahier, et la règle vaut aussi pour les
 * commentaires de ce dossier (ne pas y citer les mots refusés).
 */
export function App(): JSX.Element {
  return (
    <main>
      <h1>Thin Air</h1>
      <p>Your camera image never leaves this page.</p>
      <button type="button">Start</button>
      <button type="button">Play without a camera</button>
    </main>
  );
}
