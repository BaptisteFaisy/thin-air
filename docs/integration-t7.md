# Activer le mode kiosque — intégration (LOT t7)

Le mode kiosque est entièrement nouveau : ses fichiers vivent dans
`apps/web/src/kiosk/` (`Kiosk.tsx`, `useKiosk.ts`, `kiosk.ts`,
`kioskState.ts`, `kiosk.css`) et ses libellés dans `apps/web/src/i18n/kiosk.{en,fr}.ts`.
Aucun de ces fichiers ne remplace un fichier existant : pour que la borne soit
servie, il faut deux raccords dans des fichiers partagés, et c'est tout.

Perçu voulu : après ces deux raccords, l'adresse `?kiosk=1` rend la borne
plein écran (le fantôme rejoue `slow-rise.json` en boucle), et une adresse nue
continue de rendre la séance habituelle, inchangée.

## 1. `apps/web/src/App.tsx` — montage conditionnel

Ajouter deux imports en tête de fichier :

```tsx
import { Kiosk } from "./kiosk/Kiosk.js";
import { kioskWanted } from "./kiosk/kiosk.js";
```

Puis, en tout premier dans le corps de `App`, avant l'accueil :

```tsx
export function App(): JSX.Element {
  const kiosque = kioskWanted(typeof window === "undefined" ? "" : window.location.search);
  if (kiosque) return <Kiosk />;
  // … le corps actuel (accueil puis séance) reste strictement identique …
}
```

Rien d'autre ne change dans `App.tsx` : la borne court-circuite la séance et
ses panneaux, le reste du composant ne la voit jamais.

## 2. `apps/web/src/i18n/index.ts` — exposer les libellés de la borne

La borne importe déjà ses libellés directement (`../i18n/kiosk.en.js` et
`../i18n/kiosk.fr.js`), elle n'a pas besoin de l'index pour fonctionner. On
les expose quand même pour la parité des textes et l'audit :

```ts
export { kioskEn } from "./kiosk.en.js";
export { kioskFr } from "./kiosk.fr.js";
export type { KioskMessages } from "./kiosk.en.js";
```

Optionnel : si le test de parité en/fr est étendu, il peut comparer
`kioskEn` et `kioskFr` comme il compare `en` et `fr`.

## 3. Réglages imposés en mode kiosque (aucun fichier à modifier)

Ils sont portés par `apps/web/src/kiosk/kiosk.ts` (`kioskSettings()`), par
surenchère sur `DEFAULT_SETTINGS` — la séance classique n'en hérite pas :

| Réglage | Valeur en kiosque | Pourquoi |
|---|---|---|
| Instrument | `Phantom` (le premier livré, §7.8) | le seul qui accompagne la prise du fantôme |
| Aimant (`magnet`) | `1` | la hauteur se pose sur la gamme : agréable à main pressée, sans réglage visible |
| Volume d'une main (`masterGainDb`) | `-12` (le défaut) | identique au reste du site |
| Volume du fantôme | `-24` | « à faible volume » demandé par AIR-F-50 |

## Ce qui n'est PAS à modifier

- **Aucun `package.json`, `tsconfig*`, `vitest.config.ts`, `.github/**`, `vite.config.ts`** :
  le kiosque n'ajoute aucune dépendance, aucun alias, aucun script.
- **`apps/web/vite.config.ts`** : inutile d'y toucher. La prise du fantôme est
  lue au build par `import.meta.glob("../../../../takes/reference/slow-rise.json")`,
  exactement comme le chargeur d'instruments lit `instruments/*.json` : la prise
  est incluse dans l'assemblage, aucune requête à l'exécution (AIR-N-01).
- **`takes/reference/**`** : lecture seule, seule `slow-rise.json` est rejouée.

## Vérification après raccord

```sh
npx tsc --noEmit -p tsconfig.json
npx vitest run
node scripts/hooks/run-all-guards.mjs
npx vite build apps/web
```

Puis charger `?kiosk=1` en local et vérifier : plein écran sans réglage, le
fantôme joue, une main l'arrête, elle repart et il revient après 10 s.