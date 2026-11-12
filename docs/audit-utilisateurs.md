# Audit d'accessibilité avec des personnes — protocole prêt à l'emploi

Ce que le §12.4 du cahier promet (jouer au clavier, une main, mains qui
tremblent, note en cours lue comme du texte, jeu sans caméra), aucun outil ne
peut le vérifier. `docs/accessibility-report.md` prouve que les pages ne
violent aucune règle DOM ; il ne dit rien de ce qu'une personne **réussit** à
faire, ni de ce qu'elle **subit** en le faisant.

Ce document est le protocole d'un audit avec trois personnes réelles. Il est
écrit pour être suivi tel quel : trois profils, cinq tâches, une grille de
notation, des consignes de passation, et des feuilles de résultats vides
(`scripts/audit/feuille.tsv`).

**Ce que cet audit n'est pas.** Ce n'est pas une certification WCAG : le
nombre de participants est trop petit pour une statistique, et le résultat
décrit des situations, pas des populations. C'est une source de décisions
argumentées : où l'interface demande un effort inhabituel, et par conséquent
ce qu'on corrige en premier.

## 1. Objectif et périmètre

| | |
|---|---|
| Question | Une personne ayant un profil d'accessibilité donné peut-elle **jouer**, choisir un instrument, calibrer, lire la note et comprendre le retard, sans aide extérieure ? |
| Ce qu'on observe | La réussite de la tâche, le temps, les erreurs, les abandons |
| Ce qu'on ne fait pas | Tester la personne : ni sa dextérité, ni sa vision, ni sa fatigue, ni sa motivation |
| Durée d'une séance | 45 minutes (10 d'accueil, 30 de passation, 5 de clôture) |
| Nombre de personnes | 1 par profil, soit 3 séances |
| Support | Un ordinateur portable, la page ouverte en local, le son coupé pour l'observateur |

Le périmètre est volontairement celui du §12.4 : l'instrument et ses réglages.
La bibliothèque, le partage de prise et l'export ne sont pas testés ici.

## 2. Les trois profils

Chaque profil correspond à une situation réelle et à une configuration déjà
livrée par le produit (`apps/web/src/state/profiles.ts`) : l'audit vérifie ce
qui a été promis, pas une intention.

### P1 — « Assis, portée courte » (personne en fauteuil)

- **Configuration produit** : profil de mobilité `seated` — la zone de jeu se
  resserre sur la partie centrale de l'image, calibrée sur la portée réelle.
- **Installation** : la personne reste dans son fauteuil, à son emplacement
  habituel. L'ordinateur est sur une table adaptée, à la hauteur de ses
  coudes. **Ne pas** demander à la personne de se lever, de se pencher, ni de
  déplacer l'ordinateur : c'est le paramètre du poste, pas celui de la
  personne.
- **Entrées disponibles** : clavier et pointeur (mode « jouer sans caméra »).
  Aucune caméra n'est utilisée pendant cette séance.
- **Points de vigilance** : la portée réelle des mains, la lisibilité des
  libellés à distance, la hauteur des boutons, le fait de devoir tenir une
  posture stable pour atteindre la zone.

### P2 — « Malvoyante » (personne qui ne lit pas l'écran)

- **Configuration produit** : pas de profil de mobilité — c'est la lecture de
  l'écran qui est en cause : lecteur d'écran (NVDA sur Windows, VoiceOver sur
  macOS), zoom à 200 %, la note en cours annoncée comme texte.
- **Installation** : le lecteur d'écran de la personne est déjà configuré ;
  on ne touche pas à ses réglages. L'observateur regarde un deuxième
  écran — le même audio, la même page — sans jamais prendre la main.
- **Points de vigilance** : le parcours clavier complet, l'ordre de
  lecture, le nommage des contrôles, la compréhension des messages d'état
  annoncés, le fait de savoir *où* l'on est dans la page.

### P3 — « Mains qui tremblent » (tremblement des mains)

- **Configuration produit** : profil de mobilité `tremor` — filtrage plus
  fort, seuil de déclenchement plus doux, grâce allongée sur la main perdue.
