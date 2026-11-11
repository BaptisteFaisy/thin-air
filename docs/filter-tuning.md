# Réglage du filtre « One Euro » par la mesure

Le cahier §7.5 donne des valeurs de départ pour le filtre (`fc_min = 1,5 Hz`,
`β = 5`, `fc_d = 1 Hz`, canal vif à `fcTrigger = 6 Hz`) et les marque **à
régler** sur des prises réelles (annexe D). Ce document mesure ce compromis sur
les prises de référence disponibles, **sans inventer de nombre** : tout ce qui
suit est la sortie réelle de la commande ci-dessous.

Commande rejouée :

```bash
npx tsx apps/bench/src/cli.ts tune
```

Les trois prises qui définissent les trois nombres :

- **gigue** : écart-type du `u` lissé quand la main tremble — `tremor-at-boundary.json` ;
- **traîne** : retard (ms) du canal lissé sur le signal brut en mouvement constant — `slow-rise.json` ;
- **réactivité du canal vif** : retard (ms) du canal vif sur une attaque — `fast-jab.json`.

## Le tableau des mesures

```
bench tune — réglage du filtre One Euro par la mesure (cahier §7.5)
main suivie : droite (pointeur paume) · fc_d = 1 Hz (défaut §7.13)
gigue ← tremor-at-boundary.json · traîne ← slow-rise.json · canal vif ← fast-jab.json
fcMin  beta   fcTrigger  gigue (u)      traîne (ms)   vif (ms)
0,8    2      4          0,000303       159,25        36,25
0,8    2      6          0,000303       159,25        24,00
0,8    2      10         0,000303       159,25        15,00
0,8    5      4          0,000317       122,50        36,25
0,8    5      6          0,000317       122,50        24,00
0,8    5      10         0,000317       122,50        15,00
0,8    10     4          0,000340       88,50         36,25
0,8    10     6          0,000340       88,50         24,00
0,8    10     10         0,000340       88,50         15,00
1,5    2      4          0,000485       93,75         36,25
1,5    2      6          0,000485       93,75         24,00
1,5    2      10         0,000485       93,75         15,00
1,5    5      4          0,000497       79,50         36,25
1,5    5      6          0,000497       79,50         24,00
1,5    5      10         0,000497       79,50         15,00
1,5    10     4          0,000515       63,75         36,25
1,5    10     6          0,000515       63,75         24,00
1,5    10     10         0,000515       63,75         15,00
2,5    2      4          0,000698       59,00         36,25
2,5    2      6          0,000698       59,00         24,00
2,5    2      10         0,000698       59,00         15,00
2,5    5      4          0,000707       53,00         36,25
2,5    5      6          0,000707       53,00         24,00
2,5    5      10         0,000707       53,00         15,00
2,5    10     4          0,000722       45,50         36,25
2,5    10     6          0,000722       45,50         24,00
2,5    10     10         0,000722       45,50         15,00

meilleure gigue : fcMin=0,8 beta=2 fcTrigger=4 → 0,000303 u
meilleure traîne : fcMin=2,5 beta=10 fcTrigger=4 → 45,50 ms
meilleur canal vif : fcMin=0,8 beta=2 fcTrigger=10 → 15,00 ms
cahier §7.5 (fcMin=1,5 beta=5 fcTrigger=6) → gigue 0,000497 u · traîne 79,50 ms · vif 24,00 ms
```

## Le compromis que montre le tableau

Rien ne domine : chaque réglage qui gagne sur un critère en perd sur un autre.

- **`fcMin` est le paramètre dominant.** À `β` fixé, passer de 0,8 à 2,5 Hz
  multiplie la gigue par ≈ 2,3 (0,000317 → 0,000722 u à `β = 5`) et divise la
  traîne par ≈ 2,3 (122,50 → 53,00 ms). Lisser fort supprime le tremblement mais
  fait traîner le geste, exactement comme le dit le §7.5.
- **`β` réduit la traîne pour un coût de gigue presque nul ici** (0,000485 →
  0,000515 u, soit +3,6 %, quand la traîne passe de 93,75 à 63,75 ms à
  `fcMin = 1,5`). Ce coût est **sous-estimé** : la prise de tremblement est
  quasi-stationnaire, donc `β` n'a presque pas l'occasion de s'exercer. En jeu
  réel, un `β` élevé laisse passer le tremblement pendant les mouvements rapides.
- **`fcTrigger` ne touche que le canal vif** (36,25 → 24,00 → 15,00 ms pour 4, 6,
  10 Hz), sans effet sur la gigue ni sur la traîne — le comportement attendu d'un
  canal à coupure fixe.

## Recommandation : garder les valeurs du cahier

On **garde** `fc_min = 1,5 Hz`, `β = 5`, `fcTrigger = 6 Hz`. Les trois nombres :

