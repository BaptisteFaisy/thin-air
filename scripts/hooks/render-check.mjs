#!/usr/bin/env node
/**
 * Rendu des prises de référence et comparaison des rapports (cahier §14.3,
 * §11.6, §13.1). Aucune écoute : le banc écrit `events.json`, `render.wav`
 * et `report.json` dans un dossier ignoré (`out/`), et la comparaison se
 * fait par mesures, avec les tolérances du §13.
 *
 * Repli explicite : le banc d'essai et les prises de référence sont le lot
 * B3. Tant qu'ils manquent — ou tant que le squelette lève `TODO(module)` —
 * la garde sort 0 et dit pourquoi. Elle ne fabrique jamais de fausse preuve
 * en silence.
 *
 * Usage : `node scripts/hooks/render-check.mjs` → 0 si les rendus passent,
 * si le banc n'existe pas encore, ou si aucune prise de référence n'est là.
 */
import { estAbsent, estEnChantier, lancer } from "./lib/lancer.mjs";
import { accepter, extensionDe, fichiersSous, journaliser, lireChargeUtile, racine, refuser } from "./lib/io.mjs";

const NOM = "render-check";
const SORTIE = "out/render-check";
/** Le banc est écrit en TypeScript : `tsx` l'exécute, comme `npm run bench`. */
const BANC = ["--import", "tsx", "apps/bench/src/cli.ts"];

/** Les fichiers `.json` d'un dossier, triés (déterminisme, AIR-N-09). */
async function lister(dossier, base) {
  const chemins = [];
  for await (const chemin of fichiersSous(`${base}/${dossier}`)) {
    if (extensionDe(chemin) === ".json") chemins.push(chemin);
  }
  return chemins.sort();
}

/** L'instrument dont le nom apparaît dans celui de la prise, sinon le premier. */
function instrumentPour(prise, instruments) {
  const nom = baseDe(prise);
  const trouve = instruments.find((fichier) => {
    const nomFichier = baseDe(fichier);
    return nom.includes(nomFichier) || nom.includes(nomFichier.replace("-", ""));
  });
  return trouve ?? instruments[0];
}

function baseDe(chemin) {
  return chemin.split("/").pop().replace(/\.json$/, "").toLowerCase();
}

/** Sortie propre et journalisée quand une dépendance d'un autre lot manque. */
async function repli(base, raison) {
  await journaliser(base, { garde: NOM, evenement: "repli", raison });
  accepter(`${NOM} — repli : ${raison}`);
}

const chargeUtile = await lireChargeUtile();
const base = racine(chargeUtile);
const prises = await lister("takes/reference", base);
const instruments = await lister("instruments", base);

if (prises.length === 0) {
  await repli(base, "aucune prise de référence dans takes/reference/ (lot B3) : aucun rendu à comparer");
}
if (instruments.length === 0) {
  await repli(base, "aucun fichier d'instrument : rien à rendre");
}

const echecs = [];
let rendus = 0;
for (const prise of prises) {
  const instrument = instrumentPour(prise, instruments);
  const args = [...BANC, "render", "--take", prise, "--instrument", instrument, "--out", `${base}/${SORTIE}`];
  const resultat = await lancer(process.execPath, args, { cwd: base });
  if (estEnChantier(resultat) || estAbsent(resultat)) {
    const premiere = (resultat.erreur || resultat.sortie).split("\n")[0] ?? "banc absent";
    await repli(base, `banc d'essai non implémenté (lot B3) : ${premiere.slice(0, 200)}`);
  }
  if (resultat.code !== 0) {
    echecs.push(`${baseDe(prise)} × ${baseDe(instrument)} — ${resultat.erreur.slice(0, 400)}`);
    continue;
  }
  rendus += 1;
}

if (echecs.length > 0) {
  await journaliser(base, { garde: NOM, evenement: "refus", rendus, echecs });
  for (const raison of echecs) process.stderr.write(`rendu refusé : ${raison}\n`);
  refuser(`${NOM} : ${echecs.length} rendu(s) en échec sur ${prises.length}`);
}
await journaliser(base, { garde: NOM, evenement: "acceptation", rendus });
accepter(`${NOM} : ${rendus} rendu(s) conforme(s) — des mesures, jamais une écoute`);
