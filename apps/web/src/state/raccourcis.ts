/**
 * Le manifeste des raccourcis clavier (docs/raccourcis.json), typé pour
 * l'application. Une seule source de vérité : le fichier JSON est lu ici,
 * affiché par `ui/RaccourcisPanel`, et contrôlé par `scripts/check-raccourcis.mjs`.
 *
 * La règle (également portée par le manifeste) : un raccourci par action,
 * jamais deux — dans un contexte donné, une touche appartient à une seule action.
 */
import manifeste from "../../../../docs/raccourcis.json";

export interface Libelle {
  readonly fr: string;
  readonly en: string;
}

export interface ActionRaccourci {
  readonly id: string;
  readonly touches: readonly string[];
  readonly ecran: string;
  readonly contexte: string;
  readonly libelle: Libelle;
  readonly raison: Libelle;
}

export interface ManifesteRaccourcis {
  readonly version: number;
  readonly regle: Libelle;
  readonly ecrans: readonly { readonly id: string; readonly libelle: Libelle }[];
  readonly actions: readonly ActionRaccourci[];
}

/** Le manifeste, figé : l'application affiche la même liste que le contrôleur vérifie. */
export const RACCOURCIS = manifeste as unknown as ManifesteRaccourcis;

/** Un libellé ou une raison dans la langue demandée. */
export function labelFor(libelle: Libelle, lang: "fr" | "en"): string {
  return lang === "fr" ? libelle.fr : libelle.en;
}

/** Le libellé d'un écran (id du manifeste) dans la langue demandée. */
export function libelleEcran(ecran: string, lang: "fr" | "en"): string {
  const trouve = RACCOURCIS.ecrans.find((candidat) => candidat.id === ecran);
  return trouve === undefined ? ecran : labelFor(trouve.libelle, lang);
}

/** Les actions d'un écran, dans l'ordre du manifeste. */
export function actionsPourEcran(ecran: string): readonly ActionRaccourci[] {
  return RACCOURCIS.actions.filter((action) => action.ecran === ecran);
}

/** Les écrans, dans l'ordre déclaré par le manifeste. */
export function ecransOrdonnes(): readonly string[] {
  return RACCOURCIS.ecrans.map((ecran) => ecran.id);
}
