/**
 * La page « ce que ce projet n'est pas » : le texte vient du document
 * `docs/pas-ce-que-ce-project-nest-pas.md`, importé au build (une seule
 * source : le document, §5.4 — aucun libellé recopié dans le code).
 *
 * Ce module ne fait que découper ce Markdown-là. Il ne traduit rien : le
 * document est en français, le site l'affiche tel quel.
 *
 * Format lu (une ligne par élément) :
 *   `# Titre`                       → le titre de la page
 *   `> Date de validation : …`      → la date, affichée sous le titre
 *   `## Titre de section`           → une section
 *   `- **Point.** Texte du point.`  → un point de la section courante
 *   `  Vérifier : …`                → comment vérifier le point courant
 *
 * Les paragraphes d'introduction sont les lignes libres avant la première
 * section ; les lignes libres d'une section prolongent le point courant.
 */
import source from "../../../../docs/pas-ce-que-ce-project-nest-pas.md?raw";

/** Un point d'une section : son titre, son texte, et comment le vérifier. */
export interface LimitePoint {
  readonly titre: string;
  readonly texte: string;
  readonly verification: string;
}

/** Une section de la page : un titre et ses points. */
export interface LimiteSection {
  readonly titre: string;
  readonly points: readonly LimitePoint[];
}

/** Le document découpé : titre, date, paragraphes d'introduction, sections. */
export interface LimiteDocument {
  readonly titre: string;
  readonly date: string;
  readonly paragraphes: readonly string[];
  readonly sections: readonly LimiteSection[];
}

const TITRE = /^#\s+(.+)$/;
const DATE = /^>\s+(.+)$/;
const SECTION = /^##\s+(.+)$/;
const POINT = /^-\s+\*\*(.+?)\*\*\s*(.*)$/;
const VERIFICATION = /^\s{2,}(Vérifier\s*:.*)$/;

/** La valeur du premier groupe de capture, sinon une chaîne vide. */
function groupe(match: RegExpExecArray | null, index: number): string {
  if (match === null) return "";
  const valeur = match[index];
  return valeur ?? "";
}

/** Découpe le document en sections et points ; les lignes libres sont jointes. */
export function analyserDocument(markdown: string): LimiteDocument {
  const paragraphes: string[] = [];
  const sections: { titre: string; points: LimitePoint[] }[] = [];
  let titre = "";
  let date = "";
  let introduction = "";
  let point: { titre: string; texte: string; verification: string } | null = null;

  for (const ligne of markdown.split("\n")) {
    const section = SECTION.exec(ligne);
    if (section) {
      sections.push({ titre: groupe(section, 1), points: [] });
      point = null;
      continue;
    }
    const tete = TITRE.exec(ligne);
    if (tete) {
      titre = groupe(tete, 1);
      continue;
    }
    const entete = DATE.exec(ligne);
    if (entete) {
      date = groupe(entete, 1);
      continue;
    }
    const nouveau = POINT.exec(ligne);
    if (nouveau) {
      const courante = sections[sections.length - 1];
      point = { titre: groupe(nouveau, 1), texte: groupe(nouveau, 2), verification: "" };
      courante?.points.push(point);
      continue;
    }
    const verification = VERIFICATION.exec(ligne);
    if (verification && point) {
      point.verification = groupe(verification, 1);
      continue;
    }
    const libre = ligne.trim();
    if (libre === "") continue;
    if (point) {
      point.texte = `${point.texte} ${libre}`.trim();
    } else if (sections.length === 0) {
      introduction = `${introduction} ${libre}`.trim();
    }
  }

  if (introduction !== "") paragraphes.push(introduction);
  return { titre, date, paragraphes, sections };
}

/** Le document du dépôt, découpé. Le composant lit cette valeur, rien d'autre. */
export const LIMITES: LimiteDocument = analyserDocument(source);
