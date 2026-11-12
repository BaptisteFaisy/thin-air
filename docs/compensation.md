# La boucle compense le retard — ce qui est prouvé, ce qui ne l'est pas

Le cahier l'affirme deux fois : §5.2 « **La boucle compense.** Ce que tu
enregistres dans la boucle est avancé du retard estimé, pour retomber sur le
temps (7.10) », et §7.10 « sans cela, avec 105 ms de retard, chaque note tombe
en retard de 63 % d'une double croche, et la boucle boite ». La fonction
`compensate` (`packages/core/src/loop.ts`) était testée comme arithmétique :
chaque événement avancé du retard, replié dans la boucle. Ce qui manquait,
c'est la preuve sur le **rendu** : que les attaques entendues retombent
effectivement sur la grille. C'est l'objet de cette page, du test
`apps/bench/src/compensation.test.ts` et de la preuve
`apps/bench/src/preuves/compensation.ts` (AIR-F-35).

## La commande

Depuis la racine du dépôt, sans son et sans réseau (AIR-N-02, AIR-N-01) :

```
npx tsx apps/bench/src/preuves/compensation.ts
```

Le test qui fige les mêmes nombres :

```
npx vitest run apps/bench/src/compensation.test.ts
```

## Ce que fait la démonstration

1. **Le cadre du cahier** : 90 battements par minute, 4 mesures de 4 temps →
   une boucle de 10,667 s, soit exactement 512 000 échantillons à 48 000 par
   seconde (recette §18). La double croche vaut 166,7 ms.
2. **Une prise jouée avec un retard connu** : 8 notes pincées (la harpe,
   `instruments/harp.json`) visées sur la grille — une par croche — arrivent
   datées de `visée + 105 ms`. 105 ms, c'est le retard courant du cahier §5.1
   en filaire ; la valeur injectée ici est une constante du scénario, pas une
   mesure.
3. **Un enregistrement dans une couche** : `LoopRecorder`, avec `latencyS`
   laissé à 0 pour que la compensation ne se fasse pas en cachette — elle est
   appliquée ensuite, explicitement, par `compensate`. (`LoopRecorder.stop`
   fait exactement la même chose quand `latencyS` vaut le retard estimé.)
4. **Trois rendus hors ligne** par `renderEvents` (`@thin-air/audio`), le même
   moteur que les tests et que l'export WAV (§11.6), sur la boucle entière,
   réverbération à 0 pour ne pas étaler les attaques :
   la prise de **référence** (jouée sans retard), la prise **sans
   compensation** et la prise **avec compensation**.
5. **Une mesure des attaques** par `attackTimes` (`@thin-air/core`), puis
   l'association de chaque note à la première attaque détectée dans les 50 ms
   qui suivent son enregistrement.

Rien n'est réécrit : `compensate`, `renderEvents` et `attackTimes` sont appelés
tels quels, et la grille de référence vient d'un rendu, pas d'une formule.

## La sortie réelle

Recopiée telle quelle le 12 novembre 2026 sur `pc` — baptiste-MS-7D18
(`npx tsx apps/bench/src/preuves/compensation.ts`). Le séparateur décimal est
le point, celui de JavaScript.

```
Thin Air — preuve « la boucle compense le retard » (§5.2, §7.10, AIR-F-35)
Cadre : 90 battements par minute, 4 mesures ; boucle 10.667 s = 512000 échantillons ; double croche 166.7 ms.
Prise : 8 notes pincées (harpe) visées sur la grille, jouées avec 105.0 ms de retard, enregistrées dans une couche, rendues hors ligne (sans réverbération), attaques mesurées par attackTimes et associées à leur note dans une fenêtre de 50.0 ms.

Les trois nombres :
  retard injecté                                        : 105.0 ms
  écart sans compensation                               : +105.0 ms (63.0 % d'une double croche)
  écart avec compensation                               : +0.0 ms contre la référence (au pire 0.0 ms)

Détail :
  notes dont l'attaque est datée (réf. / sans / avec)   : 8 / 8 / 8
  attaques brutes détectées (réf. / sans / avec)        : 42 / 42 / 42
  décalage propre au détecteur (prise de référence)     : +4.2 ms en moyenne, au pire 4.7 ms
  avec compensation, écart à la grille visée            : au pire 4.7 ms
  longueur du rendu                                     : 512000 échantillons
  rendu reproductible au bit près                       : oui

Attaques mesurées, en millisecondes :
  visées                                                : 333 667 1000 1333 1667 2000 2333 2667
  référence (jouée sans retard)                         : 337 671 1004 1337 1671 2004 2337 2671
  sans compensation                                     : 442 776 1109 1442 1776 2109 2442 2776
  avec compensation                                     : 337 671 1004 1337 1671 2004 2337 2671

Lecture : sans compensation, chaque attaque tombe 105.0 ms en retard — 63.0 % d'une double croche, la boucle « boite » (§7.10). Avec compensation, les attaques retombent sur la grille : 4.7 ms au pire, dont 4.2 ms viennent du détecteur lui-même.
Limite : le rendu est hors ligne ; la latence réelle du navigateur n'y est pas (docs/compensation.md).
```

