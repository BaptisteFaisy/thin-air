/**
 * Le registre des preuves, affiché (cahier §18 : une étape sans preuve n'est
 * pas faite).
 *
 * Le résultat lu ici est écrit par `scripts/verification.mjs` dans
 * `docs/preuves-resultat.json`, importé À LA COMPILATION : aucune requête
 * réseau à l'exécution, aucune origine tierce (AIR-N-01). Le site sert donc
 * ce panneau comme il sert le reste.
 *
 * Chaque ligne dit l'état (ok / ko), la date, la durée et l'extrait de la
 * sortie — le lecteur voit ce qui a été mesuré, pas seulement qu'un test a
 * été vert. Les nombres sont en texte, pas seulement en couleur.
 */
import type { JSX } from "react";

/**
 * Le résultat lu À LA COMPILATION : le registre est un fichier du dépôt, pas
 * une ressource distante. `import.meta.glob` l'intègre dans le bundle, donc
 * l'exécution ne fait aucune requête — encore moins vers une origine tierce
 * (AIR-N-01). Le motif est large pour qu'un dépôt sans registre ne casse pas
 * la construction : le panneau affiche alors « aucun relevé ».
 */
const REGISTRE = import.meta.glob("../../../../docs/preuves-resultat.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/** Une preuve, telle que le script de vérification l'écrit. */
export interface Preuve {
  readonly id: string;
  readonly titre: string;
  readonly commande: string;
  readonly attendu: string;
  readonly fichier: string;
  readonly ok: boolean;
  readonly code: number;
  readonly dureeMs: number;
  readonly date: string;
  readonly extrait: readonly string[];
  readonly mesure: number | null;
}

/** Le résultat complet, tel que le script de vérification l'écrit. */
export interface ResultatPreuves {
  readonly version: number;
  readonly titre: string;
  readonly regle: string;
  readonly genereLe: string;
  readonly total: number;
  readonly ok: number;
  readonly ko: number;
  readonly preuves: readonly Preuve[];
}

/** Le résultat lu, ou un résultat vide si le registre n'a pas encore tourné. */
const RESULTAT = (Object.values(REGISTRE)[0] ?? {
  version: 1,
  titre: "Registre des preuves — Thin Air",
  regle: "Une étape sans preuve n'est pas faite.",
  genereLe: "",
  total: 0,
  ok: 0,
  ko: 0,
  preuves: [],
}) as ResultatPreuves;

/** La date du relevé, en clair : jour, mois, année. */
function dateLisible(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

/** La durée, en une unité lisible : millisecondes, secondes ou minutes. */
function dureeLisible(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

/** Le nombre notable, quand la commande en a produit un. */
function mesureLisible(mesure: number | null): string | null {
  if (mesure === null || !Number.isFinite(mesure)) return null;
  return Number.isInteger(mesure) ? String(mesure) : String(Number(mesure.toFixed(2)));
}

/** L'état d'une preuve, écrit en toutes lettres : jamais par la couleur seule. */
function etat(preuve: Preuve): string {
  return preuve.ok ? "ok" : "ko";
}

/** Le tableau des preuves : une ligne par preuve, avec son extrait. */
export function PreuvesPanel(): JSX.Element {
  const preuves = RESULTAT.preuves ?? [];
  return (
    <section className="preuves" aria-labelledby="preuves-titre">
      <h2 id="preuves-titre">{RESULTAT.titre}</h2>
      <p className="regle">{RESULTAT.regle}</p>
      <p className="resume">
        {RESULTAT.ok} ok, {RESULTAT.ko} ko — relevé du {dateLisible(RESULTAT.genereLe)}.
      </p>
      <table>
        <caption>Chaque preuve, son dernier résultat mesuré et la commande qui la rejoue.</caption>
        <thead>
          <tr>
            <th scope="col">Preuve</th>
            <th scope="col">État</th>
            <th scope="col">Date</th>
            <th scope="col">Durée</th>
            <th scope="col">Mesure</th>
            <th scope="col">Commande</th>
          </tr>
        </thead>
        <tbody>
          {preuves.map((preuve) => {
            const mesure = mesureLisible(preuve.mesure);
            return (
              <tr key={preuve.id} data-preuve={preuve.id} data-etat={etat(preuve)}>
                <th scope="row">
                  <span className="id">{preuve.id}</span> {preuve.titre}
                  <span className="attendu">{preuve.attendu}</span>
                </th>
                <td>{etat(preuve)}</td>
                <td>{dateLisible(preuve.date)}</td>
                <td>{dureeLisible(preuve.dureeMs)}</td>
                <td>{mesure ?? "—"}</td>
                <td>
                  <code className="commande">{preuve.commande}</code>
                  {preuve.extrait.length > 0 ? (
                    <pre className="extrait">{preuve.extrait.slice(-4).join("\n")}</pre>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
