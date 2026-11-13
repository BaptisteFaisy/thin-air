/**
 * Le rendu du récapitulatif — la journée en un écran, cinq rubriques.
 *
 * Les cinq rubriques sont celles de `docs/recap-modele.md` : avancé, bloqué,
 * coûteux, demain, risques. Chaque rubrique est alimentée par les sources
 * disponibles ; une source absente est notée « indisponible », jamais
 * comblée par une invention.
 */
import { jourDeLaSemaine } from "./recap-dates.mjs";

/** Une puce markdown, sans espace en fin de ligne. */
function puce(texte) {
  return `- ${String(texte).trim()}`;
}

/** Au-delà du plafond, le compte suffit : le récapitulatif tient sur un écran. */
function plafonner(puces, maximum) {
  if (puces.length <= maximum) return puces;
  return [
    ...puces.slice(0, maximum),
    puce(`… et ${puces.length - maximum} autre(s) — le détail est dans les sources.`),
  ];
}

/** L'en-tête : la date, le jour, et d'où viennent les faits. */
function entete(donnees) {
  return [
    `# Récapitulatif du ${donnees.date} (${jourDeLaSemaine(donnees.date)})`,
    "",
    "Écrit par `scripts/recap.mjs` — Node pur, sans dépendance. Sources :",
    "`gh pr list`, `gh run list`, `docs/journal.md`, `docs/audit-rapport.md`.",
    "Une source injoignable est notée « indisponible » : rien n'est inventé.",
    "",
  ];
}

/** Les PR mergées du jour, ou la raison de l'absence. */
function lignesAvancees(donnees) {
  const source = donnees.prsMergees;
  if (!source.ok) return [puce(`GitHub : indisponible (${source.raison})`)];
  if (!source.lignes.length) return [puce("Aucune PR mergée aujourd'hui.")];
  return plafonner(
    source.lignes.map((pr) => puce(`PR #${pr.numero} — ${pr.titre} (mergée à ${pr.heure}, ${pr.auteur})`)),
    10,
  );
}

/** Les exécutions de la CI du jour : ce qui a tourné, ce qui a échoué. */
function lignesCi(donnees) {
  const source = donnees.executions;
  if (!source.ok) return { verdict: [puce(`GitHub : indisponible (${source.raison})`)], echecs: [], total: null };
  const echecs = source.lignes.filter((course) => course.verdict === "failure" || course.verdict === "cancelled");
  const verdict = echecs.length
    ? echecs.slice(0, 5).map((course) => puce(`CI en échec — ${course.atelier}, branche ${course.branche || "?"}, à ${course.heure}`))
    : [puce("CI : aucune exécution en échec aujourd'hui.")];
  if (echecs.length > 5) verdict.push(puce(`… et ${echecs.length - 5} autre(s) exécution(s) en échec.`));
  return { verdict, echecs, total: source.lignes.length };
}
/** Les puces du journal pour une rubrique donnée. */
function lignesJournal(donnees, rubrique) {
  if (!donnees.journal.ok) return [puce(`Journal : indisponible (${donnees.journal.raison})`)];
  if (!donnees.rubriques[rubrique].length) return [];
  return plafonner(donnees.rubriques[rubrique].map((point) => puce(point)), 5);
}

/** 1. Ce qui a avancé. */
function rubriqueAvancee(donnees) {
  const lignes = ["## 1. Ce qui a avancé", ""];
  lignes.push(...lignesAvancees(donnees));
  if (donnees.journal.avertissement) lignes.push(puce(donnees.journal.avertissement));
  lignes.push(...lignesJournal(donnees, "avance"));
  lignes.push("");
  return lignes;
}

/** 2. Ce qui est resté bloqué. */
function rubriqueBloquee(donnees) {
  const lignes = ["## 2. Ce qui est resté bloqué", ""];
  lignes.push(...lignesCi(donnees).verdict);
  if (donnees.audit.present && !donnees.audit.rempli) {
    lignes.push(puce(`Audit d'accessibilité : ${donnees.audit.detail} — une séance avec des personnes reste à faire.`));
  }
  lignes.push(...lignesJournal(donnees, "bloque"));
  lignes.push("");
  return lignes;
}

/** 3. Ce qui a coûté cher. */
function rubriqueCouteuse(donnees) {
  const lignes = ["## 3. Ce qui a coûté cher", ""];
  const ci = lignesCi(donnees);
  if (ci.total !== null) {
    lignes.push(puce(`CI : ${ci.echecs.length} reprise(s) en échec sur ${ci.total} exécution(s).`));
  }
  const ouvertes = donnees.prsOuvertes;
  if (ouvertes.ok && ouvertes.lignes.length) {
    lignes.push(puce(`${ouvertes.lignes.length} PR encore ouverte(s) : le travail n'est pas terminé.`));
  } else if (ouvertes.ok) {
    lignes.push(puce("Aucune PR ouverte : rien à reprendre."));
  } else {
    lignes.push(puce(`GitHub : indisponible (${ouvertes.raison})`));
  }
  lignes.push(...lignesJournal(donnees, "couteux"));
  lignes.push("");
  return lignes;
}

/** 4. Ce qu'il faut faire demain. */
function rubriqueDemain(donnees) {
  const lignes = ["## 4. Ce qu'il faut faire demain", ""];
  const ouvertes = donnees.prsOuvertes;
  if (ouvertes.ok && ouvertes.lignes.length) {
    for (const pr of ouvertes.lignes) {
      lignes.push(puce(`PR #${pr.numero} — ${pr.titre} (ouverte par ${pr.auteur}${pr.brouillon ? ", brouillon" : ""}).`));
    }
  } else if (ouvertes.ok) {
    lignes.push(puce("Aucune PR ouverte : rien à reprendre demain."));
  } else {
    lignes.push(puce(`GitHub : indisponible (${ouvertes.raison})`));
  }
  const demain = lignesJournal(donnees, "demain");
  lignes.push(...demain);
  if (!demain.length) {
    lignes.push(puce("Rien n'a été écrit pour demain : à compléter à la main, voir `docs/recap-modele.md`."));
  }
  lignes.push("");
  return lignes;
}

/** 5. Les risques. */
function rubriqueRisques(donnees) {
  const lignes = ["## 5. Risques", ""];
  if (donnees.audit.present && !donnees.audit.rempli) {
    lignes.push(puce("Audit d'accessibilité : aucun résultat avec des personnes — la preuve manque."));
  }
  const ci = lignesCi(donnees);
  if (ci.echecs && ci.echecs.length) {
    lignes.push(puce(`CI : ${ci.echecs.length} exécution(s) en échec — une régression peut passer inaperçue.`));
  }
  lignes.push(...lignesJournal(donnees, "risques"));
  lignes.push("");
  return lignes;
}

/** Le récapitulatif complet, en markdown. */
export function rendreRecap(donnees) {
  const lignes = [
    ...entete(donnees),
    ...rubriqueAvancee(donnees),
    ...rubriqueBloquee(donnees),
    ...rubriqueCouteuse(donnees),
    ...rubriqueDemain(donnees),
    ...rubriqueRisques(donnees),
    "---",
    "",
    "Rédigé à la main quand une source manque : `docs/recap-modele.md`.",
    "",
  ];
  return lignes.map((ligne) => ligne.replace(/\s+$/, "")).join("\n");
}
