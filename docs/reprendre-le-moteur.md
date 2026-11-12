# Reprendre le moteur de Thin Air

Ce moteur ne fait pas de musique, il fait des mesures. Tout le reste en découle.

## Ce que le moteur fait

`@thin-air/core` et `@thin-air/audio` sont une bibliothèque de calcul en
TypeScript pur : tu lui donnes une liste d'événements datés (`noteOn`,
`noteOff`, `control`), et il te rend un `Float32Array` d'échantillons, un WAV
encodé, et des nombres — fréquence mesurée, écart en centièmes, crête, silence
final. Une troisième paquet, `@thin-air/schema`, valide les fichiers
d'instrument et de prise sur `zod`, et refuse en entier ce qui ne tient pas,
jamais en silence.

Le contrat est `MusicEvent` : trois variantes, toutes horodatées par `t` en
secondes. En jeu direct, `t` est l'instant présent plus l'avance ; en rendu
hors ligne, c'est l'instant de la prise. C'est la seule chose qui traverse la
frontière entre la logique de geste et le moteur sonore, et c'est pourquoi
`@thin-air/audio` n'a jamais besoin de lire une horloge : il reçoit des
instants, il ne les fabrique pas.

Tout est déterministe au bit près : pas de `Math.random()` sans graine, pas de
`Date.now()` dans `core`, pas d'itération d'objet non triée. Le même événement
rendu deux fois donne les mêmes échantillons — c'est ce qui rend les mesures
comparables d'un run à l'autre.

## Ce que le moteur ne fait pas

Aucun son n'est jamais émis (AIR-N-02) : pas de `AudioContext` ouvert, pas de
haut-parleur, pas de réglage de volume système. Les échantillons restent des
nombres dans un tableau, ou un fichier que **toi** écris.

Aucun navigateur, aucun DOM, aucune Web MIDI API : la face hors ligne
s'exécute dans un Node nu. Aucune analyse de mains, aucune caméra, aucune
image, aucun réseau (AIR-N-01) : la vision est un paquet séparé, et elle n'est
pas nécessaire pour utiliser le moteur. Aucune horloge lue, aucune reverbération
par convolution : la réverbération est un réseau de retards à réinjection, pour
que le même calcul serve hors ligne et en direct.

Ce qui n'est pas dans les paquets : le jeu direct branché sur Web Audio
(`@thin-air/audio` l'expose, mais il est hors du périmètre « sans
navigateur »), et le site.

## L'essayer en cinq minutes

L'exemple [`exemples/premier-instrument/`](../exemples/premier-instrument/) est
un projet autonome : il construit une note MIDI, la rend hors ligne, écrit un
WAV, mesure la fréquence et le niveau, et affiche **trois nombres**.

```bash
# dans le dépôt, sans installation (le workspace fait déjà le lien)
npx tsx exemples/premier-instrument/index.ts
```

```
fréquence : 440.00 Hz
écart     : 0.00 centièmes
niveau    : -13.92 dB
WAV écrit : out/premier-instrument.wav (aucun son émis)
```

Pour le faire tourner **chez toi**, contre les paquets publiés, il n'y a qu'une
chose à changer : l'installation.

```bash
npm install @thin-air/core @thin-air/audio
npx tsx index.ts
```

Les imports ne changent pas — `@thin-air/core` et `@thin-air/audio` sont les
mêmes noms de paquets dans le dépôt et dans le registre. Les paquets sont
**source-only** : le consommateur compile le TypeScript chez lui, donc il lui
faut un lanceur TypeScript (`tsx`, `ts-node`, ou un bundler). Le fichier
`package.json` de l'exemple montre exactement les deux dépendances à écrire.

Le WAV sort dans `out/` — un dossier que tu choisis, jamais un effet de bord
inattendu. Aucun son n'accompagne la mesure : ce n'est qu'un fichier.

## À quoi lire ensuite

- `docs/bibliotheque.md` — la frontière entre les trois paquets, les garanties,
  et ce qui reste à faire avant une publication sur un registre.
- `docs/api-surface.json` — le contrat d'API : la surface publique figée de
  chaque paquet, export par export. C'est la liste à lire avant d'écrire la
  première ligne qui importe `@thin-air/core` ; ses `entryPoints` pointent
  sur l'exemple et sur ce document.
- `packages/core/README.md`, `packages/audio/README.md`,
  `packages/schema/README.md` — l'API de chaque paquet, avec un exemple
  vérifié et sa sortie réelle.
- `docs/publication.md` — la marche à suivre exacte le jour où la publication
  est décidée.
- `docs/CONTRACT.md` — qui écrit quoi, et ce qu'un lot n'a pas le droit de
  toucher.

L'exemple `exemples/premier-instrument/` reste le point d'entrée le plus
court : vingt lignes, trois nombres.

## Une phrase à retenir

Ce moteur ne fait pas de musique, il fait des mesures. C'est ce qui le rend
réutilisable : tu peux l'employer pour vérifier un synthétiseur, un filtre, un
algorithme de mesure ou une chaîne de traitement — sans navigateur, sans
haut-parleur, et avec des nombres que deux machines comparent au bit près.
