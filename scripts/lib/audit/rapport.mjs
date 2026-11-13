/**
 * Le rapport : la même information en Markdown (pour être lu) et en JSON
 * (pour être comptée). Le Markdown tient une ligne par constat : une ligne,
 * un fait, un chemin.
 */

/** Le titre des sections, dans l'ordre du cahier des charges. */
const SECTIONS = [
  { cle: "fichiersTropLongs", titre: "(a) Fichiers de code au-delà de 500 lignes" },
  { cle: "fonctionsTropLonges", titre: "(a) Fonctions au-delà de 50 lignes" },
  { cle: "todos", titre: "(b) `todo(` restants dans `packages/` et `apps/`" },
  { cle: "exportsOrphelins", titre: "(c) Fichiers exportés mais jamais importés" },
  { cle: "dependancesInutiles", titre: "(d) Dépendances déclarées et jamais utilisées" },
  { cle: "importsNonDeclares", titre: "(d) Imports de paquets non déclarés" },
  { cle: "documentsOrphelins", titre: "(e) Documents cités par aucun autre document" },
  { cle: "marqueurs", titre: "(f) `TODO`, `FIXME` et `HACK`" },
  { cle: "doublons", titre: "(g) Fichiers dupliqués ou quasi dupliqués" },
];

/** Le tableau de synthèse : les chiffres qui comptent. */
export function resume(rapport) {
  const forge = rapport.github ?? {};
  return [
    ["Fichiers de code au-delà de 500 lignes", rapport.fichiersTropLongs.length],
    ["Fonctions au-delà de 50 lignes", rapport.fonctionsTropLonges.length],
    ["`todo(` restants dans `packages/` et `apps/`", rapport.todos.length],
    ["Fichiers exportés jamais importés", rapport.exportsOrphelins.length],
    ["Dépendances déclarées jamais utilisées", rapport.dependancesInutiles.length],
    ["Imports de paquets non déclarés", rapport.importsNonDeclares.length],
    ["Documents cités par aucun autre document", rapport.documentsOrphelins.length],
    ["`TODO` / `FIXME` / `HACK`", rapport.marqueurs.length],
    ["Groupes de doublons ou quasi-doublons", rapport.doublons.length],
    ["PR ouvertes (API GitHub)", forge.prsOuvertes ?? "—"],
    ["Contrôles verts sur `main` (API GitHub)", forge.testsVerts ?? "—"],
  ];
}

/** Le rapport Markdown complet. */
export function rendreMarkdown(rapport) {
  const parties = [];
  parties.push(`_Généré le ${rapport.genereLe} par \`node scripts/audit-depot.mjs\`._`);
  parties.push("");
  parties.push(`## Résumé`);
  parties.push("");
  parties.push("| Mesure | Nombre |");
  parties.push("|---|---|");
  for (const [mesure, valeur] of resume(rapport)) parties.push(`| ${mesure} | ${valeur} |`);
  for (const section of SECTIONS) {
    parties.push("");
    parties.push(`## ${section.titre}`);
    parties.push("");
    parties.push(...lignesSection(rapport, section.cle));
  }
  parties.push("");
  parties.push("## (h) État de la forge");
  parties.push("");
  parties.push(...lignesForge(rapport.github));
  parties.push("");
  parties.push("## Points durs");
  parties.push("");
  parties.push(...lignesPointsDurs(rapport.pointsDurs));
  return `${parties.join("\n")}\n`;
}

/** Les lignes d'une section : une ligne par constat. */
function lignesSection(rapport, cle) {
  const trouvees = rapport[cle];
  if (!trouvees || trouvees.length === 0) return ["- (rien à signaler)"];
  if (cle === "fichiersTropLongs") return trouvees.map((f) => `- \`${f.fichier}\` — ${f.lignes} lignes (seuil : 500)`);
  if (cle === "fonctionsTropLonges") {
    return trouvees.map((f) => `- \`${f.fichier}:${f.debut}\` — \`${f.nom}\` — ${f.lignes} lignes (seuil : 50)`);
  }
  if (cle === "todos") return trouvees.map((t) => `- \`${t.fichier}:${t.ligne}\` — ${t.extrait}`);
  if (cle === "exportsOrphelins") return trouvees.map((e) => `- \`${e.fichier}\` — exporté, jamais importé ailleurs`);
  if (cle === "dependancesInutiles") {
    return trouvees.map((d) => `- \`${d.nom}\` (${d.version}) — déclaré dans \`${d.manifeste}\`, jamais importé`);
  }
  if (cle === "importsNonDeclares") {
    return trouvees.map((d) => `- \`${d.nom}\` — importé par ${d.fichiers.length} fichier(s), déclaré dans aucun manifeste`);
  }
  if (cle === "documentsOrphelins") return trouvees.map((d) => `- \`${d.document}\` — cité par aucun autre document`);
  if (cle === "marqueurs") return trouvees.map((m) => `- \`${m.fichier}:${m.ligne}\` — \`${m.marqueur}\` — ${m.extrait}`);
  if (cle === "doublons") {
    return trouvees.map((g) => `- groupe \`${g.categorie}\` (${g.fichiers.length} fichiers) : ${g.fichiers.map((f) => `\`${f}\``).join(", ")}`);
  }
  return ["- (rien à signaler)"];
}

/** Les lignes de la section GitHub. */
function lignesForge(forge) {
  if (!forge || !forge.disponible) {
    return [`- Section omise : ${forge?.raison ?? "API GitHub indisponible"}`];
  }
  const lignes = [
    `- Dépôt : \`${forge.depot}\``,
    `- PR ouvertes : ${forge.prsOuvertes ?? "inconnu"}`,
    `- Contrôles verts sur \`main\` : ${forge.testsVerts ?? "inconnu"} (c'est le compteur lu comme « tests verts »)`,
    `- Runs de CI verts parmi les vingt derniers : ${forge.ciVerte ?? "inconnu"}`,
  ];
  for (const note of forge.notes ?? []) lignes.push(`- Note : ${note}`);
  return lignes;
}

/** Les lignes des points durs : ce que le rapport ne sait pas faire. */
function lignesPointsDurs(points) {
  if (!points || points.length === 0) return ["- (aucun)"];
  return points.map((point) => `- ${point}`);
}
