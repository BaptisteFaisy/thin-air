# takes-bench — Conception

## La prise est le péage de tout le reste

Tout ce qui est à gauche de la couture se teste à partir d'une prise ; tout ce
qui est à droite se rend dans un fichier. La prise est donc le contrat de
test du projet — d'où le soin qu'on y met.

## Format `thin-air-take/1`

```json
{ "format": "thin-air-take/1", "fps": 30,
  "frames": [{ "t": 0.0, "hands": [{ "side": "right", "score": 0.97,
    "points": [[0.41, 0.72, 0.0], …] }] }] }
```

**Refus en entier** si une clé sort de cette liste — c'est `AIR-P-20` dans sa
version stricte, et c'est `take-privacy-guard` : une image glissée dans une
prise est refusée, pas nettoyée. Un fichier qu'on nettoie apprendrait à
l'agent à se tromper sans conséquence.

## Codage compact (AIR-P-20)

En JSON brut, 26 Ko/s ; en entiers de 16 bits pour les coordonnées (précision
1,5 × 10⁻⁵, très au-delà du bruit du modèle), 7,6 Ko/s. Le codage est
**explicite dans l'en-tête** et la propriété se lit « au pas de codage près » :
arrondir avant d'écrire, puis relire, doit redonner exactement la valeur
arrondie. Aucun arrondi caché à la lecture.

## Trois niveaux, une seule vérité

| Niveau | Ce qui est prouvé | Par quoi |
|---|---|---|
| 1 | prise → événements | `bench events`, calcul pur |
| 2 | événements → échantillons | `bench render`, mesures |
| 3 | page entière → événements | un fichier vidéo en guise de caméra |

Le niveau 3 est le seul qui a besoin du navigateur (AIR-N-10 : un seul essai de
bout en bout). Les niveaux 1 et 2 tournent en CI, en quelques secondes.

## Le rapport de rendu, et comment on le lit

`RenderReport` : `sampleRate`, `samples`, `durationS`, `notes[]` (instant,
note, fréquence attendue, fréquence mesurée, écart en centièmes), `peakDb`,
`rmsDb`, `maxVoices`, `silenceAfterMs`. La comparaison à la référence applique
les tolérances du §13 : 5 centièmes sur les fréquences, une image sur les
instants, crête sous −1 dB, silence sous −60 dB dans le délai de la propriété
AIR-P-15. `bench compare` sort non nul en cas d'écart — c'est ce qui en fait un
critère d'acceptation, et non un rapport qu'on lit distraitement.

## Déterminisme (AIR-P-12)

Une prise et un instrument donnent toujours la même liste d'événements. Le
`bench` n'utilise ni `Date.now()` ni `Math.random()` sans graine ; les tests
par propriétés consignent leurs graines, et la graine est écrite dans le
rapport. C'est ce qui permet à un rapport d'être une preuve : il est
rejouable.
