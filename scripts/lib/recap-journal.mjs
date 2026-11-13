/**
 * Le journal de bord et le rapport d'audit — les deux sources locales du
 * récapitulatif.
 *
 * `docs/journal.md` est écrit à la main, en sections datées (`## AAAA-MM-JJ —
 * titre`). Chaque puce d'une section est un fait de la journée : le module la
 * range dans l'une des cinq rubriques du récapitulatif (avancé, bloqué,
 * coûteux, demain, risques) d'après les mots qu'elle contient.
 *
 * Le rangement est une heuristique, pas un jugement : il sert à faire remonter
 * les puces au bon endroit, et le rédacteur du récapitulatif corrige à la
 * main ce qui est mal rangé. Un gabarit prêt à remplir est dans
 * `docs/recap-modele.md`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const JOURNAL = "docs/journal.md";
const RAPPORT_AUDIT = "docs/audit-rapport.md";

/** Les mots qui rangent une puce dans une rubrique. */
const MOTS_CLES = {
  bloque: [
    "bloqu", "impossible", "refus", "refuse", "echec", "echoue", "non etabli",
    "non etablie", "reste", "manque", "a verifier", "jamais", "attend", "attente",
    "incertain", "suspendu", "differe", "report",
  ],
  couteux: [
    "coute", "couteux", "cout", "reprise", "repris", "relance", "relancer",
    "perdu", "perte", "longtemps", "minutes", "heures", "plusieurs fois",
    "encore une fois", "refait", "refaire", "contournement", "detour", "agent",
  ],
  demain: [
    "demain", "il faudra", "a faire", "reste a", "prochain", "prochainement",
    "ensuite", "apres", "prevoir", "faut", "suite",
  ],
  risques: [
    "risque", "licence", "juridique", "legal", "securite", "attention", "ecart",
    "assume", "doute", "fragile", "confidentiel", "vie privee", "sensible",
  ],
  avance: [
    "corrige", "ajoute", "ajout", "merge", "mergu", "termine", "verifie",
    "mesure", "avance", "reussi", "fonctionne", "livr", "pret", "en place",
    "remplace", "obtenu", "trouve", "levee", "leves", "corrigee", "corriges",
  ],
};

/** L'ordre de départ quand deux rubriques récoltent autant de mots. */
const ORDRE = ["bloque", "couteux", "demain", "risques", "avance"];

/** Minuscules, sans accents : le classement des mots ne s'y prête pas. */
export function normaliser(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Les sections datées du journal, avec leurs puces. */
export function sectionsDuJournal(texte) {
  const sections = [];
  let courante = null;
  for (const ligne of texte.split("\n")) {
    const entete = ligne.match(/^#{2,3}\s+(.*)$/);
    if (entete) {
      const date = entete[1].match(/(\d{4}-\d{2}-\d{2})/);
      courante = { date: date ? date[1] : "", titre: entete[1].trim(), points: [] };
      if (courante.date) sections.push(courante);
      else courante = null;
      continue;
    }
    if (!courante) continue;
    const puce = ligne.match(/^\s*[-*]\s+(.*)$/);
    if (puce) {
      courante.points.push(puce[1].trim());
      continue;
    }
    const suite = ligne.match(/^\s{2,}(\S.*)$/);
    if (suite && courante.points.length) {
      courante.points[courante.points.length - 1] += ` ${suite[1].trim()}`;
    }
  }
  return sections;
}

/** La section du journal pour la date donnée, ou la plus récente. */
export function lireJournal(racine, date) {
  let texte;
  try {
    texte = readFileSync(join(racine, JOURNAL), "utf8");
  } catch {
    return { ok: false, raison: `${JOURNAL} est absent` };
  }
  const sections = sectionsDuJournal(texte);
  if (!sections.length) return { ok: false, raison: `${JOURNAL} ne porte aucune section datée` };
  const duJour = sections.filter((section) => section.date === date);
  const section = duJour[0] ?? sections[sections.length - 1];
  const avertissement = duJour.length
    ? ""
    : `le journal ne parle pas du ${date} : la dernière entrée (${section.date}) est reprise`;
  return { ok: true, date: section.date, titre: section.titre, points: section.points, avertissement };
}

/** Le rapport d'audit : présent, et rempli ou encore gabarit ? */
export function lireAudit(racine) {
  let texte;
  try {
    texte = readFileSync(join(racine, RAPPORT_AUDIT), "utf8");
  } catch {
    return { present: false, rempli: false, detail: `${RAPPORT_AUDIT} est absent` };
  }
  const champs = texte.match(/\[[^\]\n]{1,60}\]/g) ?? [];
  if (!champs.length) return { present: true, rempli: true, detail: "rapport rempli" };
  return {
    present: true,
    rempli: false,
    detail: `rapport encore gabarit (${champs.length} champ(s) à remplir)`,
  };
}

/** La rubrique d'une puce : celle qui récolte le plus de mots. */
export function classerPuce(puce) {
  const texte = normaliser(puce);
  let meilleure = "avance";
  let score = 0;
  for (const rubrique of ORDRE) {
    const compte = MOTS_CLES[rubrique].filter((mot) => texte.includes(mot)).length;
    if (compte > score) {
      score = compte;
      meilleure = rubrique;
    }
  }
  return meilleure;
}

/** Les puces du journal, rangées dans les cinq rubriques. */
export function classerPoints(points) {
  const rubriques = { avance: [], bloque: [], couteux: [], demain: [], risques: [] };
  for (const puce of points) {
    rubriques[classerPuce(puce)].push(puce);
  }
  return rubriques;
}
