# Deux horloges (§7.9) — ce que les rampes changent au son

Preuve du récit §14.6, point 4 : « le réglage fixé sans rampe que l'agent
écrit avant `two-clocks.md`, la même ligne après, et la mesure du
grésillement (AIR-P-16) dans les deux cas ». Aucun son n'est émis : tout est
calculé hors ligne et mesuré sur des tableaux d'échantillons (AIR-N-02).

## La ligne avant, la ligne après

**Avant** — le réglage fixé directement pendant que la voix sonne, à chaque
image, trente fois par seconde. C'est le motif que cherche l'agent
`seam-reviewer` (extrait réel de `.kiro/agents/seam-reviewer.md`) :

> **Un réglage fixé sans rampe** pendant qu'une voix sonne : `param.value = …`,
> `setValueAtTime` sans rampe, `gain = …`.

Dans le graphe de jeu direct (Web Audio), ce motif s'écrit
`param.setValueAtTime(valeur, instant)` — la valeur saute d'un coup à chaque
image. Dans le moteur hors ligne (`packages/audio/src/dsp/voice.ts`), le même
réglage sans rampe s'obtient avec τ = 0 : `paramTauMs: 0` donne α = 1, et la
ligne de lissage (extrait réel, inchangé) dégénère en affectation directe :

```ts
this.freqHz += (this.cibleHz - this.freqHz) * this.alpha;   // α = 1 → this.freqHz = this.cibleHz
```

**Après** — la règle 1 du steering `.kiro/steering/two-clocks.md` (extrait
réel) :

```ts
param.setTargetAtTime(valeur, instant, 0.02);   // τ = paramTauMs = 20 ms
```

La même ligne de `voice.ts`, avec α calculé depuis τ = 20 ms (`paramTauMs`,
§7.13) : à chaque image, le réglage ne saute pas à sa cible, il s'en
rapproche d'une fraction de la distance restante — la mise à jour s'étale sur
une rampe de 20 ms, à cheval sur l'intervalle de 33 ms entre deux images.
Dans le graphe de jeu direct, l'écriture passe par `graph/params.ts` (extrait
réel) :

```ts
param.setTargetAtTime(value, at, Math.max(tauS, MIN_TAU_S));
```

Le moteur n'a pas eu besoin d'être modifié pour cette preuve :
`RenderOptions.paramTauMs` existe déjà, et `paramTauMs: 0` désactive la
rampe (α = 1). La variante « par marches » du script ci-dessous est
exactement ce que produisait le réglage direct.

## La mesure (AIR-P-16)

Un glissé lent de la note 55 (sol, 196 Hz) à la note 67 (sol, 392 Hz) sur
3 s — le thérémine du §7.14 — avec la hauteur fixée à chaque image
(33,3 ms, 30 images/s). Rendu hors ligne à 48 kHz ; fréquence mesurée par
`freqEnvelope` (`packages/core/src/measure.ts`) par fenêtres de 10 ms.

Rampe idéale : 12 demi-tons en 3 s, soit **4,00 centièmes par fenêtre** ;
seuil = × 1,7 (la tolérance déjà employée par `offline/render.test.ts`) =
**6,80 centièmes**. Zone mesurée : t ∈ [2,0 ; 2,99] s, soit mi → sol
(311 → 392 Hz). En dessous de ~310 Hz, une fenêtre de 10 ms ne contient
qu'environ deux périodes et le bruit de l'autocorrélation (mesuré sur des
notes tenues : 9,3 centièmes à 261,6 Hz ; 1,6 à 293,7 Hz ; 0,9 à 311,1 Hz)
dépasserait le pas mesuré — il frapperait les deux variantes à parts égales.

| Variante | Plus grand saut entre fenêtres | Sauts > 6,80 centièmes |
|---|---|---|
| **Avec rampes** — le moteur actuel (τ = `paramTauMs` = 20 ms, `glideMs` 30) | **6,59 centièmes** (à t = 2,34 s) | **0** |
| **Par marches** — le réglage fixé directement à chaque image (`paramTauMs: 0`, `glideMs: 0`) | **14,09 centièmes** (à t = 2,05 s) | **30** |

Les 30 dépassements de la variante « par marches » tombent sur la zone d'une
seconde où passent exactement 30 images : une marche détectée par image.
AIR-P-16 tient dans les deux sens : avec rampes, aucun saut ne dépasse celui
de la rampe idéale (à 70 % près) ; sans rampe, la mesure voit une marche à
chaque image.

Commande pour reproduire (depuis la racine du dépôt) :

```bash
npx tsx apps/bench/src/preuves/two-clocks.ts
```

## Pourquoi des marches s'entendent comme un grésillement

- Un son est une vibration : à 392 Hz, l'air oscille 392 fois par seconde et
  chaque oscillation doit s'enchaîner sans couture à la suivante.
- Changer la hauteur d'un coup au milieu d'une oscillation casse cet
  enchaînement : chaque casse est un micro-clic, et trente images par seconde
  font trente clics par seconde posés sur la note — l'oreille entend une
  granulation, le grésillement.
- La rampe de 20 ms étale chaque changement sur plusieurs oscillations : la
  couture entre l'horloge des images (30/s) et celle du son (48 000/s)
  redevient lisse, et le glissé redevient un glissé.

## Déterminisme

Chaque variante est rendue deux fois par le script ; les deux rendus sont
comparés échantillon par échantillon et doivent être identiques au bit près
(AIR-N-09). Le script échoue (exception) sinon ; il imprime
« rendu reproductible au bit près : oui » pour les deux variantes.
