/**
 * Lancement d'une commande enfant, partagé par les gardes qui délèguent à un
 * banc (`render-check`, `core-properties`). Aucune de ces commandes n'ouvre
 * de périphérique audio : le banc rend hors ligne, dans un tableau
 * (cahier §13.1, AIR-N-02).
 */
import { spawn } from "node:child_process";

/** Lance la commande et rend `{ code, sortie, erreur }`. */
export function lancer(commande, args, { cwd = process.cwd(), timeoutMs = 240_000 } = {}) {
  return new Promise((resoudre) => {
    const enfant = spawn(commande, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let sortie = "";
    let erreur = "";
    const minuteur = setTimeout(() => enfant.kill("SIGKILL"), timeoutMs);
    minuteur.unref?.();
    enfant.stdout.on("data", (bloc) => {
      sortie += String(bloc);
    });
    enfant.stderr.on("data", (bloc) => {
      erreur += String(bloc);
    });
    enfant.on("error", (e) => {
      clearTimeout(minuteur);
      resoudre({ code: 1, sortie, erreur: `${erreur}${String(e)}\n` });
    });
    enfant.on("close", (code) => {
      clearTimeout(minuteur);
      resoudre({ code: code ?? 1, sortie, erreur });
    });
  });
}

/**
 * Le repli explicite des gardes : un lot en amont n'est pas encore implémenté.
 * Le squelette du dépôt lève `TODO(module)` tant que le corps manque
 * (`packages/core/src/internal.ts`).
 */
export function estEnChantier(resultat) {
  return resultat.erreur.includes("TODO(") || resultat.sortie.includes("TODO(");
}

/** Un banc absent : aucune preuve à produire, la garde sort proprement. */
export function estAbsent(resultat) {
  return /cannot find module|no such file|command not found|No test files found/i.test(
    `${resultat.erreur}\n${resultat.sortie}`,
  );
}
