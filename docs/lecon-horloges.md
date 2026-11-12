# Leçon « la couture des deux horloges » (§5.1, §7.1, §7.9)

Troisième écran pédagogique du parcours P5 (« Show the physics »), après le
filtrage et les centièmes (`docs/lecons.md`). Celui-ci montre le sujet même du
projet : la rencontre de deux horloges qui ne battent pas la mesure du même pas.

## 1. Les deux horloges

| Horloge | Cadence | Pas | Caractère |
|---|---|---|---|
| Les images | 30 par seconde (la prise, §7.11) | 33,3 ms | irrégulière : la caméra hoquette, des images sautent |
| Le son | 48 000 échantillons par seconde (`SAMPLE_RATE`) | ≈ 0,021 ms | régulière : c'est la seule qui tienne le rythme |

Une image vaut donc **1 600 échantillons** (48 000 / 30). Toute la couture
(§7.9) tient dans ce rapport : les gestes arrivent 30 fois par seconde, le son
doit avancer 48 000 fois par seconde sans jamais entendre les marches.

## 2. Ce que la couture fait des gestes (les trois règles du §7.9)

1. **Rampes.** Aucun réglage audio n'est fixé directement pendant qu'une voix
   sonne : chaque mise à jour passe par une rampe de τ = `paramTauMs` = 20 ms
   (soit 960 échantillons). Sans cela, la hauteur avance par marches 30 fois
   par seconde et le son grésille.
2. **Datation.** Tout événement porte un moment sur l'horloge du son : le
   présent audio (`currentTime`) plus **5 ms d'avance** (`lookaheadMs`, §7.13).
   La boucle programme par avance — un minuteur passe toutes les 25 ms et
   programme les 100 ms qui viennent — parce que les minuteurs du navigateur ne
   sont pas assez précis pour le rythme.
3. **Voix bornées.** Huit voix au plus, toutes relâchées si aucune image n'a
   été analysée depuis 300 ms.

La leçon montre la règle 2 en action : pour chaque image de la prise, le moment
programmé vaut exactement le moment de l'image plus 5 ms, et les deux se lisent
en secondes **et** en échantillons — l'unité que voient les voix. Quand des
images sautent (prise hoquetante), la programmation ne recule jamais : c'est la
propriété AIR-P-11, testée.

## 3. Les trois nombres du retard (§5.1, §5.2)

L'écran de la leçon affiche trois nombres, calculés par les mêmes fonctions que
l'écran principal (`state/latency.ts`), jamais illustrés au jugé :

| Nombre | Origine | Exemple de l'écran (§5.2) |
|---|---|---|
| Retard mesuré (analyse et audio) | mesuré dans le navigateur | analyse 12 ms + traitement 2 ms + sortie 21 ms = **35 ms** |
| Retard estimé de la caméra | non mesurable dans le navigateur, estimé | **50 ms** (réglable de 0 à 120, §7.10) |
| Total | somme des deux | **85 ms** dans cet exemple |

Le total affiché est la somme annoncée, et le test le vérifie : c'est
l'exigence d'honnêteté AIR-N-12 — toute valeur porte la mention « mesuré » ou
« estimé », et le vocabulaire imposé du §5.4 s'applique (on écrit « retard
estimé », « retard mesuré » ; les mots qui promettent un retard nul ou
imperceptible sont refusés par le garde automatique).

Les ordres de grandeur du §5.1, pour situer l'exemple :

| Étape | Ordre de grandeur | Mesurable ? |
|---|---|---|
| Caméra (exposition, capteur, compression, transport) | 30 à 70 ms | non : estimé |
| Attente de l'image suivante | 0 à 33 ms à 30 im/s, 17 en moyenne | oui |
| Analyse des mains | 5 à 25 ms (12 ms sur processeur graphique, 17 ms sur processeur annoncés pour un Pixel 6) | oui |
| Filtrage, gestes, correspondance | 1 à 5 ms | oui |
| Sortie audio | 10 à 45 ms en filaire ; 150 à 250 ms de plus en casque sans fil | en partie (`baseLatency`, `outputLatency`) |
| **Total** | **46 à 178 ms ; environ 105 ms dans un cas courant, en filaire** | |

## 4. La métaphore des 34 mètres (§5.1)

Cent millisecondes, c'est le temps que met le son pour parcourir **34 mètres**.
Un organiste dont les tuyaux sont à 34 mètres de la console joue avec ce
retard — personne ne trouve cela choquant sur un orgue d'église. On s'y fait
pour des sons tenus ; on ne s'y fait pas pour frapper en rythme. D'où les deux
réponses du projet :

- des instruments qui supportent le retard (sons tenus d'abord, cordes pincées
  ensuite, percussion seulement calée sur une grille — §5.2) ;
- la boucle **compense** : chaque moment enregistré est avancé du retard
  total (§7.10). Sans cela, à 90 battements par minute où une double croche
  dure 166,7 ms, 105 ms de retard font tomber chaque note en retard de 63 %
  d'une double croche — la boucle boite.

## 5. Ce que l'élève doit comprendre

1. Deux horloges coexistent : 30 images par seconde contre 48 000 échantillons
   par seconde ; une image vaut 1 600 échantillons.
2. Rien n'est posé « tout de suite » sur le son : chaque événement est daté
   sur l'horloge du son, 5 ms devant le présent audio, et les réglages
   continus passent par des rampes de 20 ms.
3. Le retard n'est pas un mystère ni une honte : il se décompose (analyse,
   traitement, sortie — mesurés ; caméra — estimée), il s'affiche composante
   par composante, et il se compense dans la boucle.
4. Quand l'horloge des images hoquette, l'horloge du son, elle, ne recule
   jamais : la programmation reste monotone (AIR-P-11).

## 6. Fichiers

- Logique pure et testée : `apps/web/src/lessons/horlogesLesson.ts` et
  `horlogesLesson.test.ts` (aucun son, aucune caméra : une prise de synthèse
  du §7.11 et des événements datés suffisent).
- Branchement de l'affichage : `docs/integration-v6.md`.
