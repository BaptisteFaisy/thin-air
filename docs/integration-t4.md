# Intégration des profils de mobilité — LOT t4

Ce lot n'ajoute que des **fichiers nouveaux** ; le raccordement aux réglages
existants est volontairement laissé à part, ici. Chaque bloc est prêt à être
copié tel quel. Rien n'est à inventer : les fonctions appelées existent déjà.

## Ce qui est déjà livré (ne pas modifier)

- `apps/web/src/state/profiles.ts` — les trois profils (`PROFILES`,
  `profileById`, `applySettings`, `applyRect`, `noProfileRect`).
- `apps/web/src/state/profiles.test.ts` — les propriétés (tessiture intacte,
  lissage accentué, zonage borné).
- `apps/web/src/ui/Profiles.tsx` — le composant à clavier + `aria-pressed`.
- `apps/web/src/i18n/profiles.en.ts` et `profiles.fr.ts` — les libellés.

## Fichier par fichier, avec le code à insérer

### 1. `apps/web/src/i18n/en.ts`

Ajoute l'import en tête (à côté des autres imports inexistants ici, il suffit
de le placer avant `export const en = {`), puis la clé `profiles` dans l'objet
`en`, juste avant la clé `camera` :

```ts
import { profilesEn } from "./profiles.en.js";
```

```ts
  // … dans l'objet `en` (avant `camera: {` par exemple) :
  profiles: profilesEn,
```

Le type `Messages` en découle automatiquement (`typeof en`), aucune autre
modification.

### 2. `apps/web/src/i18n/fr.ts`

Même opération côté français :

```ts
import { profilesFr } from "./profiles.fr.js";
```

```ts
  // … dans l'objet `fr` :
  profiles: profilesFr,
```

Le test de parité `en`/`fr` (`i18n.test.ts`) vérifiera tout seul que les deux
portent exactement les mêmes clés.

### 3. `apps/web/src/hooks/useSeanceData.ts`

Ajoute l'import de type, les deux champs dans `SeanceData`, l'état, et la
restitution :

```ts
import type { ProfileId } from "../state/profiles.js";
```

```ts
  readonly profileId: ProfileId | null;
  readonly setProfileId: (id: ProfileId | null) => void;
```

```ts
  const [profileId, setProfileId] = useState<ProfileId | null>(null);
```

```ts
  // … dans la valeur rendue :
  profileId, setProfileId,
```

Le profil actif n'est pas persisté : ce qui compte, ce sont les **réglages** et
la **zone** qu'il applique, déjà écrits sur l'appareil par les effets existants.

### 4. `apps/web/src/state/handlers.ts`

Complète les imports (aux imports déjà présents, ajoute) :

```ts
import { DEFAULT_SETTINGS } from "@thin-air/core";
import { idleCalibration } from "./calibration.js";
import {
  applySettings,
  noProfileRect,
  profileById,
  type ProfileId,
} from "./profiles.js";
```

Puis, dans la valeur rendue par `gestionnaires` (à côté de `onSettings` et de
`onClose`) :

```ts
    onApplyProfile: (id: ProfileId) => {
      const profil = profileById(id);
      data.setSettings(applySettings(data.settings, profil));
      if (profil.playRect !== null) {
        data.setCalibration(() => idleCalibration(profil.playRect));
      }
      data.setProfileId(id);
    },
    onClearProfile: () => {
      data.setProfileId(null);
      data.setSettings({ ...DEFAULT_SETTINGS });
      data.setCalibration(() => idleCalibration(noProfileRect()));
    },
```

`idleCalibration(rect)` repart d'un état `idle` avec la zone stockée `rect` :
la persistance (`useRectPersistence`) la réécrit sur l'appareil aussitôt que
`storedRect(calibration)` change.

### 5. `apps/web/src/ui/Panels.tsx`

Ajoute les champs au contrat et au composant :

```ts
import type { ProfileId } from "../state/profiles.js";
```

```ts
// … dans `PanelHandlers` :
  readonly onApplyProfile: (id: ProfileId) => void;
  readonly onClearProfile: () => void;
```

```ts
// … dans `PanelsProps` :
  readonly profileId: ProfileId | null;
```

Puis, dans le `SettingsPanel` (bloc `panel === "settings"`) :

```tsx
      <SettingsPanel
        m={m}
        settings={props.settings}
        instrument={props.instrument}
        reducedMotion={props.reducedMotion}
        profileId={props.profileId}
        onApplyProfile={handlers.onApplyProfile}
        onClearProfile={handlers.onClearProfile}
        onChange={handlers.onSettings}
        onClose={handlers.onClose}
      />
```

### 6. `apps/web/src/ui/SettingsPanel.tsx`

Ajoute l'import, les props, et le rendu :

```tsx
import { Profiles } from "./Profiles.js";
import type { ProfileId } from "../state/profiles.js";
```

```tsx
// … dans `SettingsPanelProps` :
  readonly profileId: ProfileId | null;
  readonly onApplyProfile: (id: ProfileId) => void;
  readonly onClearProfile: () => void;
```

Dans le corps, avant `<ReglagesJeu … />` (les profils sont des réglages de jeu
proposés d'un coup) :

```tsx
      <Profiles
        m={m.profiles}
        active={props.profileId}
        onApply={props.onApplyProfile}
        onClear={props.onClearProfile}
      />
```

### 7. `apps/web/src/ui/Seance.tsx`

Passe l'état au tiroir de panneaux :

```tsx
      <Panels
        panel={data.panel}
        m={m}
        instrument={data.instrument}
        library={data.library}
        loop={data.loop}
        calibration={data.calibration}
        settings={data.settings}
        profileId={data.profileId}
        display={data.display}
        midiAvailable={session.state.midi === "available"}
        reducedMotion={s.reducedMotion}
        link={shareLink(data.instrument, origine())}
        handlers={s.handlers}
      />
```

## Ordre des modifications

Les types se suivent dans un seul sens : `profiles.ts` → (i18n) →
`useSeanceData` → `handlers` → `Panels` → `SettingsPanel` → `SeanceView`.
Après avoir inséré tout ce qui précède, lancer `npx tsc --noEmit -p tsconfig.json`
puis `npx vitest run` : les deux doivent rester verts.