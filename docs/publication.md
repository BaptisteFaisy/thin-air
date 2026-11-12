# Publier le moteur comme paquet npm — marche à suivre

**Aucune publication n'a été faite.** Les trois paquets du moteur
(`@thin-air/core`, `@thin-air/audio`, `@thin-air/schema`) gardent
`"private": true` : c'est un verrou, npm refuse de publier un paquet privé.
Ce document décrit exactement quoi faire le jour où la publication est décidée.
Contexte et frontières des paquets : `docs/bibliotheque.md`.

## Le choix fait : paquets source-only (TypeScript brut)

`exports` pointe vers `./src/index.ts`, et `files` ne livre que `src/`.
Le paquet est **source-only** : le consommateur compile le TypeScript chez lui.

Pourquoi ce choix, plutôt que publier du compilé (`dist/`) :

- **Un seul mode de consommation cohérent** : tout le monorepo (apps, banc,
  garde `pack-check`) importe déjà la source ; publier `dist/` créerait une
  deuxième vérité à synchroniser avec la CI.
- **Pas d'étape de build à ajouter dans ce lot** : compiler proprement demande
  des `tsconfig` par paquet, un script `build` et la génération des `.d.ts` —
  hors du périmètre autorisé ici (interdit de toucher `tsconfig*` et le
  `package.json` racine).
- **Le public visé est TypeScript** : les README des paquets s'adressent à des
  projets Node/TypeScript (bundler, `tsx`, `ts-node`), qui consomment du `.ts`
  sans friction.
- **Contrepartie assumée** : un projet JavaScript nu ne peut pas
  `require`/`import` le paquet tel quel, et les bancs `*.test.ts` voyagent dans
  le tarball (ils sont sous `src/`). Le passage à `dist/` reste l'étape suivante
  naturelle ; il est listé ci-dessous.

## Avant de publier — la liste de vérification

1. **Décider le nom et le registre** (voir « Ce qui reste à décider »).
2. **Retirer `"private": true`** des trois `package.json` — uniquement quand la
   publication est réellement décidée, sinon le verrou saute pour rien.
3. **Figer les dépendances entre paquets** : remplacer `"@thin-air/core": "*"`
   par `"@thin-air/core": "^0.1.0"` dans `packages/audio/package.json`, et
   déclarer `"@thin-air/core": "^0.1.0"` dans `packages/schema/package.json`
   (il n'en importe que des types, mais le compilateur du consommateur doit
   pouvoir les résoudre). Les trois `version` restent synchronisées.
4. **Vérifier la disponibilité du nom** : `npm view @thin-air/core` (une erreur
   404 signifie que le nom est libre), et l'existence de l'organisation npm
   `thin-air` si l'on garde les noms scopés.
5. **Lancer les gardes** — tout doit sortir 0 :
   - `node scripts/pack-check.mjs` (manifestes, accessibilité, dépendances, aucun son) ;
   - `npx tsc --noEmit -p tsconfig.json` et `npx vitest run` (le banc
     `instruments/publication.test.ts` valide les manifests) ;
   - `node scripts/hooks/run-all-guards.mjs`.
6. **Inspecter le contenu du tarball, sans rien publier** :
   `npm pack --dry-run` dans chaque paquet ; vérifier qu'on n'embarque ni
   prise (`takes/`), ni fichier sonore, ni secret — seulement `src/`,
   `README.md`, `package.json` (npm ajoute toujours `README.md` et `LICENSE`).

## L'ordre de publication

Les dépendances vont de bas en haut : `core` d'abord (aucune dépendance), puis
`schema` et `audio` (tous deux dépendent de `core` ; `schema` n'en importe que
des types, `audio` l'utilise à l'exécution).

```bash
cd packages/core   && npm publish --access public   # puis vérifier : npm view @thin-air/core version
cd ../schema       && npm publish --access public
cd ../audio        && npm publish --access public
```

- `--access public` est requis pour un premier publish de paquet scopé.
- Après chaque `npm publish`, vérifier depuis un projet neuf hors dépôt :
  `npm install @thin-air/core`, importer `src/index.ts` via `tsx`, exécuter un
  exemple de README. Aucun son ne doit être émis (AIR-N-02) : les exemples
  écrivent des tableaux et des fichiers, jamais sur un périphérique.
- Un tag autre que `latest` (par ex. `npm publish --tag next`) permet un essai
  sans devenir la version par défaut.

## Ce qui reste à décider

- **Nom scopé ou non.** L'état actuel est scopé (`@thin-air/*`) : cela suppose
  une organisation npm `thin-air` (création gratuite, `npm org`), et le nom
  simple `thin-air` reste libre pour un éventuel paquet-cadre. Sans scope, il
  faudrait trois noms simples disponibles sur le registre mondial — peu
  probable. Recommandation : garder le scope.
- **Registre.** npmjs.org public (hypothèse par défaut), GitHub Packages
  (`npm.pkg.github.com`, pratique si les consommateurs sont déjà sur GitHub), ou
  un registre privé. Rien n'est configuré dans le dépôt ; le choix impacte
  l'authentification (`npm login --registry=…`) et le champ `publishConfig`.
- **Paquet source-only ou compilé.** Le choix source-only est documenté
  ci-dessus ; passer à `dist/` demandera un `tsconfig` par paquet, un script
  `build`, `"files": ["dist"]` et `exports` en `{ "types": …, "default": … }`.
- **Politique de version** : semver strict sur les trois paquets, versions
  synchronisées ou indépendantes dès la première API publique figée.

## Garde-fous en place

- `"private": true` sur les trois paquets : `npm publish` échoue tant qu'il y est.
- `node scripts/pack-check.mjs` exige `license`, `files` et un `exports`
  résolvable vers des fichiers existants ; il refuse tout fichier sonore.
- Le banc `instruments/publication.test.ts` revalide les trois manifests dans
  `npx vitest run`.
- Aucun script du dépôt n'appelle `npm publish`.