| Critère | Valeurs du cahier | Ce que ça représente |
|---|---|---|
| Gigue | **0,000497 u** | σ ≈ 1,8 centièmes de demi-ton (36 demi-tons par largeur de zone), très sous la marge d'hystérésis de 15 % du §7.6 |
| Traîne | **79,50 ms** | la traîne d'environ 80 ms annoncée par le §7.14 ; la recette mesure 87 ms sur les instants de note |
| Canal vif | **24,00 ms** | sous une image à 30 images/s (33,3 ms) : l'attaque n'attend pas le lissage |

Arguments :

1. La traîne de 79,5 ms **est déjà celle que le cahier vise** (« ≈ 80 ms »,
   §7.14). La réduire réclamerait `fcMin = 2,5`, qui double la gigue.
2. Le canal vif à 6 Hz est déjà plus rapide qu'une image : l'augmenter vers
   10 Hz ne ferait que laisser passer du bruit dans le canal des déclenchements,
   sans gain perceptible.
3. Le seul compromis *a priori* tentant — `(1,5, 10, 6)`, traîne 63,75 ms pour
   0,000515 u de gigue — gagne 15,75 ms sur un coût de gigue que la prise
   synthétique ne sait pas mesurer (voir plus bas). Pas de raison suffisante de
   changer les valeurs livrées sans prise réelle.

## Sensibilité de chaque paramètre

- **`fcMin`** : le levier principal. Doubler `fcMin` divise la traîne par ≈ 2 et
  multiplie la gigue par ≈ 2,3 (ordre de grandeur sur la grille).
- **`β`** : agit surtout en mouvement. Sur ces prises, il déplace la traîne de
  93,75 → 63,75 ms (à `fcMin = 1,5`) pour une gigue quasi constante. Effet réel
  sur le tremblement en mouvement **non mesuré ici**.
- **`fcTrigger`** : isole le canal vif, 36→24→15 ms pour 4→6→10 Hz ; aucun effet
  sur les deux autres critères.

## Ce que ces prises ne prouvent pas

Ces prises sont **synthétiques** (`@thin-air/core`, `takeGen`), pas réelles :

- le tremblement est deux sinusoïdes + un bruit à graine ;
- la montée est une rampe parfaite à vitesse constante ;
- l'attaque est un balayage propre, sans occlusion ni dérive.

Elles mesurent **le filtre sur le papier**, pas le comportement réel : pas de
dérive de MediaPipe, pas de latence de caméra, pas de main qui masque une autre,
pas de tremblement physiologique. **Ce réglage ne remplace donc pas les trois
prises réelles de l'annexe D.** Il donne l'ordre de grandeur et verrouille que
les valeurs du cahier sont dans la bonne zone — rien de plus.

### Marche à suivre exacte pour les trois prises réelles (annexe D)

1. **Ouvrir la page et autoriser la caméra.**

   ```bash
   npm ci
   npm run dev --workspace apps/web
   ```

   Ouvrir l'URL affichée, autoriser l'accès à la caméra, puis se calibrer.

2. **Enregistrer trois prises.** L'enregistreur est déjà livré dans
   `@thin-air/vision` (`createTakeRecorder`, `downloadTake` — testé, aucune
   donnée ne quitte l'appareil, §7.11), mais le bouton de la page n'est pas
   encore câblé (AIR-F-47). Jusqu'à ce qu'il le soit, on enregistre en branchant
   l'enregistreur dans la page, ou depuis la console en mode dev. Une prise fait
   10 à 20 secondes :

   - **tremblement réel** : main immobile au voisinage d'une frontière de note,
     pour mesurer la gigue ;
   - **glissé lent** : une main traverse la zone de jeu à vitesse constante
     (~3 s), pour mesurer la traîne ;
   - **attaque franche** : un coup bref qui traverse plusieurs cordes en un quart
     de seconde, pour mesurer la réactivité du canal vif.

3. **Poser les fichiers** sous `takes/real/`, par exemple
   `takes/real/tremblement-reel.json`, `takes/real/glisse-reelle.json`,
   `takes/real/attaque-reelle.json`. La garde `take-privacy-guard` validera
   qu'ils ne portent que des points (ils ne contiennent jamais d'image, §7.11).

4. **Relancer la mesure** pour chaque prise et comparer au tableau ci-dessus :

   ```bash
   npx tsx apps/bench/src/cli.ts tune --take takes/real/<fichier>.json
   ```

   Si les trois mesures réelles contredisent le réglage (§7.5), ajuster
   `packages/core/src/defaults.ts` dans un lot autorisé — le présent lot ne
   touche pas à `packages/**`.

## Verrou

`apps/bench/src/tuning-mesure.test.ts` verrouille :

- la combinaison recommandée (`1,5 / 5 / 6`) n'est pas pire que les défauts sur
  les trois critères, à 5 % près ;
- la reproductibilité : mêmes entrées → mêmes nombres, au bit près (AIR-N-09) ;
- la sensibilité : `fcMin` monte la gigue et baisse la traîne ; `β` baisse la
  traîne ; `fcTrigger` ne baisse que le canal vif, qui reste sous une image.