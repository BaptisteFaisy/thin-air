# Partager une prise par un lien (sans serveur)

Une prise est le flux des points des mains, jamais l'image (cahier §7.11).
Ce document dit comment la faire tenir dans le fragment d'une adresse — comme
on partage déjà un instrument (AIR-F-45) — et pourquoi cette opération mérite
plus d'attention qu'un simple « copier le lien ».

## Deux usages

1. **Partager une performance.** On rejoue exactement ce qui a été joué
   (AIR-F-48) : le destinataire ouvre le lien et la prise repart comme si les
   mains étaient devant la caméra. C'est le fantôme (AIR-F-50), mais déclenché
   par une adresse, pas par vingt secondes sans main.
2. **Joindre une prise à un rapport de défaut.** La recette et le cahier
   (§16, réglage du filtre) demandent « envoie-moi la prise ». Le lien est la
   version légère de cet envoi : celui qui ouvre le rapport rejoue le geste
   exact qui a produit le défaut, sans qu'on ait à décrire « je bouge la main
   comme ça… ».

Dans les deux cas : aucun serveur, aucune requête (AIR-N-01). Le fragment
d'adresse ne part jamais sur le réseau au moment de la navigation — c'est le
navigateur qui le garde, et c'est aussi là que commence la prudence.

## Ce que contient le fragment — des points, et rien d'autre

Le fragment porte, dans un octet de tête puis un de ces deux marqueurs :

| Marqueur | Charge utile | Écrit par |
|---|---|---|
| `2` | `encodeTake(prise)` : le codage binaire 16 bits de `take-codec.ts`, avec son CRC-32 | `takeToFragment` (synchrone) |
| `3` | `deflate-raw` de `encodeTake(prise)` | `takeToFragmentAsync` (compressé) |

Les marqueurs `0` et `1` appartiennent à l'instrument ; les prises commencent à
`2` dans l'autre sens. Les deux familles ne peuvent donc jamais se confondre :
`takeFromFragment` refuse un fragment d'instrument avec une raison lisible qui
nomme `instrumentFromFragment`, et `instrumentFromFragment` refuse un fragment
de prise (marqueur inconnu). Le test le prouve dans les deux sens.

Le codage réutilisé est celui de `take-codec.ts` (entiers 16 bits + CRC), pas
du JSON : une prise est mille fois plus lourde qu'un instrument, et le fragment
doit rester court. Ce que contient **réellement** une prise n'a pas changé :
la cadence, puis pour chaque image un horodatage et, par main, le côté, le
score et 21 points. Aucune image, aucune vignette, aucun chemin de fichier —
la garde `take-privacy-guard.mjs` et `assertTakePrivacy` refusent toute autre
clé en entier (§7.11, AIR-F-47).

## Mesures : le fragment tient-il dans une adresse ?

Prises de synthèse à deux mains, 30 images par seconde (le générateur
`crossingHandsTake` de `@thin-air/core`), mesurées sur Node 26 (zlib) :

| Durée | Images | Fragment brut (synchrone) | Fragment compressé (asynchrone) |
|---|---|---|---|
| 1 s | 31 | 11 070 caractères | 6 095 caractères |
| 5 s | 151 | 53 790 caractères | 29 734 caractères |
| 30 s | 901 | 320 790 caractères | 133 378 caractères |

Le brut est de l'arithmétique pure : chaque image pèse 267 octets (8
d'horodatage, 1 de nombre de mains, 2 × 129 par main), plus 24 d'en-tête et 1
de marqueur. Le compressé dépend de la version de zlib ; l'ordre de grandeur
est stable (un geste continu se répète, donc se serre bien).

**La limite pratique retenue est 65 536 caractères.** Pourquoi ce nombre :
c'est la borne la plus étroite documentée parmi les quatre navigateurs visés.
Firefox annonce environ 64 Kio pour une adresse, Safari environ 80 Ko, Chrome
et Edge bien davantage. La vieille limite de 2 048 caractères valait pour
Internet Explorer, qui n'est pas ciblé.

Conséquence, dite sans détour : **1 s et 5 s tiennent dans un lien ; 30 s ne
tient pas**, même compressé (133 378 > 65 536). Pour une prise longue, il faut
le téléchargement (AIR-F-47), pas le lien. L'interface doit donc mesurer la
longueur et refuser le lien, en proposant le fichier, au lieu d'exposer une
adresse que certains navigateurs tronqueraient.

## Vie privée : une prise est une donnée corporelle

