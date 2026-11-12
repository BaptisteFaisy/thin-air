# Horodatage — une seule horloge, un seul format

Thin Air compare des rapports venus de machines différentes : le poste `pc`,
les runners `r630`, la sonde de disponibilité. Deux machines qui n'écrivent pas
l'heure de la même façon livrent des rapports qu'on ne peut pas rapprocher. La
règle tient en une phrase : **une seule horloge** — UTC, ISO 8601, à la
milliseconde — **et une seule façon de l'écrire**.

## La règle

1. **Un instant** s'écrit toujours en UTC, au format ISO 8601, à la
   milliseconde : `2026-12-01T14:05:33.412Z`. Jamais une heure d'horloge murale
   (`HH:MM`), jamais un fuseau local à la suite (`+0100`), jamais une date sans
   heure quand on veut un instant.
2. **Une durée** s'écrit en millisecondes entières : `287 ms`, `10 000 ms`.
   Jamais en secondes, en minutes ou en heures (`N s`, `N min`, `N h`). Une
   durée est un entier, pas une fraction ni une approximation.
3. **Une durée relative** (« N minutes plus tôt », « depuis N minutes ») est
   interdite dans un rapport : elle ne se compare à rien et change quand on la
   relit. Seul un instant complet la remplace.
4. **Aucune date locale dans un nom de fichier** : un fichier s'appelle
   `out/sonde/2026-12-01T14-05-33.412Z.json` — l'instant complet, les `:` remplacés
   par des `-` — jamais `out/sonde/2026-12-01.json`.

Une date **seule** (`2026-12-01`) reste admise quand le jour suffit, comme les
en-têtes du journal de bord : elle n'ambitionne pas d'être un instant. C'est
l'instant qui doit être complet, pas le jour.

## L'unique fonction d'écriture

Le dépôt écrit un instant à un seul endroit : `scripts/horodatage.mjs`.

```js
import { iso, maintenant, dureeMs, instantFichier } from "./horodatage.mjs";

const releve = maintenant();                 // l'instant courant, en UTC à la milliseconde
const copie = iso(new Date(releve));         // la même chaîne, depuis une date
const duree = dureeMs(debut, fin);           // un entier, en millisecondes
const nom = `out/sonde/${instantFichier()}.json`; // un nom de fichier canonique
```

C'est la seule implémentation de la règle. Un rapport, un script ou une garde
qui écrirait un instant par un autre chemin est une faute — la règle vit dans
`iso`, pas dans la bonne volonté de chaque auteur.

## Le contrôle

`scripts/check-timestamps.mjs` relit les rapports et documents listés dans la
constante `RAPPORTS` de ce script, et signale tout ce qui s'écarte de la règle :
un instant non canonique, une heure d'horloge murale, une durée hors
millisecondes, une durée relative, une date locale dans un nom de fichier. Il
sort en code `1` dès qu'il trouve une faute, comme `scripts/check-budget.mjs`
pour le budget CI.

```bash
node scripts/check-timestamps.mjs                 # les rapports sous surveillance
node scripts/check-timestamps.mjs docs/latency.md # un document en particulier
```

La dette restante n'est pas cachée : le contrôle l'affiche, document par
document, jusqu'à ce qu'elle soit remboursée. Les tests du contrôle et de
l'horloge se lancent hors du banc principal, gelé :

```bash
npx vitest run --config scripts/vitest.scripts.config.ts scripts/horodatage.test.ts
```