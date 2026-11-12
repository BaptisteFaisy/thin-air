#!/usr/bin/env -S npx tsx
/**
 * Preuve « la boucle compense le retard » (cahier §5.2, §7.10, AIR-F-35).
 *
 * La démonstration, en ligne de commande, de ce que vérifie le test
 * `apps/bench/src/compensation.test.ts` : huit notes pincées visées sur la
 * grille, jouées avec 105 ms de retard, enregistrées dans une couche, rendues
 * hors ligne — une fois telle quelle, une fois passée par `compensate` — puis
 * mesurées par `attackTimes`. Une prise de référence jouée sans retard donne
 * la position des attaques telle que le moteur les rend.
 *
 * Les trois nombres lus : le retard injecté, l'écart sans compensation,
 * l'écart avec compensation.
 *
 * AUCUN son (AIR-N-02) : le rendu est un calcul dans des `Float32Array`.
 * AUCUNE requête vers l'extérieur : tout est local.
 *
 * Exécution (depuis la racine du dépôt) :
 *   npx tsx apps/bench/src/preuves/compensation.ts
 */
import {
  BOUCLE_S,
  ECHANTILLONS_BOUCLE,
  FENETRE_ASSOCIATION_S,
  MESURES,
  NB_NOTES,
  PAS_S,
  RETARD_S,
  TEMPO,
  instrumentDeLaSimulation,
  simuler,
  type Prise,
  type Simulation,
} from "../compensation-sim.js";

/** Une durée en secondes, affichée en millisecondes, signée. */
function ms(secondes: number): string {
  return `${secondes >= 0 ? "+" : ""}${(secondes * 1000).toFixed(1)} ms`;
}

/** Une durée en secondes, affichée en millisecondes, sans signe. */
function msBrut(secondes: number): string {
  return `${(secondes * 1000).toFixed(1)} ms`;
}

/** Une ligne « étiquette : valeur », alignée. */
function ligne(etiquette: string, valeur: string): string {
  return `  ${etiquette.padEnd(54, " ")}: ${valeur}`;
}

/** Une série d'instants, en millisecondes arrondies. */
function serie(instants: readonly number[]): string {
  return instants.map((t) => (t * 1000).toFixed(0)).join(" ");
}

/** Le cadre et la prise : ce qui est joué, et comment. */
function afficherCadre(): void {
  console.log("");
  console.log("Thin Air — preuve « la boucle compense le retard » (§5.2, §7.10, AIR-F-35)");
  console.log(
    `Cadre : ${TEMPO} battements par minute, ${MESURES} mesures ; boucle ${BOUCLE_S.toFixed(3)} s` +
      ` = ${ECHANTILLONS_BOUCLE} échantillons ; double croche ${msBrut(PAS_S)}.`,
  );
  console.log(
    `Prise : ${NB_NOTES} notes pincées (harpe) visées sur la grille, jouées avec` +
      ` ${msBrut(RETARD_S)} de retard, enregistrées dans une couche, rendues hors ligne` +
      ` (sans réverbération), attaques mesurées par attackTimes et associées à leur note` +
      ` dans une fenêtre de ${msBrut(FENETRE_ASSOCIATION_S)}.`,
  );
}

/** Les trois nombres demandés par la recette. */
function afficherNombres(sim: Simulation): void {
  const part = (sim.ecartSansS / PAS_S) * 100;
  console.log("");
  console.log("Les trois nombres :");
  console.log(ligne("retard injecté", msBrut(RETARD_S)));
  console.log(
    ligne("écart sans compensation", `${ms(sim.ecartSansS)} (${part.toFixed(1)} % d'une double croche)`),
  );
  console.log(
    ligne(
      "écart avec compensation",
      `${ms(sim.ecartAvecS)} contre la référence (au pire ${msBrut(sim.ecartAvecMaxS)})`,
    ),
  );
}

/** Le contexte qui explique les trois nombres. */
function afficherDetail(sim: Simulation): void {
  const dates = (prise: Prise): number => prise.parNote.filter(Number.isFinite).length;
  const brutes = (prise: Prise): number => prise.attaques.length;
  console.log("");
  console.log("Détail :");
  console.log(
    ligne(
      "notes dont l'attaque est datée (réf. / sans / avec)",
      `${dates(sim.reference)} / ${dates(sim.sansCompensation)} / ${dates(sim.avecCompensation)}`,
    ),
  );
  console.log(
    ligne(
      "attaques brutes détectées (réf. / sans / avec)",
      `${brutes(sim.reference)} / ${brutes(sim.sansCompensation)} / ${brutes(sim.avecCompensation)}`,
    ),
  );
  console.log(
    ligne(
      "décalage propre au détecteur (prise de référence)",
      `${ms(sim.biaisMesureS)} en moyenne, au pire ${msBrut(sim.biaisMaxS)}`,
    ),
  );
  console.log(
    ligne("avec compensation, écart à la grille visée", `au pire ${msBrut(sim.ecartAvecGrilleMaxS)}`),
  );
  console.log(ligne("longueur du rendu", `${sim.avecCompensation.echantillons} échantillons`));
  console.log(ligne("rendu reproductible au bit près", sim.reproductible ? "oui" : "non"));
}

/** Les attaques mesurées, prise par prise, et la lecture qui en découle. */
function afficherAttaques(sim: Simulation): void {
  const part = (sim.ecartSansS / PAS_S) * 100;
  console.log("");
  console.log("Attaques mesurées, en millisecondes :");
  console.log(ligne("visées", serie(sim.visees)));
  console.log(ligne("référence (jouée sans retard)", serie(sim.reference.parNote)));
  console.log(ligne("sans compensation", serie(sim.sansCompensation.parNote)));
  console.log(ligne("avec compensation", serie(sim.avecCompensation.parNote)));
  console.log("");
  console.log(
    `Lecture : sans compensation, chaque attaque tombe ${msBrut(sim.ecartSansS)} en retard —` +
      ` ${part.toFixed(1)} % d'une double croche, la boucle « boite » (§7.10). Avec compensation,` +
      ` les attaques retombent sur la grille : ${msBrut(sim.ecartAvecGrilleMaxS)} au pire, dont` +
      ` ${msBrut(sim.biaisMesureS)} viennent du détecteur lui-même.`,
  );
  console.log(
    "Limite : le rendu est hors ligne ; la latence réelle du navigateur n'y est pas" +
      " (docs/compensation.md).",
  );
  console.log("");
}

const instrument = await instrumentDeLaSimulation();
const sim = simuler(instrument);
afficherCadre();
afficherNombres(sim);
afficherDetail(sim);
afficherAttaques(sim);
