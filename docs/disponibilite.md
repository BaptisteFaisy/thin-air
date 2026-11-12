# Disponibilité du site publié — la sonde et ce qu'elle prouve

AIR-N-13 : le site est statique, en HTTPS, gratuit, et **en ligne jusqu'au
29 janvier 2027 au moins**. La sonde `scripts/sonde-dispo.mjs` est le garde qui
vérifie la troisième condition tous les jours, sans attendre qu'un visiteur
s'aperçoive que l'adresse est morte.

## 1. Ce que la sonde vérifie

Une passe interroge **quatre ressources critiques** de l'adresse publique, dans
cet ordre fixe :

| Ressource | Chemin | Requête |
|---|---|---|
| `page` | l'adresse elle-même (`index.html`) | GET au **corps plafonné** à 64 Kio, connexion coupée dès le plafond |
| `js` | le JS principal, **lu dans la page** (`assets/<empreinte>.js`) | HEAD |
| `modele` | `models/hand_landmarker.task` | HEAD |
| `wasm` | `models/wasm/vision_wasm_internal.wasm` | HEAD |

Les HEAD ne demandent aucun corps ; si un hébergeur les refuse (405 ou 501), la
sonde replie sur un GET à plage `bytes=0-0` et jette la réponse. **Les ~22 Mo du
modèle et de son moteur d'exécution ne sont donc jamais téléchargés** — la sonde
coûte quelques ko par jour.

Sur chaque ressource, trois choses sont contrôlées :

1. **le code HTTP** : un 2xx, sinon « fichier non servi » ;
2. **le `Content-Type`** : `text/html` pour la page, `application/javascript`
   (ou `text/javascript`) pour le JS, `application/octet-stream` pour le modèle,
   `application/wasm` pour le wasm — un type faux casse le chargement du wasm ou
   fait exécuter du HTML comme du JS ;
3. **la présence de `Cache-Control`** : sans lui, chaque visiteur retélécharge le
   modèle, et l'objectif des trente secondes du cahier §4 tombe
   (`docs/hosting.md`).

Deux contrôles s'ajoutent :

- **l'adresse est en HTTPS** (sauf machine locale, pour les essais) : sans TLS la
  caméra est refusée, donc pas d'instrument (AIR-N-13) ;
- **le JS nommé par la page vient de la même origine** : une origine tierce est
  une anomalie (AIR-N-01), pas un détail.

Le résultat est **horodaté et écrit** dans `out/sonde/<AAAA-MM-JJ>.json`
(dossier ignoré par git), et la sonde **sort non nul dès la première anomalie**,
avec un message lisible par ressource.

```sh
node scripts/sonde-dispo.mjs                        # adresse par défaut, sortie humaine
node scripts/sonde-dispo.mjs --json                 # le JSON sur la sortie standard aussi
node scripts/sonde-dispo.mjs --url https://autre.adresse/ --out /tmp/sonde
```

L'adresse par défaut est celle que publie `.github/workflows/deploy.yml`
(GitHub Pages, base `/thin-air/`). Le workflow `.github/workflows/sonde.yml` la
lance chaque jour à 05:12:00.000Z et à la demande ; **il n'est jamais déclenché par
une PR** — une PR ne change rien à ce que l'hébergeur sert. Le JSON part en
artefact, et un run rouge est l'alerte.

### Sortie réelle, mesurée sur l'adresse publiée

Relevé du 12 novembre 2026, `node scripts/sonde-dispo.mjs` sur ce poste, code de
sortie `0` :

```text
sonde Thin Air (AIR-N-13) — https://baptistefaisy.github.io/thin-air/
  ✓ page    GET corps plafonné 206  text/html; charset=utf-8 · cache-control: max-age=600
  ✓ js      HEAD               200  application/javascript; charset=utf-8 · cache-control: max-age=600
  ✓ modele  HEAD               200  application/octet-stream · cache-control: max-age=600
  ✓ wasm    HEAD               200  application/wasm · cache-control: max-age=600
site servi, aucune anomalie — résultat écrit dans out/sonde/2026-11-12T00-00-00.000Z.json
```

Le `206` de la page est la réponse normale à une requête à plage : l'hébergeur
sert la plage demandée. Le `cache-control: max-age=600` sur les quatre ressources
est la politique de l'hébergeur, pas celle que `docs/hosting.md` recommande pour
le modèle (un an, immutable) : la sonde exige la **présence** de l'en-tête, elle
n'impose pas sa valeur — c'est dit ici plutôt que laissé deviner.

### Les tests de la sonde

`scripts/sonde-dispo.test.mjs` lance la sonde contre un serveur `node:http`
éphémère sur `127.0.0.1`, port aléatoire : **aucun réseau extérieur**, aucun
octet du vrai modèle. Sept cas, dont ceux que le lot exige : site entièrement
servi → code 0 ; modèle en 404 → code non nul et message citant la ressource et
le code ; `Content-Type` faux sur le wasm → signalé ; `Cache-Control` absent →
signalé ; page sans JS référencé → signalé ; JS sur une origine tierce → refusé ;
adresse non HTTPS → refusée.

```sh
node --test scripts/sonde-dispo.test.mjs
```

