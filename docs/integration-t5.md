# Raccordement des leçons — à faire par l'intégrateur

Les deux leçons livrent leur logique pure et leurs tests. Il reste le tracé et le
montage, qui touchent des fichiers partagés avec d'autres lots en cours
(`apps/web/src/ui/`, `i18n/`, `App.tsx`) : d'où cette note plutôt qu'un
changement direct.

## 1. Tracé

Créer `apps/web/src/lessons/FilterLesson.tsx` et `CentsLesson.tsx` : un `<svg>`
par leçon, `viewBox="0 0 320 120"`, une `polyline` par série (brut, vif, lissé —
trois couleurs de la direction artistique §12.3), et les nombres **en texte** à
côté du tracé (accessibilité : la note et l'écart doivent être lisibles sans le
dessin, AIR-N-06). Aucune animation continue : `prefers-reduced-motion` n'a alors
rien à désactiver.

## 2. Montage

Dans l'écran « Physique » du §12.1 (repérer le composant qui affiche déjà
fréquence et nom de la note — `grep -rn "physics\|Physique" apps/web/src/ui/`),
ajouter les deux leçons sous forme d'onglets ou de sections repliables. Les
données viennent de `buildFilterLesson()` et `buildCentsLesson(u, scale, range, magnet)`
— les deux sont pures et mémorisables avec `useMemo`.

## 3. Libellés

Créer `apps/web/src/i18n/lessons.en.ts` et `lessons.fr.ts`, puis **une seule
ligne** à ajouter dans l'index des libellés existant : l'import et l'étalement des
deux objets. Libellés à prévoir : « Tremblement brut / filtré / déclencheur »,
« Retard du lissage », « Note visée », « Note jouée », « Écart en centièmes »,
« Force de l'aimant ». Vocabulaire §5.4 : aucune de ces étiquettes ne parle de
temps réel — on parle de « retard mesuré ».

## 4. Vérification après branchement

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run apps/web/src/lessons
node scripts/hooks/run-all-guards.mjs   # le garde de vocabulaire scanne apps/web/src
npx vite build apps/web
```
