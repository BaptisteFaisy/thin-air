# Séance d'écoute humaine — kit (recette §18, cahier §13.4)

**Ni l'agent ni la CI n'ont écouté quoi que ce soit, et ne le peuvent pas**
(AIR-N-02) : le banc d'essai écrit des fichiers `render.wav` sans jamais en
ouvrir un, aucun test n'ouvre de périphérique audio, et le hook `no-sound-guard`
bloque toute commande qui essaierait. La séance d'écoute humaine est **la seule
ligne de la recette qui soit rendue à l'oreille** (« une seule ligne fait
exception, et elle te revient », recette §18). Ce kit prépare les fichiers, les
questions et le compte rendu ; il ne préjuge d'aucune réponse — **la grille est
vide et doit le rester jusqu'à la séance**.

## Qui, quand, où

- Une personne humaine (Baptiste, ou toute oreille de confiance), au casque de
  préférence, dans une pièce calme.
- Les fichiers sont produits sur la machine de l'humain ; aucun ne transite par
  la CI ni par un agent.

## Les fichiers à écouter

### 1. Les rendus des instruments sur les prises de référence

Chaque commande écrit `events.json`, `render.wav` et `report.json` dans le
dossier de sortie. Écouter **le `render.wav`** ; garder le `report.json` sous
les yeux pour confronter l'oreille aux nombres.

| Fichier à écouter | Instrument | Prise | Ce que l'oreille vérifie |
|---|---|---|---|
| `out/ecoute/phantom-slow-rise/render.wav` | Phantom (thérémine) | `slow-rise` | La montée des huit notes, le glissé continu, le silence final |
| `out/ecoute/harp-sweep/render.wav` | Harp | `harp-sweep` | Quatre pincements nets, réguliers, sans craquement |
| `out/ecoute/choir-two-hands/render.wav` | Choir | `two-hands-cross` | Les nappes tiennent, aucun battement parasite au croisement |
| `out/ecoute/bells-fast-jab/render.wav` | Bells | `fast-jab` | L'attaque FM sonne, pas de clic |
| `out/ecoute/drone-slow-rise/render.wav` | Drone | `slow-rise` | Le bourdon change de hauteur sans marche audible |
| `out/ecoute/drums-fast-jab/render.wav` | Grid drums | `fast-jab` | Les frappes tombent sur la grille |
| `out/ecoute/phantom-hand-leaves/render.wav` | Phantom | `hand-leaves-mid-note` | **Aucune note qui traîne** après la sortie des mains |
| `out/ecoute/phantom-tremor/render.wav` | Phantom | `tremor-at-boundary` | La note frontière ne bat pas entre deux hauteurs |
| `out/ecoute/phantom-left-hand/render.wav` | Phantom | `left-hand-only` | Le jeu à une main sonne comme à deux |

Commande exacte pour tous les produire (même forme que `docs/recette.md`, sans
`--no-wav` cette fois — le fichier est écrit, jamais joué par la machine) :

```bash
cd <le dépôt>
npm ci
mkdir -p out/ecoute
npx tsx apps/bench/src/cli.ts render --take takes/reference/slow-rise.json \
    --instrument instruments/phantom.json --out out/ecoute/phantom-slow-rise
npx tsx apps/bench/src/cli.ts render --take takes/reference/harp-sweep.json \
    --instrument instruments/harp.json --out out/ecoute/harp-sweep
npx tsx apps/bench/src/cli.ts render --take takes/reference/two-hands-cross.json \
    --instrument instruments/choir.json --out out/ecoute/choir-two-hands
npx tsx apps/bench/src/cli.ts render --take takes/reference/fast-jab.json \
    --instrument instruments/bells.json --out out/ecoute/bells-fast-jab
npx tsx apps/bench/src/cli.ts render --take takes/reference/slow-rise.json \
    --instrument instruments/drone.json --out out/ecoute/drone-slow-rise
npx tsx apps/bench/src/cli.ts render --take takes/reference/fast-jab.json \
    --instrument instruments/grid-drums.json --out out/ecoute/drums-fast-jab
npx tsx apps/bench/src/cli.ts render --take takes/reference/hand-leaves-mid-note.json \
    --instrument instruments/phantom.json --out out/ecoute/phantom-hand-leaves
npx tsx apps/bench/src/cli.ts render --take takes/reference/tremor-at-boundary.json \
    --instrument instruments/phantom.json --out out/ecoute/phantom-tremor
npx tsx apps/bench/src/cli.ts render --take takes/reference/left-hand-only.json \
    --instrument instruments/phantom.json --one-hand \
    --out out/ecoute/phantom-left-hand
```

`out/` est ignoré par git : les fichiers produits restent sur la machine.

### 2. La pièce

Le fichier `thin-air-loop.wav`, exporté depuis la page (panneau de la boucle :
enregistrer, jouer les couches, exporter). L'export passe par le rendu hors
ligne — le même moteur que les tests (AIR-F-38, 39) : ce que l'oreille entend
est ce que la CI mesure. C'est aussi la pièce dont quinze secondes
accompagnent le post social (`docs/social-brouillon.md`, cahier §17.4).

## La grille — dix questions courtes

Répondre par oui / non / à régler, une ligne de commentaire au plus.

1. Les huit notes du thérémine montent-elles sans craquement ni marche ?
2. Le glissé (aimant coupé) est-il continu, sans effet d'escalier ?
3. Les pincements de la harpe sont-ils nets et réguliers ?
4. Les nappes du chœur tiennent-elles sans battement ni coupure ?
5. Une note reste-t-elle coincée après la sortie des mains ?
6. La note frontière (tremblement) hésite-t-elle de façon audible ?
7. Les attaques (cloches, percussions) claquent-elles sans clic ?
8. Le volume général est-il confortable, sans saturation ?
9. La réverbération est-elle dosée (présente mais pas noyée) ?
10. La pièce exportée reste-t-elle en place rythmiquement, couches comprises ?

## Le tableau à remplir — après la séance seulement

| Date | Ce qui a été réglé | Décision |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |

## Après la séance

1. Reporter le tableau rempli dans `docs/journal.md` (le journal note chaque
   séance d'écoute avec sa date et ce qui a été réglé à la suite, recette §18).
2. Cocher et dater la ligne « Séance d'écoute humaine » de
   `docs/recette.md` — c'est la seule ligne de la recette qui se prouve par
   une oreille.
3. Si un réglage change le son (volume, réverbération, filtre), relancer les
   rendus et vérifier que les nombres de `docs/recette.md` tiennent toujours
   (crête sous −1 dB, paliers à 5 centièmes, silence en 800 ms).