`vitest.config.ts` est gelé (`docs/CONTRACT.md`) et ne ramasse que `packages/*`
et `apps/*` : ce fichier tourne donc sur le banc standard de Node, sans
dépendance ajoutée au dépôt.

## 2. Ce que la sonde ne vérifie PAS

La liste est courte et sans complaisance :

- **Elle ne prouve pas que l'instrument joue.** Elle prouve que des fichiers
  sont servis. Aucune exécution de JS, aucun moteur audio, aucune caméra, aucune
  note : la sonde n'ouvre pas de navigateur. Dire « le site fonctionne » à partir
  d'un vert serait mentir — la preuve de jeu passe par les specs de bout en bout
  (`apps/web/e2e/`) et par une écoute humaine (`docs/seance-ecoute.md`).
- **Elle ne vérifie pas les octets du modèle.** Un HEAD ne dit rien du contenu :
  un fichier tronqué ou remplacé rendrait toujours 200 avec le bon
  `Content-Type`. Une empreinte exigerait de télécharger les 22 Mo, ce que la
  sonde refuse de faire.
- **Elle ne mesure pas le délai.** Ni le temps de réponse, ni l'objectif des
  trente secondes du cahier §4 : pour cela, `docs/latency.md` et ses mesures.
- **Elle ne voit pas entre deux passes.** Une coupure de trois heures un
  après-midi peut passer inaperçue : la granularité est quotidienne.
- **Elle ne prouve pas que l'adresse tiendra.** Un hébergeur peut changer sa
  politique d'offre gratuite, suspendre un compte inactif, ou laisser expirer un
  certificat : la sonde constate l'état du jour, jamais une promesse.
- **Elle ne couvre pas le repli.** Si l'adresse de secours (`docs/hosting.md` §4)
  n'est pas celle passée en `--url`, rien ne la surveille.

## 3. Lire un échec

Chaque anomalie nomme la ressource, son chemin et le problème, par exemple :

```text
  ✗ modele (/thin-air/models/hand_landmarker.task) : HTTP 404, attendu 2xx — fichier non servi
  ✗ wasm (/thin-air/models/wasm/vision_wasm_internal.wasm) : Content-Type « text/plain », attendu « application/wasm » ou « application/octet-stream »
  ✗ js (/thin-air/assets/index-B9iGTymQ.js) : Cache-Control absent — le visiteur retéléchargerait le modèle à chaque passage (docs/hosting.md)
  ✗ page (/thin-air/) : requête impossible — fetch failed
```

Dans l'ordre :

1. **Ouvrir l'adresse dans un navigateur.** La sonde dit ce que l'hébergeur
   répond ; le navigateur dit ce que le visiteur voit. Les deux peuvent
   différer (cache, certificat, DNS local).
2. **Relire le dernier run de `deploy.yml`.** Un déploiement cassé explique la
   plupart des 404 : soit le build a échoué, soit le dossier publié ne contient
   plus la ressource (le modèle et son wasm ne sont pas versionnés — ils sont
   téléchargés puis copiés au build).
3. **Relancer à la main** pour écarter un incident d'une minute :
   `node scripts/sonde-dispo.mjs --json`. Un vert immédiat après un rouge isolé
   reste un rouge à noter : l'artefact du jour dans l'onglet Actions en garde la
   trace.
4. **`requête impossible`** (DNS, TLS, délai dépassé de 20 000 ms) : c'est l'origine
   entière qui ne répond pas, pas une ressource. Vérifier la page d'état de
   l'hébergeur avant de toucher au dépôt.
5. **Une anomalie `Content-Type` ou `Cache-Control` seule** : l'hébergeur a
   changé sa politique d'en-têtes. Ce n'est pas une coupure, mais cela coûte le
   délai de premier chargement — à traiter comme un défaut, pas comme du bruit.

## 4. Le repli d'hébergement, en deux minutes

Si l'adresse surveillée ne répond plus et que l'hébergeur est en cause, le repli
préparé est **GitHub Pages** : la procédure exacte — build, publication du
dossier `apps/web/dist`, réglage Pages, « Enforce HTTPS », et le piège du chemin
de base `/<repo>/` — est écrite dans **`docs/hosting.md` §4** (« Standing
fallback: GitHub Pages »). Elle n'est pas recopiée ici : un seul endroit dit le
repli, et c'est celui-là.

Ce qui change pour la sonde après un repli : **rien dans le code**, tout dans
l'argument. Passer la nouvelle adresse en `--url`, puis mettre à jour
`URL_DEFAUT` dans `scripts/sonde-dispo.mjs` et le `§5` de `docs/hosting.md`, pour
que le run quotidien surveille l'adresse réellement donnée au jury.

## 5. Fin de l'engagement

**29 janvier 2027** : c'est la date jusqu'à laquelle l'adresse doit rester en
ligne (AIR-N-13), et c'est une règle du concours, pas une préférence. Le run
quotidien de la sonde n'a de sens que jusqu'à cette date comprise : la dernière
semaine de janvier 2027, l'adresse est revérifiée à la main
(`docs/hosting.md` §5), et le repli du §4 existe pour que cette vérification
puisse se terminer, si nécessaire, par une bascule de deux minutes plutôt que
par une panique.
