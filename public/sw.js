/**
 * Service worker de Thin Air — fonctionnement hors ligne après la première
 * visite (AIR-F-54). Aucune requête vers une origine tierce (AIR-N-01) :
 * seul le site lui-même est mis en cache, et rien d'autre n'est intercepté.
 *
 * Ce fichier vit dans `public/` à la racine du dépôt : c'est le dossier
 * public de `apps/web` (`publicDir` dans `apps/web/vite.config.ts`), copié
 * tel quel dans `apps/web/dist/` et servi sous `/thin-air/sw.js`.
 *
 * Stratégie
 * ---------
 * - Immuable (coquille HTML, `assets/` horodatés par Vite, `models/`) :
 *   cache d'abord ; ce qui manque est téléchargé une seule fois puis mis en
 *   cache (les requêtes concurrentes partagent la même promesse).
 * - Tout le reste : réseau, sans interception ni copie.
 *
 * Le premier rendu n'est jamais bloqué : l'installation ne met en cache que
 * la coquille (quelques kilo-octets) ; le modèle (7,8 Mo) et ses fichiers
 * d'exécution sont téléchargés en arrière-plan, APRÈS l'activation, et
 * jamais deux fois (ils partagent le même chemin que le gestionnaire de
 * requêtes : si la page les demande pendant le préchauffage, elle reçoit la
 * réponse du téléchargement déjà en cours).
 *
 * Invalidation
 * ------------
 * Le nom du cache porte la version : `thin-air-<VERSION>`. Quand une
 * publication change la coquille, le modèle ou les assets, il faut
 * incrémenter VERSION ci-dessous. À l'activation, la nouvelle version
 * supprime tous les caches d'un autre nom (voir `docs/hors-ligne.md`).
 */

/** Version explicite du cache : à incrémenter à chaque publication qui change un fichier mis en cache. */
const VERSION = "v1";
const NOM_CACHE = `thin-air-${VERSION}`;

/** Racine du site, déduite de l'emplacement de ce script : `/thin-air/` en production, `/` en prévisualisation locale. */
const RACINE = new URL("./", self.location).pathname;

/** La coquille : mise en cache à l'installation, elle est petite et ne bloque rien. */
const COQUILLE = ["./", "./index.html"];

/**
 * Le modèle et ses fichiers d'exécution : préchauffés en arrière-plan après
 * l'activation.
 *
 * Une seule variante de wasm est préchauffée : celle que le site demande
 * (`vision_wasm_internal.*`). La variante module
 * (`vision_wasm_module_internal.*`) n'est demandée par AUCUN chemin du site :
 * le chargeur ne la prend que si un appel passe `useWasmModule: true`, et
 * aucun ne le fait (preuve : docs/poids-publication.md, controlée par
 * `scripts/check-wasm.mjs`). La préchauffer coûterait 14,9 Mo de
 * téléchargement pour rien, et son absence ferait échouer le contrôle.
 */
const LOURDS = [
  "models/hand_landmarker.task",
  "models/wasm/vision_wasm_internal.js",
  "models/wasm/vision_wasm_internal.wasm",
].map((chemin) => new URL(chemin, self.location).href);

/** En-tête posé sur chaque réponse : la preuve, lisible par les tests, d'où elle vient. */
const EN_TETE_SOURCE = "x-thin-air-source";

/** Téléchargements en cours, partagés : une même adresse n'est jamais demandée deux fois au réseau. */
const enCours = new Map();

/** Ces chemins sont immuables (coquille, assets horodatés, modèle) : cache d'abord. */
function estImmuable(url) {
  if (url.origin !== self.location.origin) return false;
  const chemin = url.pathname;
  return (
    chemin === RACINE ||
    chemin === `${RACINE}index.html` ||
    chemin.startsWith(`${RACINE}assets/`) ||
    chemin.startsWith(`${RACINE}models/`)
  );
}

/**
 * Réponse marquée de son origine (`cache` ou `reseau`) : sans corps recopié,
 * le flux de la réponse d'origine est réutilisé tel quel.
 */
function marquee(reponse, source) {
  const entetes = new Headers(reponse.headers);
  entetes.set(EN_TETE_SOURCE, source);
  return new Response(reponse.body, { status: reponse.status, statusText: reponse.statusText, headers: entetes });
}

/**
 * Sert une adresse immuable : cache d'abord ; sinon réseau, une seule fois
 * même si plusieurs appels arrivent ensemble, puis copie dans le cache.
 */
async function servir(url) {
  const cache = await caches.open(NOM_CACHE);
  const deja = await cache.match(url, { ignoreSearch: true });
  if (deja !== undefined) return marquee(deja, "cache");
  const promis = enCours.get(url);
  if (promis !== undefined) return marquee((await promis).clone(), "reseau");
  const telechargement = fetch(url)
    .then(async (reponse) => {
      if (reponse.ok) await cache.put(url, reponse.clone());
      return reponse;
    })
    .finally(() => enCours.delete(url));
  enCours.set(url, telechargement);
  return marquee((await telechargement).clone(), "reseau");
}

/**
 * Préchauffage : le modèle et ses fichiers d'exécution sont téléchargés en
 * arrière-plan, sans bloquer l'installation ni le premier rendu. Chaque
 * adresse passe par `servir` : si la page la demande en même temps, le
 * téléchargement n'a lieu qu'une fois.
 */
function prechauffer() {
  return Promise.allSettled(LOURDS.map((url) => servir(url)));
}

self.addEventListener("install", (event) => {
  // La coquille seulement : l'installation reste brève et le premier rendu
  // n'attend jamais le service worker.
  event.waitUntil(
    caches
      .open(NOM_CACHE)
      .then((cache) => cache.addAll(COQUILLE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const nom of await caches.keys()) {
        if (nom !== NOM_CACHE) await caches.delete(nom);
      }
      await self.clients.claim();
      void prechauffer();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (!estImmuable(url)) return; // le reste : réseau, sans interception (AIR-N-01)
  event.respondWith(servir(url.href));
});
