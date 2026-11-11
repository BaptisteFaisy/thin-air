/**
 * Enregistrement du service worker (AIR-F-54) : après une première visite,
 * la coquille, le modèle et ses fichiers d'exécution sont servis depuis le
 * cache, sans réseau. Le script vit dans le dossier public du site et est
 * publié sous `<racine>/sw.js` ; son champ d'action est la racine du site
 * (`/thin-air/` en production), donc toutes les adresses du jeu sont
 * interceptées — un champ trop étroit ne capturerait rien.
 *
 * Trois garde-fous, et un repli toujours silencieux :
 * - uniquement une construction de production : le mode développement garde
 *   son rechargement à chaud, jamais mis en cache ;
 * - uniquement un contexte sûr (HTTPS ou hôte local) : ailleurs l'API est
 *   indisponible de toute façon ;
 * - si l'API manque ou si l'enregistrement échoue, rien ne se passe : le jeu
 *   continue sans hors ligne, sans message ni erreur.
 */
import { RACINE_SITE } from "../hooks/useSession.js";

export function enregistrerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  navigator.serviceWorker.register(`${RACINE_SITE}sw.js`, { scope: RACINE_SITE }).catch(() => {
    /* hors ligne indisponible ici : le jeu continue, silencieusement */
  });
}
