/**
 * Installation du module audio de la corde pincée (cahier §7.9, AIR-F-29).
 *
 * Le processeur vit dans `../worklets/pluck-processor.ts` et doit être servi
 * comme un script compilé : le site l'installe par `audioWorklet.addModule(url)`.
 * Avec Vite, l'URL se construit par un import `?worker&url` du fichier, ou en
 * passant ici l'URL du module déjà construit (recette dans
 * `../worklets/README.md`).
 */

/** Chemin du processeur, relatif à ce fichier. */
export const PLUCK_WORKLET_PATH = "../worklets/pluck-processor.ts";

/** URL par défaut : le fichier source, résolu depuis ce module. */
export function defaultPluckWorkletUrl(): string {
  return new URL(PLUCK_WORKLET_PATH, import.meta.url).href;
}

/**
 * Installe le processeur de corde sur le contexte. À appeler avant toute voix
 * de type `pluck` : `new AudioWorkletNode(...)` échoue si le nom n'est pas
 * enregistré.
 */
export async function installPluckProcessor(
  context: BaseAudioContext,
  url: string = defaultPluckWorkletUrl(),
): Promise<void> {
  await context.audioWorklet.addModule(url);
}
