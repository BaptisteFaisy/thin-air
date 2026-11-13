/**
 * La page « ce que ce projet n'est pas » : le contenu est découpé par
 * `limitesDoc.ts` depuis `docs/pas-ce-que-ce-project-nest-pas.md`, la source
 * unique. Ce composant ne fait qu'afficher : titre, date, paragraphes,
 * sections et points, chacun avec sa ligne « Vérifier : … ».
 *
 * Le document est en français ; la page ne le traduit pas — une seule source,
 * aucune copie des libellés dans le code (AIR-N-14 s'applique aux textes
 * d'interface, le contenu de cette page est un document importé au build).
 */
import type { JSX } from "react";
import { LIMITES } from "./limitesDoc.js";

export function PasCeQue(): JSX.Element {
  return (
    <article className="limites" aria-labelledby="limites-titre">
      <h1 id="limites-titre">{LIMITES.titre}</h1>
      {LIMITES.date ? <p className="limites-date">{LIMITES.date}</p> : null}
      {LIMITES.paragraphes.map((paragraphe) => (
        <p key={paragraphe}>{enLigne(paragraphe)}</p>
      ))}
      {LIMITES.sections.map((section) => (
        <section key={section.titre} className="limites-section">
          <h2>{section.titre}</h2>
          <ul>
            {section.points.map((point) => (
              <li key={point.titre}>
                <strong>{point.titre}</strong>{" "}
                {point.texte ? <span>{enLigne(point.texte)}</span> : null}
                {point.verification ? (
                  <p className="limites-verification">{enLigne(point.verification)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

/**
 * Le Markdown en ligne du document : `**gras**` et `code`. Le document reste
 * lisible tel quel sur GitHub, et la page l'affiche sans ses marqueurs.
 */
function enLigne(texte: string): JSX.Element[] {
  return texte.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((morceau, index) => {
    if (morceau.startsWith("**")) return <strong key={index}>{morceau.slice(2, -2)}</strong>;
    if (morceau.startsWith("`")) return <code key={index}>{morceau.slice(1, -1)}</code>;
    return <span key={index}>{morceau}</span>;
  });
}
