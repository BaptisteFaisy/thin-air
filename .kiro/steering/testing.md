---
inclusion: always
---

# Tests — trois niveaux de preuve, aucun haut-parleur (§13.1)

| Niveau | Ce qui est prouvé | Comment |
|---|---|---|
| 1 — Événements | d'une prise à la liste des notes et des réglages | calcul pur dans Node, comparaison exacte |
| 2 — Son rendu | de la liste d'événements aux échantillons | rendu hors ligne, mesures avec tolérance |
| 3 — Bout en bout | la page entière, d'une fausse caméra aux événements | un fichier vidéo en guise de caméra ; on lit le journal des événements |

## Règles

- Les propriétés du §13.2 sont générées avec fast-check et **nommées d'après
  leur identifiant** : `it("AIR-P-02 — la sortie reste bornée", …)`.
- Une propriété dont la dépendance n'est pas encore implémentée (autre lot)
  est marquée `it.todo("… — dépend du lot …")`. Jamais de `it.skip` silencieux.
- Les graines sont consignées : une même prise et un même instrument donnent
  la même liste d'événements, au bit près (AIR-N-09, AIR-P-12).
- Aucune caméra réelle (AIR-N-10) : des prises enregistrées, des prises de
  synthèse, et un seul essai de bout en bout avec un fichier vidéo.
- Aucun test n'ouvre de périphérique audio (AIR-N-02) : les rendus vont dans
  des dossiers ignorés (`out/`, `bench-out/`).

## Tolérances du §13

- Fréquence d'un palier : **5 centièmes de demi-ton** (0,57 Hz pour le sol à
  196 Hz).
- Instants : **une image près** par rapport à l'implémentation de référence —
  le filtrage retarde les événements d'environ 80 ms à la vitesse de l'exemple
  du thérémine (§7.14), la liste des notes, elle, est comparée exactement.
- Crête : sous **−1 dB** ; silence : sous **−60 dB** en 800 ms sans
  réverbération, en deux secondes avec (AIR-P-15).

## Les gardes

`npm run guards` (soit `node scripts/hooks/run-all-guards.mjs`) lance toutes
les gardes `*-guard.mjs` de `scripts/hooks/` et sort non nul au premier refus.
C'est le miroir CI des hooks de `.kiro/hooks/hooks.json` : la même règle est
vérifiée par l'agent pendant l'écriture et par la CI après le push. Un banc
qui ajoute une garde la nomme `*-guard.mjs` : elle est découverte
automatiquement.