- **Installation** : la personne utilise son ordinateur habituel (bureau,
  tablette, téléphone tenu d'une main) et sa posture habituelle. Le geste
  n'est pas « corrigé » : c'est le geste de la personne, et le lissage
  du filtre est ce qui est évalué.
- **Points de vigilance** : les fausses traversées de corde, la difficulté
  à tenir une note, le bruit de fond des filtres, la fatigue après quelques
  minutes de jeu.

## 3. Les cinq tâches

Les mêmes cinq tâches sont demandées aux trois profils, dans le même ordre.
L'ordre est progressif : on commence par jouer, on finit par lire une
information — une personne qui échoue à la première tâche doit tout de même
pouvoir continuer, sinon on mesure sa démotivation et non l'interface.

| # | Tâche | Consigne lue à voix haute (en français) | Critère de réussite |
|---|---|---|---|
| T1 | Jouer une mélodie | « Fais jouer une mélodie simple de ton choix. Prends le temps qu'il faut. » | Au moins une suite de 3 notes justes, tenues, jouée sans aide |
| T2 | Changer l'instrument | « Choisis un autre instrument et joue-en une note. » | Un autre instrument est sélectionné **et** une note en est produite |
| T3 | Calibrer | « Adapte la zone de jeu à ta portée, pour ne jouer que dans la partie que tu atteins vraiment. » | La calibration va à son terme et la zone obtenue contient les gestes de la personne |
| T4 | Lire la note en cours | « Dis-moi à voix haute la note qui est en train de sonner. » | La personne lit la note en cours sans qu'on le lui souffle (texte ou annonce) |
| T5 | Trouver le retard | « Le jeu a du retard. Trouve d'où vient ce retard, et dis-moi combien il y en a. » | La personne ouvre le panneau de retard et lit une valeur de retard |

### Adaptations par profil

Les consignes de T1 et T3 ne sont pas les mêmes selon la personne :

- **P1** : T1 se joue au pointeur (une main sur le pointeur, l'autre au
  clavier) ; T3 se fait sans quitter son fauteuil, l'observateur ne
  repositionne rien.
- **P2** : T1 se joue au clavier seul (`A` à `K` pour les cordes, comme
  l'indique l'interface) ; la lecture de la note se fait à l'oreille **et**
  par la lecture des annonces, ce qui est précisément ce que T4 vérifie.
- **P3** : T1 se joue à la main, sur le bureau de la personne ; T3 peut être
  omise si le tremblement empêche le geste — **on le note, on ne le devine
  pas**.

## 4. Grille de notation

Une note par tâche, de 0 à 3. La note porte sur **l'interface**, jamais sur la
personne.

| Note | Signification | Critère |
|---|---|---|
| **0** | Impossible | La tâche n'a pas été accomplie, ou n'a pas pu l'être sans une intervention de l'observateur |
| **1** | Pénible | La tâche a été accomplie, mais avec une aide, une reprise, ou une hésitation qui a alourdi le résultat |
| **2** | Possible | La tâche a été accomplie sans aide, mais de façon hésitante ou avec une erreur rattrapée |
| **3** | Naturel | La tâche a été accomplie sans aide, sans hésitation notable, et la personne a expliqué ce qu'elle faisait |

Précisions :

- « Sans aide » veut dire : l'observateur ne montre pas le chemin, ne dit pas
  le nom d'un bouton, ne déplace pas le pointeur. Une question neutre
  (« qu’est-ce que tu cherches ? ») n'est pas une aide ; une reformulation qui
  nomme le contrôle en est une.
- Une tâche réussie mais avec plus de trois erreurs est notée **2** au
  maximum : l'interface a demandé un effort de rattrapage.
- Une tâche abandonnée est notée **0**, et `abandon` vaut `1` dans la feuille.
- Le temps ne décide jamais de la note : il est mesuré à part. Une tâche
  rapide et notée 1 reste notée 1.

## 5. Consignes de passation

L'observateur est neutre, il ne montre pas et il ne commente pas.

1. **Avant** : lire la clause d'information (§6), attendre l'accord, répondre
   à toutes les questions, rappeler le droit d'arrêt.
2. **Une tâche à la fois** : la consigne est lue entière, puis l'observateur se
   tait jusqu'à ce que la personne dise avoir terminé ou demande de l'aide.
3. **Chronomètre** : il démarre à la fin de la consigne et s'arrête quand la
   personne annonce la fin, ou abandonne. Le temps d'attente de la personne
   compte.
4. **Pas de recompte de tentatives** : une seule tentative par tâche est
   notée. Une reprise demandée par la personne est comptée en erreurs, pas
   en nouvelle tentative.
5. **L'aide est notée** : si l'observateur intervient, la note est au plus 1
   et l'aide est décrite dans le champ `commentaire` — sans nommer la
   personne.
6. **Rien n'est optimisé pour la personne** : on ne corrige pas la posture,
   on ne montre pas le raccourci clavier, on ne reformule pas la consigne
   dans le geste que la personne a l'habitude de faire.
7. **Pause possible** : la pause fait partie de la séance ; le temps de
   pause ne compte pas dans le temps de tâche.
8. **Clôture** : deux questions ouvertes (« qu'est-ce qui a été le plus
   pénible ? », « qu'est-ce que tu changerais ? »), puis le rappel du droit
   d'arrêt et de la suppression possible des feuilles.

## 6. Clause d'information

À lire à voix haute, avant tout, en français clair. Ce texte peut être
adapté à l'oral, mais il ne doit perdre aucune de ses quatre idées.

> **On teste l'interface, pas toi.**
>
> 1. Ce qu'on cherche à savoir, c'est si l'interface te permet de faire
>    cinq gestes : jouer une mélodie, changer d'instrument, calibrer, lire la
>    note qui sonne, trouver d'où vient le retard. Ce n'est ni ta dextérité,
>    ni ta vision, ni ta force qui sont notées — c'est l'interface.
> 2. Ce que j'écris pendant la séance : le temps que chaque geste a pris, le
>    nombre d'erreurs, le nombre de fois où tu as arrêté, et une note de 0 à 3
>    par geste. Rien d'autre.
> 3. **Je n'écris pas** ton nom, ni ton âge, ni ta pathologie, ni aucune
>    donnée personnelle. La feuille porte un code (`A1`, `B2`, …), pas
>    d'identité. Aucune photo, aucune capture d'écran, aucune vidéo de
>    toi. La caméra n'est pas utilisée : on joue au clavier et au pointeur.
> 4. **Tu peux arrêter à tout moment**, sans rien expliquer et sans que ça
>    tienne à quoi que ce soit : la séance s'arrête, tes feuilles sont
>    supprimées si tu le demandes, et ce n'est pas signalé comme un échec.
>    Tu peux aussi me dire d'arrêter de noter une chose précise.

Et, en cas de doute, une phrase de plus : « Les feuilles ne sont pas
publiées : elles servent à décider ce qu'on corrige en priorité dans
l'interface. »

## 7. Ce qu'on mesure

| Mesure | Définition | Où |
|---|---|---|
| **Temps** | Secondes entre la fin de la consigne et l'annonce de fin (ou l'abandon) | `temps_s` |
| **Erreurs** | Nombre d'actions qui n'aboutissent pas : clic dans le vide, sélection annulée, recalibration, note confondue, message d'erreur déclenché | `erreurs` |
| **Abandons** | 1 si la personne arrête la tâche de son propre chef ou demande de l'aide pour la terminer, 0 sinon | `abandon` |
| **Note** | Note de 0 à 3 (§4) | `note` |
| **Qualitatif** | Ce que la personne dit, mot pour mot si possible | `commentaire` |

Sont notés aussi, dans la colonne `commentaire` : l'aide donnée, la tâche
réussie « par chance » (au hasard), et la fatigue signalée.

## 8. Ce qu'on ne mesure PAS

Ces règles ne sont pas des préférences : elles valent pour toutes les feuilles,
tous les participants et tous les rapports.

- **Aucune donnée personnelle.** Ni nom, ni prénom, ni âge, ni adresse, ni
  pathologie détaillée, ni situation de vie, ni coordonnées. Le profil
  retenu (« assis », « malvoyant », « tremblement ») est la seule donnée
  retenue, et c'est un choix de l'audit, pas une caractéristique relevée.
- **Aucune capture d'écran contenant une personne**, et plus largement
  aucune photo, aucune vidéo, aucun enregistrement d'écran pendant la
  séance. Les écrans du produit ne sont pas filmés ; le suivi se fait au
  chronomètre et au carnet.
- **Aucune donnée issue de la caméra** : la caméra n'est pas allumée pendant
  les séances. Le mode « jouer sans caméra » est le mode de l'audit, pour
  les trois profils.
- **Aucune valeur de réglage de la personne** : on ne relève ni le son, ni le
  volume, ni les préférences de son navigateur.
- **Aucun identifiant de participant dans le dépôt.** Les feuilles remplies
  vivent hors du dépôt (`out/audit/`), le dépôt ne contient que des gabarits
  **vides**. Le rapport publié ne porte que des codes.
- **Aucune généralisation abusive** : « la personne en fauteuil a mis 40
  secondes » ne se dit pas ; « en une séance, avec le profil assis, la
  calibration a demandé 40 s » se dit.

## 9. Enregistrement des résultats

1. Copier `scripts/audit/feuille.tsv` dans `out/audit/` (dossier ignoré par
   git), une copie par personne : `out/audit/A1.tsv`.
2. Dans la copie, **ne garder que les cinq lignes du profil de la personne**
   (les autres sont supprimées), et renseigner le code du participant.
3. Remplir les colonnes `note`, `temps_s`, `abandon`, `erreurs` et, si besoin,
   `commentaire`. Une ligne incomplète fait échouer la synthèse : c'est
   voulu, une demi-mesure ne se compte pas.
4. Après les trois séances, produire le récapitulatif :

```sh
node scripts/audit/synthese.mjs out/audit/A1.tsv out/audit/B2.tsv out/audit/C3.tsv
```

La commande affiche un tableau Markdown (tâche × profil : temps moyen,
abandons, note moyenne). Elle **refuse** un fichier mal formé et sort en
erreur : un tableau partiel vaut mieux qu'un tableau faux.

5. Coller le tableau dans `docs/audit-rapport.md` (§ « Résultats ») et
   rédiger l'analyse.

### Le gabarit en un coup d'œil

| Colonne | Contenu | Exemple de valeur |
|---|---|---|
| `participant` | Code anonyme de la séance | `A1` |
| `profil` | `fauteuil`, `malvoyant` ou `tremblement` | `fauteuil` |
| `tache` | `melodie`, `instrument`, `calibrage`, `note`, `retard` | `melodie` |
| `note` | entier de 0 à 3 | `2` |
| `temps_s` | secondes, une décimale | `18.5` |
| `abandon` | `0` ou `1` | `0` |
| `erreurs` | entier ≥ 0 | `3` |
| `commentaire` | observation libre, sans tabulation | `a demandé de l'aide pour trouver le bouton` |

## 10. Déroulé d'une séance

| Temps | Moment |
|---|---|
| 0–10 min | Accueil, clause d'information, questions, installation du poste |
| 10–20 min | T1 jouer une mélodie, T2 changer l'instrument |
| 20–30 min | T3 calibrer, T4 lire la note en cours |
| 30–35 min | T5 trouver le retard |
| 35–40 min | Questions ouvertes |
| 40–45 min | Rappel du droit d'arrêt, dépôt de la feuille, remerciement |

## 11. Limites à écrire dans le rapport

- **Trois personnes, pas un échantillon.** Ce que l'audit révèle, ce sont des
  obstacles précis et reproductibles, pas une proportion d'utilisateurs.
- **Une séance par profil** : la première rencontre avec l'interface est
  aussi un test d'apprentissage. Si l'audit est refait, la deuxième séance
  sert à distinguer l'obstacle de l'interface de celui de la découverte.
- **L'observateur n'est pas aveugle** : il connaît l'interface et ses
  réponses Canonicales sont un biais, que la consigne de passation cherche à
  limiter sans jamais l'annuler.
- **L'audit automatique ne remplace rien** : il dit que les règles DOM sont
  respectées ; il ne dit pas que la personne aboutit. Les deux vont ensemble
  dans le rapport final.

## 12. Références

- `docs/accessibility.md` — ce que le produit promet (palette, clavier, §12.4).
- `docs/accessibility-report.md` — ce que l'audit automatique a trouvé.
- `docs/user/interface-copy.md` — les libellés que la personne va lire.
- `apps/web/src/state/profiles.ts` — les profils `seated`, `oneHand`, `tremor`.
- `docs/audit-rapport.md` — le modèle de rapport à remplir.
