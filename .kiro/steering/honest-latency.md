---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# Le retard dit honnêtement (§5.4, AIR-F-31 à 33, AIR-N-12)

## Le vocabulaire imposé

| À écrire | À ne jamais écrire |
|---|---|
| « retard estimé », « retard mesuré (analyse et audio) » | « temps réel », « instantané », « zéro latence » |
| « aimanté sur la gamme » | « toujours juste » (le glissé libre existe) |
| « rien ne quitte ton navigateur » | « sécurisé », « anonyme » sans dire pourquoi |
| « sons synthétisés » | « sons d'instruments réels » |

`scripts/hooks/wording-guard.mjs` contrôle ces libellés sur `apps/web/src`,
`apps/web/index.html`, `README.md`, `instruments/` et `docs/user/` — en CI
comme en hook. Le nom anglais du projet évite déjà le mot « real-time »
(§6.3).

## Toute valeur affichée porte sa nature

Chaque nombre de retard dit s'il est **mesuré** ou **estimé** (AIR-N-12) :

| Composante | Nature |
|---|---|
| attente de l'image suivante (0 à 33 ms à 30 images par seconde, 17 en moyenne) | mesurée : intervalle entre images |
| analyse des mains (5 à 25 ms) | mesurée |
| filtrage, gestes, correspondance (1 à 5 ms) | mesurée |
| sortie audio (10 à 45 ms en filaire) | en partie : `baseLatency`, `outputLatency` |
| caméra (30 à 70 ms) | **non mesurable dans le navigateur : estimée** |

L'écran affiche donc : « analyse 12 ms, traitement 2 ms, sortie audio 21 ms ;
caméra non mesurable, estimée entre 30 et 70 ms » (§5.2). Si `outputLatency`
manque, l'écran dit que la mesure est **partielle** (`LatencyReport.partial`).

## Les deux alertes

- **Sortie sans fil** : si la sortie audio déclarée dépasse **100 ms**
  (`wirelessWarnMs`), l'écran le signale et conseille une sortie filaire
  (AIR-F-32) — un casque sans fil ajoute 150 à 250 ms.
- **Compensation** : ce qui est enregistré dans la boucle est avancé du retard
  estimé — la part mesurée, plus **50 ms** pour la caméra (`cameraLatencyMs`,
  réglable de 0 à 120). Sans cela, avec 105 ms de retard, chaque note tombe en
  retard de 63 % d'une double croche et la boucle boite (§7.10).

## Le chiffre à ne jamais promettre

Le retard total va de **46 à 178 ms**, environ **105 ms** dans un cas courant
en filaire (§5.1) : ces ordres de grandeur sont à remplacer par les valeurs
relevées sur les machines, dans `docs/latency.md`, pour deux machines au moins
(recette §18). Cent millisecondes, c'est 34 mètres parcourus par le son.
