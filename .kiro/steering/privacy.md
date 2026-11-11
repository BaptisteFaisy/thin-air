---
inclusion: always
---

# Vie privée — rien ne quitte le navigateur

**Aucune image n'est conservée, aucune image n'est envoyée.** Une prise ne
contient que des points. Aucune requête ne part vers un tiers (AIR-N-01).

## Les trois règles

1. **L'image ne sort pas de la caméra.** Le modèle travaille sur des vignettes
   d'environ 200 points de côté, dans la page. Ce qui est gardé, c'est le
   résultat : 21 points par main, un côté, un score (§7.3). L'image de la
   caméra n'est pas affichée par défaut (AIR-F-52) et aucun fichier image
   n'est écrit.
2. **Une prise ne contient que des points.** Format `thin-air-take/1` : la
   cadence, puis pour chaque image un instant `t` et, par main, `side`,
   `score` et 21 points de trois coordonnées. Toute autre clé est refusée —
   c'est le rôle de `take-privacy-guard`. Le poids est une deuxième preuve :
   environ 26 Ko/s en JSON brut (§7.11) ; le garde refuse au-delà de
   150 Ko/s, plafond fixé au double du pire cas légitime (60 images par
   seconde, coordonnées non arrondies).
3. **Aucune requête tierce.** Le modèle et ses fichiers d'exécution sont servis
   par le site lui-même, dans `public/models/` (§7.3, §11.9) : rien ne dépend
   d'un service tiers et la page fonctionne hors ligne après la première
   visite (AIR-F-54). Aucune mesure d'audience. Après le chargement, le
   journal réseau du navigateur de test ne contient aucune requête (recette
   §18). Aucun microphone n'est demandé (AIR-F-56), rien n'est envoyé
   (AIR-F-57).

## Ce qui reste une donnée corporelle

Les points d'une main ne sont pas une image, mais ils décrivent un corps :
une prise n'est enregistrée **que sur demande** et **reste sur l'appareil**
(§7.11, AIR-F-47). Le rectangle de calibration est gardé sur l'appareil.
Un rapport de défaut demande la prise, jamais une capture d'écran.

## Ce qu'on écrit à l'écran

« rien ne quitte ton navigateur » — et jamais « sécurisé » ou « anonyme »
sans dire pourquoi (§5.4).