## Ce que la démonstration prouve

- **Sans compensation, la boucle boite, et du retard injecté exactement.** Les
  huit attaques tombent à 442, 776, 1109… ms au lieu de 333, 667, 1000… :
  105,0 ms de retard mesuré sur le rendu, soit 63,0 % d'une double croche —
  le chiffre du cahier §7.10, retrouvé par la mesure et non recopié.
- **Avec compensation, les attaques retombent sur la grille.** Écart nul
  contre la prise de référence (0,0 ms en moyenne, 0,0 ms au pire), et 4,7 ms
  au pire contre la position visée — dans les ±10 ms de la recette. Les
  attaques mesurées avec compensation sont les mêmes, au millième près, que
  celles de la prise jouée sans retard : le rendu compensé est le rendu qu'on
  aurait obtenu sans retard.
- **Ce qui reste n'est pas la boucle, c'est le détecteur.** `attackTimes`
  lisse l'enveloppe (τ = 10 ms) et date l'attaque un peu après le début réel
  de la note : 4,2 ms en moyenne ici, mesurés sur la prise de référence jouée
  sans retard. Ce décalage est le même dans les trois prises ; il ne change
  rien à l'écart entre elles.
- **La boucle a la bonne longueur.** Les trois rendus font exactement
  512 000 échantillons, soit 4 mesures à 90 battements par minute (recette
  §18).
- **Le rendu est reproductible au bit près** (AIR-N-09) : les mêmes événements
  rendus deux fois donnent les mêmes échantillons.

## Ce que la démonstration ne prouve pas

- **Le rendu est hors ligne : la latence réelle du navigateur n'y est pas.**
  Ni `AudioContext.baseLatency`, ni `outputLatency`, ni le délai de la caméra,
  ni le temps d'analyse du modèle, ni la fenêtre de programmation du §7.9 ne
  sont dans cette boucle de mesure. Ce qui est prouvé, c'est que `compensate`
  retire exactement le retard qu'on lui donne ; pas que le retard donné est le
  bon. Ces valeurs-là se mesurent ailleurs (`scripts/preuves/latence.mjs`,
  relevés dans `docs/latency.md`).
- **Le retard est une constante du scénario, pas une mesure.** 105 ms vient du
  cahier §5.1. En situation, le retard estimé change d'une machine à l'autre,
  et la part caméra (50 ms par défaut, §7.13) n'est pas mesurable : si
  l'estimation est fausse, la compensation laisse un reste — exactement ce
  reste, ni plus ni moins.
- **Un seul instrument, un seul tempo, une seule longueur.** La harpe, 90
  battements par minute, 4 mesures. Le calage sur la grille (`quantize`) est
  hors de cette démonstration : les attaques ne sont pas calées, elles sont
  compensées. Un instrument à attaque lente (le thérémine `phantom`, 60 ms)
  décalerait davantage la mesure sans rien changer à l'écart entre les prises.
- **L'association note → attaque est une fenêtre, pas une vérité.** Le pincé
  fait ré-envoler l'enveloppe plus tard (mesuré : à 170 ms et au-delà de la
  note) ; la fenêtre de 50 ms garde l'attaque de la note et laisse ces
  ré-envolées dehors. Le nombre d'attaques brutes détectées est donc supérieur
  au nombre de notes (42 pour 8) : c'est le détecteur, pas le rendu.
- **Rien n'a été écouté.** Aucune séance d'écoute humaine ne valide que la
  différence s'entend comme prévu (§13.4) ; c'est une mesure sur des
  échantillons, faite sans périphérique audio.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `apps/bench/src/compensation-sim.ts` | La simulation : positions visées, retard injecté, couche, trois rendus, mesures. Partagée par le test et par la preuve — aucune formule en double. |
| `apps/bench/src/compensation.test.ts` | Les assertions : ±10 ms, 63 %, 512 000 échantillons, reproductibilité. |
| `apps/bench/src/preuves/compensation.ts` | La même démonstration en ligne de commande, qui imprime les trois nombres. |
