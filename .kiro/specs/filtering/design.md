# filtering — Conception

## Deux canaux, une seule implémentation

`OneEuroFilter` est instancié deux fois par coordonnée : un canal **lissé**
(réglages de `defaults.ts`) et un canal **vif** (coupure fixée à `fcTrigger`,
6 Hz). Le second ne sert qu'aux **déclenchements** — pince, poing, traversée,
vitesses. Le premier sert à tout ce qui est continu : hauteur, volume,
brillance. §5.2 le dit : « les déclenchements ne paient pas le lissage ».

Conséquence de conception : une vitesse utilisée pour la force d'un pincement
de corde vient du canal vif, une hauteur vient du canal lissé. Les deux vivent
dans le même objet `Features` (`smooth` et `fast`), pour qu'aucun module en
aval ne puisse se tromper de canal par distraction.

## Le temps ne recule jamais

`d = (x − x_précédent) / Te` : avec deux images au même horodatage, `Te = 0` et
la division explose. Décision : `Te` est borné par le bas (`Te_min` = 1 ms) et
un horodatage qui ne progresse pas réutilise le `Te` de l'image précédente.
C'est exactement ce que demande AIR-P-02 (« aucun horodatage, même répété, ne
produit une valeur non numérique »), et c'est le contre-exemple le plus
probable du §14.6.

## Bornes

Le filtre est convexe : sa sortie est une combinaison convexe de la valeur
filtrée précédente et de l'entrée, donc elle reste dans l'enveloppe des
entrées vues. Pour une entrée constante, `fc = fc_min`, `α > 0`, et la sortie
converge. Ces deux phrases sont la propriété AIR-P-02, testée par fast-check
sur des prises de synthèse.

## Délai de grâce (AIR-F-15)

Une main absente moins de 150 ms n'est pas une main perdue : le filtre ne
reçoit pas de nouvelle mesure, `present` reste vrai, et les valeurs sont
**tenues** telles quelles (pas d'extrapolation : une position inventée
sonnerait faux). Au-delà de 150 ms, `present` passe à faux : les notes se
relâchent (`gestures`), et le filtre est réinitialisé pour la prochaine
apparition — sinon la première image au retour serait mélangée à une position
vieille de plusieurs secondes.
