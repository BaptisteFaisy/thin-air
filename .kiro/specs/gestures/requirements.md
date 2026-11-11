---
spec: gestures
parcours: "Exigences d'abord"
exigences: [AIR-F-14, AIR-F-16, AIR-F-17, AIR-F-12]
proprietes: [AIR-P-06, AIR-P-07, AIR-P-08, AIR-P-21]
sections: ["§7.6", "§7.9", "§13.2", "§14.1"]
comparaison: "candidat à la comparaison « spec contre vibe coding »"
---

# gestures — Exigences

**Parcours : Exigences d'abord.** Les critères sont écrits, puis **analysés**,
avant la conception (§14.1) : c'est la spec où l'analyse a trouvé une
contradiction réelle entre quatre délais qui se croisent (voir `design.md`,
section « Le cas qui contredit »).

C'est aussi le **candidat à la comparaison « spec contre vibe coding »** :
petit, bien borné, plein de cas limites — seuils, réarmement, images
manquantes. Le coût réel d'une spec complète se mesure ici (§14.6).

## Critères (EARS)

- **AIR-F-14** — Chaque geste de §7.6 DOIT s'enclencher et se relâcher à des
  seuils distincts.
- **AIR-F-16** — SI aucune image n'a été analysée depuis 300 ms, ou si l'onglet
  est masqué, ALORS le système DOIT relâcher toutes les voix.
- **AIR-F-17** — Une traversée de corde DOIT produire un déclenchement et un
  seul.
- **AIR-F-12 (S)** — OÙ le mode maintien est actif, rester 400 ms dans une zone
  DOIT verrouiller sa note jusqu'au prochain passage.
- **AIR-P-06** — Pour toute prise dont la hauteur tremble avec une amplitude
  inférieure à la marge (15 %), il se produit **au plus un** changement de note.
- **AIR-P-07** — Toute traversée franche d'une corde produit exactement un
  pincement ; un tremblement autour d'une corde en produit au plus un par
  délai de réarmement (80 ms).
- **AIR-P-08** — Un balayage de gauche à droite sur `k` cordes les fait sonner
  dans l'ordre montant ; le balayage inverse, les mêmes dans l'ordre
  descendant.
- **AIR-P-21** — Pour toute prise où deux mains se croisent sans disparaître,
  les rôles ne s'échangent pas.

## Le tableau des seuils (§7.6) — recopié, jamais réinventé

| Geste | S'enclenche quand | Se relâche quand |
|---|---|---|
| Pince | `pinch` passe sous **0,25** | `pinch` repasse au-dessus de **0,40** |
| Poing | `open` passe sous **0,20** | `open` repasse au-dessus de **0,35** |
| Entrée dans une zone | pointeur dans la zone **réduite de 10 %** | hors de la zone **agrandie de 10 %** |
| Traversée d'une corde | le pointeur change de côté entre deux images, à plus de **0,15** largeur/seconde | réarmement après **80 ms** |
| Changement de note aimantée | la hauteur dépasse la frontière entre deux notes voisines de **15 %** de leur écart | — |
| Sortie de main | absente depuis plus de **150 ms** | — |

En notation EARS, les quatre délais sont des **conditions temporelles** :

- **QUAND** une main n'est plus vue, le système DOIT tenir ses valeurs pendant
  150 ms, **ET** SI elle est encore absente à l'issue de ces 150 ms, ALORS
  relâcher ses notes.
- **SI** aucune image n'a été analysée depuis 300 ms, **ALORS** relâcher toutes
  les voix, quel que soit l'état des mains.
- **OÙ** le mode maintien est actif, **QUAND** une main reste 400 ms dans une
  zone, la note est verrouillée ; **QUAND** le pointeur quitte la zone, le
  verrou tombe.
- **QUAND** une traversée vient d'être déclenchée, la même corde NE DOIT plus
  pouvoir sonner avant 80 ms.

## Ce qui n'est pas dans cette spec

Le filtrage (`filtering`), l'attribution des rôles au-delà de la stabilité
(`capture-vision`), la conversion geste → événement (`instrument-format`),
l'attribution des voix (`seam-and-voices`).
