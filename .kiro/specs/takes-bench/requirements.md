---
spec: takes-bench
parcours: "Exigences d'abord"
exigences: [AIR-F-47, AIR-F-48, AIR-F-49]
proprietes: [AIR-P-20]
sections: ["§7.11", "§11.6", "§13.3", "§13.1"]
---

# takes-bench — Exigences

**Parcours : Exigences d'abord** — la prise est une donnée personnelle et une
preuve : ce qu'elle contient et ce qu'elle pèse sont des critères, pas des
détails d'implémentation.

## Critères (EARS)

- **AIR-F-47** — QUAND l'utilisateur le demande, le système DOIT enregistrer
  une prise, faite **des points des mains et de rien d'autre**, et la proposer
  en téléchargement.
- **AIR-F-48** — Le système DOIT pouvoir rejouer une prise comme si les mains
  étaient devant la caméra.
- **AIR-F-49** — Le projet DOIT fournir une commande qui, pour une prise et un
  instrument, produit la liste des événements, un rendu audio et un rapport de
  mesures, **sans périphérique audio**.
- **AIR-P-20** — Coder puis décoder une prise conserve les points au pas de
  codage près ; une prise ne contient que des instants, des côtés, des scores
  et des points.

## Contenu et poids (§7.11)

- Contenu : la cadence, puis pour chaque image un instant `t` et, par main, le
  côté, le score et les **21 points** de trois coordonnées.
- Poids : 2 mains × 21 points × 3 coordonnées = **126 nombres par image**, soit
  3 780 par seconde à 30 images. En JSON brut, environ **26 Ko/s** ; en entiers
  de 16 bits, **7,6 Ko/s**. Dix secondes pèsent moins de 100 Ko une fois
  tassées.
- Une prise reste sur l'appareil et n'est enregistrée que sur demande
  (AIR-N-01, `privacy.md`).

## La commande (AIR-F-49, §11.6)

| Commande | Effet |
|---|---|
| `bench events --take <prise> --instrument <fichier>` | imprime les événements ; Node, sans navigateur |
| `bench render --take <prise> --instrument <fichier> --out <dossier>` | écrit `events.json`, `render.wav`, `report.json` |
| `bench compare <rapport> <référence>` | compare avec les tolérances du §13 ; code non nul en cas d'écart |
| `bench synth <forme> [paramètres]` | fabrique une prise de synthèse |

Les prises de référence du §13.3 : `left-hand-only`, `two-hands-cross`,
`slow-rise`, `harp-sweep`, `tremor-at-boundary`, `hand-leaves-mid-note`,
`fast-jab`, plus trois prises réelles enregistrées pour régler le filtre.
