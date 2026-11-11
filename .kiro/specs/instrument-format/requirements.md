---
spec: instrument-format
parcours: "Conception d'abord"
exigences: [AIR-F-21, AIR-F-43, AIR-F-44]
proprietes: [AIR-P-19]
sections: ["§6.2", "§7.8", "§11.4", "annexe B"]
---

# instrument-format — Exigences

**Parcours : Conception d'abord** — le format est une conception : il décide de
tout ce que les six instruments peuvent dire, et un champ oublié coûte une
migration. La conception (`design.md`) précède les critères ci-dessous, qui
sont la relecture de l'angle « l'instrument est un fichier » (§6.2).

## La conception

Le format `thin-air-instrument/1` est décrit par le type `Instrument` de
`packages/core/src/types.ts` (figé) et illustré par les six fichiers de
`instruments/`. Un instrument porte : `format`, `name`, `pointer`, `scale`,
**une** forme parmi `range` / `strings` / `zones`, `snap`, `voices`,
`controls`, `gestures`, `oneHand`, `sound`, `defaults`. Aucun autre champ.

## Critères (EARS)

- **AIR-F-21** — Le système DOIT livrer **Phantom, Harp et Choir**, tels que
  décrits en §7.8 — et le fichier est la seule description : rien de ces trois
  instruments ne vit dans du code.
- **AIR-F-43** — Un instrument DOIT être un fichier **validé par schéma**. Un
  fichier invalide DOIT être refusé **en entier**, avec la raison.
- **AIR-F-44** — Le système DOIT permettre de dupliquer un instrument et d'en
  changer la gamme, la fondamentale, l'étendue, le nombre de cordes ou de
  zones, l'aimant et le son.
- **AIR-P-19** — Tout instrument généré survit à un aller-retour d'écriture et
  de lecture ; tout fichier altéré est accepté comme valide ou refusé en
  entier, sans exception.
- **AIR-F-45 (S)** — Le système DOIT produire un lien qui contient l'instrument
  dans le fragment d'adresse.
- **AIR-F-22 (S) / AIR-F-23 (O)** — Bells et Drone (S) ; Grid drums, frappes
  replacées sur la grille (O).

## Le principe qui décide de tout

« Un fichier invalide est refusé **en entier**, avec la raison : jamais de
valeur par défaut silencieuse » (`packages/schema/src/index.ts`). Une valeur
manquante n'est pas complétée par le lecteur ; elle est une erreur, ou elle
vient de `defaults.ts` (`withSettings`), qui est une source unique et
explicite.