Le cahier est ferme : les points d'une main ne sont pas une image, mais ils
restent une donnée corporelle (§7.11). Une prise n'est enregistrée que
sur demande et reste sur l'appareil (AIR-F-47). La mettre dans un lien change
la nature de l'objet : le lien se copie, se colle, se transmet ; il se retrouve
dans un **historique de navigateur**, dans un **presse-papiers**, et s'il est
collé dans un outil tiers (un forum, un gestionnaire de tickets, un rapport de
défaut), il peut y être **stocké ou journalisé** par cet outil. Le fragment
d'adresse n'est pas envoyé au serveur par la navigation, mais tout ce qui
existe en clair dans une adresse finit par vivre quelque part dès qu'un humain
le colle ailleurs.

Le projet se donne donc une règle, la même que pour l'enregistrement :

1. **Avertissement explicite avant de copier.** Aucun lien n'est fabriqué ni
   copié sans que la personne sache exactement ce qu'elle met dedans.
2. **Jamais d'envoi automatique.** Pas de téléversement, pas d'envoi d'analyse,
   pas de « partager sur … ». Le lien n'est produit que sur un clic volontaire
   (AIR-N-01).
3. **La prise reste sur l'appareil par défaut.** Le lien est une copie
   volontaire et révocable, pas la forme de stockage : la prise elle-même
   continue de vivre localement (AIR-F-47).

### Ce que l'interface doit dire au moment du clic

Au clic sur « Partager la prise », une fenêtre précède la copie :

> Partager cette prise met les mouvements de vos mains dans un lien. Ce lien
> peut être recopié, collé et conservé ailleurs (historique, rapport de défaut,
> messagerie). Il ne contient aucune image, uniquement les points des mains, et
> il n'est envoyé à aucun serveur. Rien n'est partagé avant que vous ne colliez
> ce lien vous-même. Copier le lien ?

Deux boutons : **« Copier le lien »** (l'action, après confirmation) et
**« Télécharger la prise »** (le repli AIR-F-47, toujours disponible). Si la
prise dépasse la limite de 65 536 caractères, le bouton « Copier le lien » est
désactivé et la fenêtre dit :

> Cette prise est trop longue pour tenir dans une adresse. Téléchargez le
> fichier et joignez-le à la place.

## Branchement dans `apps/web` (à faire, décrit sans le faire)

Le code du schéma est prêt dans `@thin-air/schema` ; il reste à le câbler dans
la page sur le modèle exact de l'instrument.

1. **`apps/web/src/state/prises.ts`** (nouveau, miroir de `instruments.ts`).
   Importer `takeToFragment`, `takeToFragmentAsync`, `takeFromFragment` depuis
   `@thin-air/schema`, et exposer :
   - `lienPartagePrise(prise, origine, chemin = "/")` → `${base}${chemin}#t=${fragment}`
     (même construction que `shareLink`, marqueur `#t=` au lieu de `#i=`) ;
   - `priseDansLocation(hash)` → `takeFromFragment(hash.slice(marqueur + 3))`
     ou `null` si `#t=` est absent (comme `instrumentInLocation`) ;
   - `lireFragmentPrise(hash)` → `{ prise, refus }` avec refus jamais silencieux
     (comme `lireFragment` / `FragmentLecture`).
   Choisir `takeToFragmentAsync` quand `CompressionStream` est disponible pour
   les prises de 5 s, `takeToFragment` en repli (le lecteur `priseDansLocation`
   utilise `takeFromFragmentAsync`, qui lit les deux marqueurs).

2. **Le bouton « Partager la prise »**, à côté du téléchargement existant
   (`downloadTake` dans `packages/vision/src/recorder.ts`). Au clic : calculer
   le lien, mesurer `lien.length`, puis :
   - ≤ 65 536 → afficher la fenêtre de confirmation ci-dessus, et n'appeler
     `navigator.clipboard.writeText(lien)` qu'après le clic sur « Copier le lien » ;
   - > 65 536 → désactiver le bouton et proposer le téléchargement.

3. **Le rejeu au chargement** (AIR-F-48). Au démarrage, lire `location.hash` :
   si `#t=` est présent et valide, proposer « Rejouer la prise du lien » ;
   réutiliser `replayTimeline` / la source `replay` de `packages/vision/src/replay.ts`
   pour nourrir le moteur, sans modèle et sans image. Ne pas démarrer le rejeu
   tout seul (une adresse n'est pas un ordre).

4. **Le rapport de défaut** (§16). Le même bouton « Copier le lien de la prise »
   à l'intérieur du rapport : la personne colle le lien elle-même dans le
   ticket. Aucun envoi automatique, cohérent avec la règle ci-dessus.

5. **Traductions.** Les textes vont dans `apps/web/src/i18n/fr.ts` (et la
   variante anglaise), en évitant le vocabulaire interdit par `wording-guard.mjs`.

6. **Tests.** Miroir de `apps/web/src/state/instruments.test.ts` : lien produit
   sans `#`, lecture de `#t=`, refus lisible d'un fragment d'instrument, et
   borne de 65 536 caractères qui bascule vers le téléchargement.