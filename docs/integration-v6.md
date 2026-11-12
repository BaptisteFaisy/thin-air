# Raccordement de la leçon « les deux horloges » — à faire par l'intégrateur (LOT v6)

La leçon livre sa logique pure et ses tests (`apps/web/src/lessons/horlogesLesson.ts`,
`horlogesLesson.test.ts`) et son contenu pédagogique (`docs/lecon-horloges.md`).
Il reste le tracé et le montage, qui touchent des fichiers partagés avec
d'autres lots (`apps/web/src/ui/`, `i18n/`) : d'où cette note plutôt qu'un
changement direct. Elle suit `docs/integration-t5.md` (les deux premières
leçons) ; les trois leçons se montent de la même façon.

## 1. Tracé — nouveau fichier `apps/web/src/lessons/HorlogesLesson.tsx`

Un `<svg>`, `viewBox="0 0 320 120"`, deux rangées de graduations :

- rangée du haut, l'horloge des images : un trait par entrée de `lecon.images`
  (abscisse proportionnelle à `tS`) ;
- rangée du bas, l'horloge du son : un trait par `lecon.evenements` (abscisse
  proportionnelle à `tS`), et pour chaque image de la rangée du haut un trait
  fin à `programmeS` — on voit l'avance de 5 ms entre les deux rangées ;
- les nombres **en texte** à côté du tracé (accessibilité : tout doit être
  lisible sans le dessin, AIR-N-06) : `pasImageMs` (« 33,3 ms par image »),
  `echantillonsParImage` (« 1 600 échantillons par image »), `avanceMs`, et les
  trois retards avec leur origine — « mesuré » pour `retards.mesureMs`,
  « estimé » pour `retards.estimeCameraMs` (vocabulaire §5.4, AIR-N-12).

Aucune animation continue : `prefers-reduced-motion` n'a alors rien à désactiver.

## 2. Montage — écran « Physique » du §12.1

Dans `apps/web/src/ui/PhysicsPanel.tsx` (composant existant, seul raccord à
faire dans `ui/`), ajouter la leçon en section sous le tracé d'onde. Les
données viennent de `buildHorlogesLesson`, pure et mémorisable :

```tsx
import { useMemo } from "react";
import { buildHorlogesLesson } from "../lessons/horlogesLesson.js";

// dans le corps du composant :
const lecon = useMemo(
  () => buildHorlogesLesson(prise, evenements, parties, reglages.lookaheadMs),
  [prise, evenements, parties, reglages.lookaheadMs],
);
```

Origine des trois entrées, sans rien recalculer :

| Entrée | D'où elle vient |
|---|---|
| `prise` | la prise de la séance si elle existe ; sinon une prise de synthèse du §7.11 (`linearTake(poseFromPlay(0.2, 0.5), poseFromPlay(0.8, 0.5), { fps: 30, durationS: 1 })`), comme dans le test — la leçon est démonstrative, pas une mesure |
| `evenements` | les `MusicEvent` déjà produits par la séance (ils traversent la couture, §7.9) ; sinon `[]` |
| `parties` | le `LatencyParts` déjà utilisé par `LatencyReadout` (`latencyInitiale(settings)` avant mesure, `partsFromReport(report, …)` après) — les trois nombres affichés restent ceux de l'écran principal |

`PhysicsPanelProps` gagne donc les props `prise`, `evenements`, `parties`,
`reglages` (ou uniquement celles déjà disponibles dans l'état de la séance :
ne rien dupliquer, `state/latency.ts` reste la seule source des retards).

## 3. Libellés

Si `apps/web/src/i18n/lessons.{en,fr}.ts` existent déjà (lot t5), y ajouter les
clés ; sinon les créer et exposer dans `apps/web/src/i18n/index.ts` comme t5 le
décrit (une seule ligne d'import + étalement). Clés à prévoir :

```ts
horloges: {
  title: "The seam of two clocks",        // fr : « La couture des deux horloges »
  imageClock: "Image clock",              // fr : « Horloge des images »
  soundClock: "Sound clock",              // fr : « Horloge du son »
  perImage: "per image",                  // fr : « par image »
  samplesPerImage: "samples per image",   // fr : « échantillons par image »
  lookahead: "Scheduling lookahead",      // fr : « Avance de programmation »
  measured: "measured latency (analysis and audio)", // fr : « retard mesuré (analyse et audio) »
  estimatedCamera: "estimated camera latency",       // fr : « retard estimé de la caméra »
  total: "total",                         // fr : « total »
}
```

Vocabulaire §5.4 : les libellés disent « retard mesuré » / « retard estimé » ;
le garde (`scripts/hooks/wording-guard.mjs`) scanne `apps/web/src` commentaires
compris — aucune étiquette ne promet un retard nul ou imperceptible. Le test de
parité en/fr (`i18n.test.ts`) compare les objets : les deux langues doivent
porter exactement les mêmes clés.

## 4. Vérification après branchement

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run apps/web/src/lessons
node scripts/hooks/run-all-guards.mjs   # vocabulaire §5.4 sur apps/web/src
npx vite build apps/web
```
