# Instruments

Un instrument est un fichier, validé par schéma (AIR-F-43). Le format est
`thin-air-instrument/1` ; l'exemple de référence est en annexe B du cahier, et
le contrat TypeScript est `packages/core/src/types.ts`.

| Fichier | Instrument | Priorité | Geste | Moteur |
|---|---|---|---|---|
| `phantom.json` | Phantom (thérémine) | I | Une main choisit la hauteur, l'autre le volume | `osc` |
| `harp.json` | Harp (cordes pincées) | I | L'index traverse seize cordes | `pluck` |
| `choir.json` | Choir (nappes) | I | Une main posée dans une zone tient une note | `osc` |
| `bells.json` | Bells (cloches) | S | Un passage vers le bas frappe une zone | `fm` |
| `drone.json` | Drone (bourdon) | S | La hauteur choisit une note grave tenue | `osc` |
| `grid-drums.json` | Grid drums (percussions) | O | Quatre zones, frappes replacées sur la grille | `drum` |

Chaque fichier est validé en CI et rendu sur les prises de référence
(`render-check`, cahier §14.3) : la preuve est un rapport de mesures, jamais une
écoute.
