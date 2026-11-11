# gestures — Conception

## Le cas qui contredit — tranché ici

§14.1 le dit : « quatre délais s'y croisent (grâce de 150 ms, relâchement de
300 ms sans image, maintien de 400 ms, réarmement de 80 ms), et il est facile
d'écrire deux règles qui se contredisent sur ce qui arrive à une note quand la
main disparaît pendant un maintien ». Voici les deux règles qui se
contredisaient, et la décision.

**Règle A (§7.9, règle 3, et AIR-F-15).** Une main absente plus de 150 ms fait
relâcher ses notes ; aucune image depuis 300 ms fait relâcher **toutes** les
voix.

**Règle B (AIR-F-12).** En mode maintien, rester 400 ms dans une zone
« verrouille la note **jusqu'au prochain passage** ». Lu à la lettre, un verrou
survit à la disparition de la main : la note reste, personne ne la joue.

**Les deux ensemble donnent deux réponses incompatibles** à la même question :
main posée 500 ms dans une zone (donc verrouillée), puis main retirée de
l'image. La règle A relâche à 150 ms, la règle B tient indéfiniment.

### La décision, et pourquoi

**Le verrou de maintien est un état de la main, pas un état de la zone.** Il
tombe en même temps que la main, c'est-à-dire à la fin du délai de grâce de
150 ms — pas à 400 ms, pas jamais.

Trois raisons, dans l'ordre de force :

1. **AIR-P-09 est un invariant dur** : « pour toute prise, tout début de note a
   une fin, et après la dernière image, le délai de grâce et l'extinction,
   aucune voix n'est active ». Un verrou qui survit à la main viole cette
   propriété pour la prise `hand-leaves-mid-note` (recette §18 : « aucune voix
   active à la fin du rapport »). Aucun agrément de jeu ne vaut un invariant
   cassé.
2. **« jusqu'au prochain passage » décrit un mouvement, pas une absence.** La
   phrase du §7.8 vise le cas où la main reste dans la zone de jeu et passe
   d'une zone à l'autre : la note tient tant qu'on ne repasse pas ailleurs.
   Elle ne parle pas du cas où il n'y a plus de main.
3. **Le maintien est une aide à la tenue, pas une télécommande.** Son but est
   de fatiguer moins le bras, pas de laisser une note sonner dans une pièce
   vide ; et l'écran doit rester honnête : une note qui sonne doit correspondre
   à une main visible.

### Ce que la décision impose, en trois lignes de code

```text
verrou actif      ⇔  maintien activé  ET  dwell atteint  ET  main présente
main présente     ⇔  vue, ou absente depuis ≤ graceMs (150 ms)
fin du verrou     →  noteOff sur la voix de cette main, à t_sortie + graceMs
retour de la main →  le minuteur de maintien repart de zéro (400 ms à refaire)
```

Le minuteur de maintien **ne survit pas** à une absence : une main qui sort et
revient 200 ms plus tard doit rester 400 ms de plus pour reverrouiller. Sans
cela, on pourrait verrouiller en clignotant.

### Les quatre délais, et qui gagne

| Situation | Délai qui s'applique | Effet |
|---|---|---|
| main absente 100 ms puis revient | grâce 150 ms | rien : les valeurs sont tenues, aucune note ne bouge |
| main absente 200 ms | grâce 150 ms | notes relâchées à 150 ms ; verrou de maintien tombé |
| main absente, verrou de maintien actif | grâce 150 ms | verrou tombé à 150 ms, `noteOff` ; « jusqu'au prochain passage » ne s'applique plus |
| aucune image analysée depuis 300 ms (onglet masqué, caméra figée) | relâchement 300 ms | **toutes** les voix relâchées, verrous compris — cette règle est au-dessus des autres |
| traversée de corde, puis retour en arrière dans les 80 ms | réarmement 80 ms | aucun second pincement ; au-delà, la corde est réarmée |
| main posée 400 ms dans une zone, puis passage dans une autre zone | maintien 400 ms | verrou levé, nouvelle zone évaluée normalement |

**Hiérarchie, écrite une fois pour toutes** : relâchement à 300 ms sans image
> grâce à 150 ms (qui emporte le verrou de maintien) > réarmement à 80 ms
(qui ne concerne que les cordes) > maintien à 400 ms (qui ne fait que
verrouiller, et ne retarde jamais un relâchement). Un délai ne retarde jamais
un autre délai : aucun d'eux ne peut empêcher le relâchement.

## Seuils doubles : une machine à états par geste

Chaque geste est un booléen avec deux seuils (hystérésis) : `pinchOn` 0,25 /
`pinchOff` 0,40, `fistOn` 0,20 / `fistOff` 0,35. L'état se lit sur le canal
**vif** (§5.2 : les déclenchements ne paient pas le lissage), les valeurs
continues sur le canal lissé. Un geste produit un `GestureEvent` avec
`phase: "start" | "end"` — deux événements par appui, jamais un seul : c'est ce
qui permet au mixer de savoir quand arrêter.

## Zones : entrée réduite, sortie agrandie

Entrée si le pointeur est dans la zone **réduite de 10 %** (`zoneMargin`),
sortie s'il est hors de la zone **agrandie de 10 %**. Entre les deux, rien ne
change : c'est la même hystérésis que pour les gestes, appliquée à l'espace au
lieu d'une valeur. Deux mains dans la même zone : la seconde est ignorée
(§14.6 le liste comme contre-exemple probable) — une zone, une note.

## Traversée de corde : une traversée, une note

Une traversée est le **changement de côté** du pointeur par rapport à une
corde, entre deux images successives, à une vitesse supérieure à 0,15 largeur
par seconde (`minPluckSpeed`). Trois garde-fous, chacun pour un cas de
`AIR-P-07` :

1. **par corde, pas globale** : chaque corde porte son propre réarmement de
   80 ms (`stringRearmMs`) — un balayage rapide traverse plusieurs cordes, il
   ne faut pas qu'elles se bloquent mutuellement ;
2. **plusieurs cordes dans une image** : si le pointeur franchit deux cordes
   entre deux images, on émet deux pincements, dans l'ordre du mouvement —
   l'ordre est ce qui teste `AIR-P-08` ;
3. **arrêt pile sur une corde** : un pointeur qui s'arrête exactement sur une
   corde et repart en arrière ne la fait sonner qu'une fois (§7.14) — le
   changement de côté doit être franc, d'où le seuil de vitesse.

`AIR-P-07` se lit donc : traversée franche ⇒ exactement un pincement ;
tremblement autour d'une corde ⇒ au plus un par fenêtre de 80 ms.

## Rôles : la continuité, pas le côté

Première attribution par côté. Ensuite, la paume la plus proche de sa position
précédente garde son rôle, et ce rôle ne change pas tant que la main n'a pas
disparu plus d'une demi-seconde (§7.3, AIR-F-04). Deux mains qui se croisent
n'échangent donc pas leurs rôles (`AIR-P-21`) : l'appariement se fait par
distance, pas par identifiant de squelette, que le modèle peut permuter.

## Ce que la conception refuse de faire

- Aucun geste ne dépend d'un état global de l'application : la machine à états
  reçoit `Features` et un instant, elle rend des `GestureEvent`. C'est ce qui
  permet de rejouer une prise à l'identique (`AIR-P-12`).
- Aucun `Date.now()` : l'instant vient de l'image (`t`), jamais de l'horloge
  murale.
- Aucun seuil dans le code : ils vivent dans `defaults.ts` (§7.13).
