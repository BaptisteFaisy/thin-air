# Prises

Une prise est l'enregistrement du flux des points des mains — **jamais de
l'image** (cahier §7.11, AIR-F-47). Les points restent une donnée corporelle :
une prise n'est enregistrée que sur demande et reste sur l'appareil.

| Dossier | Contenu |
|---|---|
| `reference/` | Les prises fixes du §13.3, chacune avec son rapport attendu : `left-hand-only`, `two-hands-cross`, `slow-rise`, `harp-sweep`, `tremor-at-boundary`, `hand-leaves-mid-note`, `fast-jab` |
| `synth/` | Les prises de synthèse produites par les générateurs (`packages/core/src/takeGen.ts`) : main à vitesse constante, tremblement d'amplitude donnée, traversée de cordes, sortie de main, images manquantes |

Format `thin-air-take/1`, poids : 2 mains × 21 points × 3 coordonnées = 126
nombres par image, soit environ 26 Ko/s en JSON brut et 7,6 Ko/s en entiers de
16 bits. Le garde `take-privacy-guard` refuse toute prise qui contiendrait autre
chose que des instants, des côtés, des scores et des points.
