---
spec: seam-and-voices
parcours: "Conception d'abord, la section 7.9 en entrée"
exigences: [AIR-F-24, AIR-F-26, AIR-F-27]
proprietes: [AIR-P-09, AIR-P-10, AIR-P-11, AIR-P-12]
sections: ["§7.9", "§11.3", "§13.2"]
---

# seam-and-voices — Exigences

**Parcours : Conception d'abord, avec la section §7.9 en entrée.** La couture
n'est pas une fonctionnalité : c'est une frontière entre deux horloges, et elle
se conçoit avant de s'écrire. Le texte de §7.9 est l'entrée de la conception,
recopié dans `design.md`.

## Critères (EARS)

- **AIR-F-24** — QUAND l'utilisateur change d'instrument, les voix en cours
  DOIVENT s'éteindre en fondu, sans claquement.
- **AIR-F-26** — Toute mise à jour d'un réglage continu DOIT passer par une
  rampe (`setTargetAtTime(valeur, instant, τ)`, τ = 20 ms).
- **AIR-F-27** — Le système NE DOIT jamais faire sonner plus de `maxVoices`
  (8) voix ; au-delà, la plus ancienne est reprise.
- **AIR-P-09** — Pour toute prise, tout début de note a une fin, et après la
  dernière image, le délai de grâce et l'extinction, aucune voix n'est active.
- **AIR-P-10** — À tout instant, le nombre de voix actives est ≤ `maxVoices`.
- **AIR-P-11** — Les instants des événements ne décroissent jamais, et aucun
  événement ne précède l'image qui l'a causé.
- **AIR-P-12** — Même prise, même instrument : même liste d'événements, à
  l'identique.

## Le contrat qui traverse (§11.3)

```ts
export type MusicEvent =
  | { type: "noteOn"; t: number; voice: string; midi: number; velocity: number }
  | { type: "noteOff"; t: number; voice: string }
  | { type: "control"; t: number; voice: string;
      param: "pitch" | "gain" | "cutoff" | "vibrato"; value: number };
```

`t` est en secondes sur l'horloge du son. **Ce type ne change pas** : c'est la
frontière que tous les lots traversent.
