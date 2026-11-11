# Kiroween 2026 — Vision-musique : cahier des charges

Document de cadrage rédigé le 11 novembre 2026 pour l'idée « Vision-musique », candidate en catégorie Frankenstein. Il suit les conventions du premier document, [kiroween-2026-cahiers-des-charges.md](kiroween-2026-cahiers-des-charges.md) (règles du concours, grille du jury, socle technique, notation des exigences), et se lit seul. Il est écrit pour être donné tel quel à Kiro comme matière première de ses specs.

Sources vérifiées le 11 novembre 2026 : la documentation du suivi des mains de MediaPipe (guide Web et fiche du modèle), la documentation de l'audio dans le navigateur, l'état de la prise en charge de Web MIDI, et les instruments du même genre déjà en ligne. Ce qui n'a pas pu être vérifié est marqué **À vérifier** et rassemblé en annexe D. Les fréquences, intervalles et durées des exemples ont été calculés ; les retards de la section 5 sont des ordres de grandeur à remplacer par des mesures ; les charges en jours sont des évaluations.

## Sommaire

- [1. En bref](#en-bref)
- [2. Fiche d'identité](#fiche)
- [3. Problème et public](#probleme)
- [4. Objectifs, non-objectifs, indicateurs](#objectifs)
- [5. Ce que l'instrument peut promettre : retard et justesse](#promesses)
- [6. Ce qui existe déjà, et l'angle](#existant)
- [7. Chaîne de traitement](#traitement)
- [8. Parcours utilisateurs](#parcours)
- [9. Exigences fonctionnelles](#exigences-f)
- [10. Exigences non fonctionnelles](#exigences-n)
- [11. Architecture technique](#architecture)
- [12. Interface et direction artistique](#interface)
- [13. Propriétés à tester, et preuve sans écoute](#proprietes)
- [14. Stratégie Kiro](#kiro)
- [15. Plan de réalisation](#plan)
- [16. Risques et parades](#risques)
- [17. Démonstration et soumission](#demo)
- [18. Recette](#recette)
- [19. Questions ouvertes](#questions)
- [Annexes — glossaire, formats de fichiers, sources, points à vérifier](#annexes)

---

<a id="en-bref"></a>

## 1. En bref

Tu lèves les mains devant ta webcam, et l'air devient un instrument. Une main choisit la hauteur, l'autre le volume ; des cordes invisibles sonnent quand tes doigts les traversent ; une boucle garde ce que tu viens de jouer pendant que tu ajoutes une voix. Rien à installer, aucun logiciel de musique à ouvrir, et aucune image ne quitte ton navigateur.

| | |
|---|---|
| Catégorie | Frankenstein |
| Chimère | La vision par ordinateur (30 images par seconde) × la synthèse sonore (48 000 échantillons par seconde) × la théorie musicale × le filtrage du signal |
| Périmètre minimal | 6 jours, plus 1,5 jour de soumission ; un périmètre réduit tient en 4 jours mais ne se distingue plus de l'existant (voir 15) |
| Prix visés | Best Frankenstein, Best Demo, prix globaux |

**Cinq décisions qui structurent tout le reste**

1. **L'idée n'est plus à prendre : il faut un angle.** Je n'ai trouvé aucun produit nommé « synthexis » sous cette orthographe. J'ai trouvé en revanche plus de dix instruments gratuits qui font déjà cela dans un navigateur, dont un très complet : huit modes de jeu, vingt-cinq sons, une boucle à six couches, l'export en audio, en MIDI et en vidéo. « Une version Web gratuite » ne distingue donc plus rien. Ce cahier retient trois angles que je n'ai vus réunis nulle part (voir 6.2) : un instrument dont chaque comportement se prouve sans l'écouter, un instrument qui est un fichier que tu peux réécrire, et un instrument qui se règle sur la portée de tes bras.
2. **La couture entre deux horloges est le cœur technique.** La caméra donne 30 positions par seconde ; le son en demande 48 000. Tout ce qui fait qu'un instrument de ce genre grésille, traîne ou reste coincé sur une note vient de cette couture. C'est là qu'est le monstre de Frankenstein, et c'est là que va le soin.
3. **Le retard est dit, mesuré, et les instruments sont conçus pour lui.** Entre le geste et le son, il s'écoule de l'ordre d'un dixième de seconde. On ne le cache pas : on l'affiche, on choisit des instruments qui le supportent, et la boucle le compense.
4. **Pas de fausse note par défaut.** Jouer juste dans le vide est très difficile ; c'est la réputation du thérémine. Par défaut, les hauteurs sont aimantées sur une gamme. Le glissé libre est un réglage.
5. **Personne n'écoute pendant la construction.** Ni l'agent de Kiro ni l'intégration continue n'émettent un son : tout se prouve par des fichiers rendus et des nombres. C'est ta règle de machine (« prouver par les logs et les fichiers, jamais à l'oreille ») devenue règle du projet, et c'est aussi le meilleur récit à faire au jury.

**Place dans le concours.** Tu écris qu'il « remplace ou complète Planchette ». Je ne connais pas le détail de Planchette, qui ne vient pas de cette session : je ne peux pas trancher à ta place. Un critère simple : si Planchette est aussi en Frankenstein, les deux se disputent le même prix de catégorie, et mieux vaut remplacer qu'ajouter. Sur la charge, tu comptes quatre à cinq jours ; j'en compte six pour une version qui se distingue, plus un jour et demi de vidéo et de texte. En quatre jours, on obtient un thérémine et une harpe corrects, c'est-à-dire ce que dix sites font déjà.

---

<a id="fiche"></a>

## 2. Fiche d'identité

| | |
|---|---|
| Nom de travail | Vision-musique. Il faut un nom anglais pour la soumission ; pistes en 6.3. **À vérifier** : disponibilité et absence de marque homonyme. |
| Trigramme des exigences | `AIR` |
| Catégorie | Frankenstein |
| Chimère | Suivi des mains par un modèle de vision (MediaPipe, 21 points par main) × moteur audio du navigateur (Web Audio) × gammes et accords × filtrage adaptatif d'un signal bruité |
| En une phrase | Une webcam transforme l'air en instrument : tes mains touchent des notes invisibles, justes par construction, sans installation. |
| Public | Curieux et enfants ; classes de musique et de physique ; musiciens qui veulent un contrôleur gestuel ; personnes qui ne peuvent pas tenir un instrument. |
| Idée centrale | Une main est un signal continu ; un instrument est une correspondance entre ce signal et un son. Si cette correspondance est un fichier, on peut la lire, la tester et la refaire. |
| Ce qui existe déjà | Le thérémine (1920) ; plus de dix instruments gestuels gratuits dans le navigateur, du jouet au studio complet (voir 6.1). |
| Ce qui est différent | La preuve sans écoute ; l'instrument en fichier ; le réglage sur la portée du joueur ; le retard affiché et compensé ; une mise en scène de séance, sans image de caméra à l'écran. |
| Prix visés | Best Frankenstein, Best Demo, prix globaux. |

---

<a id="probleme"></a>

## 3. Problème et public

**Situation de départ.** Léa a onze ans et veut « jouer du fantôme », ce son qui monte et descend dans les vieux films d'épouvante. C'est un thérémine : un instrument dont on joue sans le toucher, qui coûte plusieurs centaines d'euros et dont il est notoirement difficile de tirer une note juste. Les applications qui l'imitent demandent une installation ou un logiciel de musique. Les sites gratuits existent, mais le premier qu'elle essaie couine faux, et le second lui présente quarante réglages.

Sam, lui, joue assis, avec une amplitude de bras réduite. Tous ces instruments supposent qu'il atteint les quatre coins de l'image. La moitié des notes lui sont hors de portée.

Pourquoi le problème persiste :

- Sans rien toucher, jouer juste est très difficile : la main n'a aucun repère.
- Le retard entre le geste et le son est rarement dit, et presque jamais compensé.
- Les instruments sont figés : on ne peut ni adapter les zones à son corps, ni fabriquer le sien.
- Un instrument se règle d'habitude à l'oreille. Sans preuve écrite, chaque modification peut en casser une autre sans que personne le sache.

**Personas**

- **Léa, onze ans.** Elle veut un son de fantôme en trente secondes, et réussir une mélodie dès le premier essai.
- **Sam, portée réduite.** Il veut que tout l'instrument tienne dans la zone qu'il atteint, et pouvoir jouer d'une seule main.
- **Jules, musicien.** Il veut piloter son synthétiseur par gestes, en MIDI, et garder une boucle.
- **Mme Roche, enseignante.** Elle veut montrer en classe ce qu'est une fréquence, une octave, une gamme, avec une courbe qui bouge quand la main bouge.
- **Un juge.** Il n'a peut-être pas de webcam, ou pas envie de l'allumer. Il doit pouvoir jouer quand même.

**Usages exclus.** Ce n'est pas un instrument de scène : le retard interdit le jeu rythmique précis. L'outil ne reconnaît personne, ne conserve aucune image et n'utilise pas le microphone.

---

<a id="objectifs"></a>

## 4. Objectifs, non-objectifs, indicateurs

**Objectifs**

- O1 — Du premier clic à la première note juste en moins de trente secondes, sans rien installer.
- O2 — Impossible de jouer faux par défaut ; possible de glisser quand on le veut.
- O3 — Le retard entre geste et son est mesuré pour ce qui peut l'être, affiché, et compensé là où c'est possible.
- O4 — Chaque comportement musical se prouve par un fichier, sans écouter.
- O5 — L'instrument se règle sur le corps du joueur : portée, une main, assis.
- O6 — Rien ne sort du navigateur.

**Non-objectifs**

- Pas de percussion de précision ni de jeu « au doigt » rapide.
- Pas de studio : ni pistes, ni montage, ni mixage au-delà d'une boucle.
- Pas d'échantillons sonores : tout est synthétisé, donc aucun droit d'auteur sur les sons.
- Pas de microphone, pas de suivi du visage ni du corps entier.
- Pas de jeu à plusieurs par le réseau.
- Pas de modèle de vision maison : un modèle existant, sous licence libre.
- Pas d'application native.

**Indicateurs**

| Indicateur | Cible |
|---|---|
| Temps entre le premier clic et la première note | Moins de 30 secondes sur une connexion courante. **À vérifier** : le poids du modèle à télécharger |
| Notes hors gamme en mode aimanté | Zéro, garanti par la propriété AIR-P-05 |
| Notes restées coincées après la sortie des mains | Zéro, garanti par AIR-P-09 |
| Images analysées par seconde | Au moins 25 sur un portable courant |
| Part mesurable du retard (analyse, traitement, sortie audio) | Affichée ; cible sous 60 ms en sortie filaire |
| Retard total estimé | Affiché avec ses composantes ; de l'ordre de 100 ms |
| Requêtes réseau après le chargement | Zéro |
| Tests qui émettent un son | Zéro |
| Niveau de crête en sortie | Jamais au-dessus de −1 dB par rapport au maximum, garanti par AIR-P-13 |

---

<a id="promesses"></a>

## 5. Ce que l'instrument peut promettre : retard et justesse

### 5.1 D'où vient le retard

| Étape | Ordre de grandeur | Mesurable dans le navigateur ? |
|---|---|---|
| Caméra : exposition, lecture du capteur, compression, transport | 30 à 70 ms | Non : estimé |
| Attente de l'image suivante | 0 à 33 ms à 30 images par seconde, 17 en moyenne ; 0 à 17 ms à 60 | Oui : intervalle entre images |
| Analyse des mains | 5 à 25 ms. Google annonce 12 ms sur processeur graphique et 17 ms sur processeur, pour un téléphone Pixel 6 | Oui |
| Filtrage, gestes, correspondance | 1 à 5 ms | Oui |
| Sortie audio | 10 à 45 ms en filaire ; 150 à 250 ms de plus avec un casque sans fil | En partie : le navigateur déclare deux valeurs, `baseLatency` et `outputLatency` |
| **Total** | **De 46 à 178 ms ; environ 105 ms dans un cas courant, en filaire** | |

Hormis les chiffres de Google, ce tableau réunit des ordres de grandeur, pas des mesures : il est à remplacer par les valeurs relevées sur tes machines pendant le lot A1.

Pour se représenter cent millisecondes : le son parcourt 34 mètres dans ce temps. Un organiste dont les tuyaux sont à 34 mètres de la console joue avec ce retard. On s'y fait pour des sons tenus ; on ne s'y fait pas pour frapper en rythme.

### 5.2 Conséquences de conception

- **Des instruments qui supportent le retard.** D'abord les sons tenus et continus (thérémine, nappes). Ensuite les sons pincés (harpe), où un dixième de seconde s'entend peu. La percussion n'existe qu'en option, et calée sur une grille.
- **Le retard est affiché.** L'écran dit : « analyse 12 ms, traitement 2 ms, sortie audio 21 ms ; caméra non mesurable, estimée entre 30 et 70 ms ». Jamais les mots « temps réel » ni « instantané ».
- **Le casque sans fil est signalé.** Si la sortie audio déclarée dépasse 100 ms, l'écran conseille une sortie filaire.
- **La boucle compense.** Ce que tu enregistres dans la boucle est avancé du retard estimé, pour retomber sur le temps (7.10).
- **Les déclenchements ne paient pas le lissage.** Les attaques sont détectées sur un signal à peine filtré ; seuls les réglages continus sont lissés (7.5).

### 5.3 Justesse

Le thérémine de 7.8 couvre trois octaves, du la à 110 Hz au la à 880 Hz, sur la largeur de la zone de jeu. Si cette zone correspond à 80 cm de déplacement du bras, un demi-ton tient dans 2,2 cm. Un tremblement résiduel de 0,5 % de la largeur déplace la note de 18 centièmes de demi-ton, ce qui s'entend. D'où deux choix :

- par défaut, la hauteur est **aimantée** sur les notes d'une gamme. Avec une gamme à cinq notes, chaque note occupe 5 cm : on vise large ;
- une **marge** empêche la note de sauter quand la main hésite sur une frontière (7.6).

Le glissé continu reste disponible, parce que c'est lui qui fait le son de fantôme : un curseur « aimant » va de 0 (glissé pur) à 1 (notes franches).

### 5.4 Vocabulaire imposé

| À écrire | À ne jamais écrire |
|---|---|
| « retard estimé », « retard mesuré (analyse et audio) » | « temps réel », « instantané », « zéro latence » |
| « aimanté sur la gamme » | « toujours juste » (le glissé libre existe) |
| « rien ne quitte ton navigateur » | « sécurisé », « anonyme » sans dire pourquoi |
| « sons synthétisés » | « sons d'instruments réels » |

Un contrôle automatique vérifie ces règles sur les libellés (voir 14.3).

---

<a id="existant"></a>

## 6. Ce qui existe déjà, et l'angle

### 6.1 Instruments voisins

| Instrument | Ce qu'il fait | Ce que ça change pour nous |
|---|---|---|
| **Hand Tracking Instrument**, de Jasper Bernaers | Huit modes : harpe, clavier, thérémine, pads de batterie, chef d'accords, groupe d'accompagnement, arpégiateur, boucle à six couches. Douze gammes, vingt-cinq sons synthétisés par quatre méthodes. Export en vidéo, en audio, en MIDI, en pistes séparées. Entrée et sortie MIDI. Gratuit, sans compte. | **Le plus complet.** Inutile de vouloir le dépasser en nombre de fonctions en six jours. |
| **HandSynth** | Accords choisis par le nombre de doigts, expression par l'autre main, thérémine à part, sortie MIDI, enregistrement audio. Affiche le temps d'analyse et le retard audio. Se joue aussi à la souris, au toucher et au clavier. | L'affichage du retard et le jeu sans caméra existent déjà : ce sont des attendus, plus des atouts. |
| **Les « Gesture Synth »** (au moins sept sites et plusieurs dépôts libres) | Des accords déclenchés par des gestes, avec MediaPipe et une bibliothèque audio. | Le genre est installé, avec ses codes. |
| **Neo Theremin, webcam-theremin, Handophone** et d'autres | Des thérémines et leurs variantes. | Le thérémine seul ne suffit pas. |
| **HandSonor** (recherche, 2013) | Une interface de contrôle musical par vision, personnalisable. | L'idée d'une correspondance réglable a une antériorité dans la recherche. |
| **Le thérémine** (1920) | Deux antennes, une main pour la hauteur, une pour le volume, sans contact. | L'ancêtre, et la voix des fantômes au cinéma : c'est le lien avec la saison. |

Si « synthexis » désigne un produit précis, donne-moi son adresse : le positionnement peut changer.

### 6.2 L'angle : quatre choses que je n'ai pas vues réunies

1. **La preuve sans écoute.** On enregistre des gestes (les positions des points de la main, jamais l'image), on les rejoue à l'identique dans toute la chaîne, on rend le son dans un fichier sans passer par un haut-parleur, et on mesure : quelles notes, à quelles fréquences, à quels instants, à quel niveau. Chaque comportement musical devient un test. L'instrument est construit par un agent qui n'a pas le droit d'entendre.
2. **L'instrument est un fichier.** Zones, gamme, étendue, son, correspondances entre gestes et réglages : tout tient dans un fichier lisible, validé par un schéma, partageable par un lien. Pendant la construction, Kiro écrit six instruments à partir de leurs descriptions ; ensuite, n'importe qui peut en modifier un.
3. **Le réglage sur la portée.** Avant de jouer, tu montres jusqu'où vont tes mains ; toute l'étendue de l'instrument se loge dans cette zone. Un mode à une main et un mode « maintien » complètent.
4. **Le retard dit et compensé.** Affiché par composante, et rattrapé dans la boucle.

Il faut le dire nettement dans la soumission : aucun de ces points n'est hors de portée des instruments existants. Le pari est leur réunion, la qualité de la couture, et le récit de construction avec Kiro. Pour le prix de la meilleure démonstration, l'atout est une pièce inquiétante montée en boucle en une minute, sans coupe.

### 6.3 Le nom

« Vision-musique » décrit le projet mais ne se retient pas, et il faut un nom anglais. Trois pistes, toutes **à vérifier** :

| Piste | Pour | Contre |
|---|---|---|
| **Thin Air** | Dit exactement d'où sort la musique ; simple à prononcer | Expression courante, donc difficile à trouver dans un moteur de recherche |
| **Phantom Hands** | Colle à la saison et à la mise en scène de 12.3 | Un peu long |
| **Séance** | Un seul mot, la table qui parle, les mains au-dessus | L'accent pose problème dans les adresses ; mot très employé |

À éviter : tout nom de thérémine du commerce, et le mot « real-time ».

---

<a id="traitement"></a>

## 7. Chaîne de traitement

### 7.1 Vue d'ensemble

```text
 caméra ─► image ─► mains ─► repère ─► filtrage ─► mesures ─► gestes ─► instrument ─► voix ─► limiteur ─► sortie
            30/s    21 points  de jeu   adaptatif   position   pince,    (un fichier)  synthèse
                    × 2 mains  miroir,              pince      entrée,   gamme, zones
                               portée               ouverture  traversée
                        │                           vitesse                  │
                        ▼                                                    ▼
                  prises (7.11)                                         boucle (7.10)

 horloge des images, 30 par seconde ───────────►│◄─────────── horloge du son, 48 000 par seconde
                                          la couture (7.9)
```

Tout ce qui est à gauche de la couture est du calcul pur, sans navigateur : il se teste dans Node, à partir de prises enregistrées. Ce qui est à droite se rend dans un fichier, sans haut-parleur.

### 7.2 Capture

- La caméra est demandée avec une image de 640 × 480, 60 images par seconde souhaitées, 24 au minimum, caméra frontale, **sans audio**. Une image plus grande coûte du temps sans rien apporter : le modèle travaille sur des vignettes d'environ 200 points de côté.
- Chaque image nouvelle est analysée une fois, et une seule. Le navigateur prévient à chaque image vidéo présentée (`requestVideoFrameCallback`) ; à défaut, on surveille le temps de la vidéo à chaque rafraîchissement de l'écran. **À vérifier** : la présence de cette fonction dans les trois navigateurs visés.
- La caméra ne démarre qu'après un clic sur « Start ». Ce même clic ouvre le moteur audio : les navigateurs refusent tout son avant un geste de l'utilisateur.
- Caméra refusée ou absente : l'instrument se joue au pointeur (souris ou doigt, une main virtuelle) et au clavier, avec le même moteur.
- Si les mains ne sont pas reconnues pendant plus de trois secondes alors que l'image change, l'écran conseille plus de lumière ou plus de recul.

### 7.3 Détection des mains

- Paquet `@mediapipe/tasks-vision`, tâche Hand Landmarker, modèle `hand_landmarker.task`. Le fichier réunit deux modèles : l'un trouve les paumes, l'autre place les points. D'une image à la suite, le second réutilise le cadre précédent ; la recherche de paume ne repart que si la main est perdue.
- Réglages : mode vidéo, deux mains, seuils de confiance à leur valeur par défaut (0,5), calcul sur processeur graphique avec repli sur processeur.
- **Le modèle et ses fichiers d'exécution sont servis par le site lui-même**, pas par un service tiers : rien ne dépend d'un tiers, et le site fonctionne hors ligne après la première visite.
- L'appel `detectForVideo(video, instant)` est synchrone : il occupe la page le temps de l'analyse. Périmètre minimal : sur le fil principal, avec mesure du temps. Le déport dans un fil d'exécution séparé est souhaitable.
- Résultat, pour chaque main : 21 points en coordonnées d'image (de 0 à 1 en largeur et en hauteur, plus une profondeur relative au poignet), les mêmes en mètres autour du centre de la main, et un côté (gauche ou droite) avec un score.

| Points | Nom | Usage ici |
|---|---|---|
| 0 | Poignet | Échelle de la paume |
| 4 | Bout du pouce | Pince |
| 8 | Bout de l'index | Pointeur fin, pince |
| 5, 9, 13, 17 | Base de l'index, du majeur, de l'annulaire, de l'auriculaire | Centre et échelle de la paume |
| 12, 16, 20 | Bouts du majeur, de l'annulaire, de l'auriculaire | Ouverture de la main |

**Le piège du côté.** Le côté annoncé dépend de ce que l'image soit ou non retournée en miroir. La convention se fixe par un test : une prise où seule la main gauche est levée doit donner « gauche ». **À vérifier** sur un premier essai réel.

**Rôles.** Une main « de hauteur » et une main « de volume », attribuées d'après le côté. Une fois attribué, un rôle suit la main par continuité (la paume la plus proche de sa position précédente) et ne change pas tant qu'elle n'a pas disparu plus d'une demi-seconde : deux mains qui se croisent n'échangent pas leurs rôles. Un réglage « gaucher » les inverse.

### 7.4 Repère de jeu et calibration

- **Miroir.** L'affichage est en miroir, et l'abscisse est retournée : bouger la main droite vers la droite déplace son repère vers la droite.
- **Proportions.** Les distances se calculent après correction du rapport largeur sur hauteur de l'image.
- **Pointeur.** Le bout de l'index pour les gestes fins (cordes), le centre de la paume pour les gestes amples (thérémine). Le centre de la paume est la moyenne des points 0, 5, 9, 13 et 17. Le choix est écrit dans le fichier de l'instrument.
- **Échelle de la paume.** La distance du poignet à la base du majeur, notée `s`. Elle grandit quand la main s'approche : diviser par `s` rend la pince et l'ouverture indépendantes de la distance à la caméra.
- **Zone de jeu.** Un rectangle dans l'image. La position d'une main y devient deux nombres de 0 à 1 : `u` de gauche à droite, `v` de bas en haut. Hors du rectangle, les valeurs sont bornées et un indicateur « bord » s'allume.

**Calibration sur la portée.** L'écran demande : « tends les bras aussi loin que c'est confortable, en haut, en bas, à gauche, à droite ». Pendant huit secondes, les positions des paumes sont relevées. Le rectangle retenu va du 5ᵉ au 95ᵉ centile sur chaque axe, élargi de 5 %. S'il fait moins de 20 % de l'image sur un côté, l'écran propose de recommencer ou de garder la zone par défaut (les 80 % centraux). Le rectangle est gardé sur l'appareil.

### 7.5 Filtrage

Les points tremblent d'une image à l'autre, même main immobile. Lisser fort supprime le tremblement mais fait traîner le geste ; lisser peu fait l'inverse. Le filtre « One Euro » (Casiez, Roussel et Vogel, 2012) règle ce compromis en lissant fort quand la main est lente, et peu quand elle est rapide.

```text
vitesse     d   = (x − x_précédent) / Te
vitesse lissée  d̂ = lissage(d, coupure fc_d)
coupure     fc  = fc_min + β · |d̂|
sortie      x̂   = α · x + (1 − α) · x̂_précédent      avec  α = 1 / (1 + 1 / (2π · fc · Te))
```

`Te` est l'écart réel entre deux images, lu sur leurs horodatages. Valeurs de départ, en unités de la zone de jeu : `fc_min` = 1,5 Hz, `β` = 5, `fc_d` = 1 Hz.

| Vitesse de la main | Coupure | Constante de temps | α à 30 images par seconde |
|---|---|---|---|
| Immobile | 1,5 Hz | 106 ms | 0,24 |
| Une largeur de zone par seconde | 6,5 Hz | 24 ms | 0,58 |
| Deux largeurs par seconde | 11,5 Hz | 14 ms | 0,71 |

Ces valeurs sont **à régler** sur des prises réelles. Deux canaux sortent du filtrage :

- un canal **lissé**, pour les réglages continus (hauteur, volume, timbre) ;
- un canal **vif**, à coupure fixe de 6 Hz, pour les déclenchements : une attaque ne doit pas attendre le lissage.

**Main perdue.** Si une main n'est plus vue, ses dernières valeurs sont tenues 150 ms. Au-delà, l'événement « sortie de main » relâche ses notes.

### 7.6 Mesures et gestes

| Mesure | Définition |
|---|---|
| `u`, `v` | Position du pointeur dans la zone de jeu, de 0 à 1 |
| `pinch` | Distance pouce-index divisée par `s` : proche de 0 doigts joints, 1 et plus main ouverte |
| `open` | Moyenne des distances des quatre bouts de doigts au poignet, divisée par `s`, ramenée entre 0 (poing) et 1 (main à plat) |
| `speedU`, `speedV` | Vitesses, en largeurs de zone par seconde, sur le canal vif |
| `present` | Main vue, ou tenue pendant le délai de grâce |

Chaque geste a deux seuils, un pour s'enclencher, un pour se relâcher. Sans cet écart, une main hésitante sur une frontière ferait basculer la note dix fois par seconde.

| Geste | S'enclenche quand | Se relâche quand |
|---|---|---|
| Pince | `pinch` passe sous 0,25 | `pinch` repasse au-dessus de 0,40 |
| Poing | `open` passe sous 0,20 | `open` repasse au-dessus de 0,35 |
| Entrée dans une zone | Le pointeur est dans la zone réduite de 10 % | Il est hors de la zone agrandie de 10 % |
| Traversée d'une corde | Le pointeur change de côté entre deux images, à plus de 0,15 largeur par seconde | Réarmement après 80 ms |
| Changement de note aimantée | La hauteur dépasse la frontière entre deux notes voisines de 15 % de leur écart | — |
| Sortie de main | Absente depuis plus de 150 ms | — |

La force d'un pincement de corde vient de la vitesse : `vitesse / 3`, bornée entre 0,1 et 1.

### 7.7 Musique : hauteurs, gammes, volume

- **Numéro de note et fréquence.** `f = 440 × 2^((m − 69) / 12)`, où `m` est le numéro MIDI. Un demi-ton multiplie la fréquence par 1,05946 ; une octave la double.
- **Gamme.** Une liste d'écarts en demi-tons dans l'octave. Le degré `k` donne la note `fondamentale + 12 × ⌊k / n⌋ + gamme[k mod n]`.

| Gamme | Écarts |
|---|---|
| Pentatonique majeure | 0, 2, 4, 7, 9 |
| Pentatonique mineure | 0, 3, 5, 7, 10 |
| Mineure naturelle | 0, 2, 3, 5, 7, 8, 10 |
| Mineure harmonique | 0, 2, 3, 5, 7, 8, 11 |
| Mineure hongroise | 0, 2, 3, 6, 7, 8, 11 |
| Majeure | 0, 2, 4, 5, 7, 9, 11 |
| Par tons | 0, 2, 4, 6, 8, 10 |
| Chromatique | 0 à 11 |

La gamme de saison est ré mineur harmonique : ré 146,83 Hz, mi 164,81, fa 174,61, sol 196,00, la 220,00, si bémol 233,08, do dièse 277,18, ré 293,66.

- **Hauteur continue.** `m(u) = m_bas + (m_haut − m_bas) × u`. La fréquence croît donc de façon exponentielle avec la position : une même distance donne partout le même intervalle. Du la à 110 Hz au la à 880 Hz : un quart de la largeur donne 185,00 Hz, la moitié 311,13 Hz, les trois quarts 523,25 Hz.
- **Aimant.** Un réglage `a` de 0 à 1 : `m' = m + a × (q(m) − m)`, où `q(m)` est la note de la gamme retenue par la règle de 7.6. À 1, des notes franches ; à 0, un glissé pur ; entre les deux, un glissé qui colle aux notes.
- **Volume.** L'oreille entend des rapports, pas des différences : le volume suit une échelle en décibels, `dB = −48 × (1 − v)`. En haut de la zone, 0 dB ; aux trois quarts, −12 dB (un quart de l'amplitude) ; à mi-hauteur, −24 dB ; sous 5 % de la hauteur, silence.

### 7.8 Les instruments

Un instrument est un fichier (format en annexe B). Six sont prévus.

| Instrument | Priorité | Geste | Son |
|---|---|---|---|
| **Phantom** (thérémine) | I | La main de hauteur choisit la note par `u`, de 110 à 880 Hz, aimant à 0,6, ré mineur harmonique. La main de volume règle le niveau par `v`. Pincer la main de hauteur ajoute du vibrato (jusqu'à 40 centièmes de demi-ton, 5,5 fois par seconde). Fermer le poing de la main de volume coupe le son. À une main : `u` pour la hauteur, `open` pour le volume | Une sinusoïde et un peu d'harmonique 2 ; attaque de 60 ms ; glissement de 30 ms entre deux notes |
| **Harp** (cordes pincées) | I | Seize cordes verticales, ré mineur pentatonique sur trois octaves, du ré à 146,83 Hz au ré à 1 174,66 Hz. Une corde sonne quand le bout de l'index la traverse ; la vitesse donne la force. Pincer étouffe | Corde pincée synthétique (7.9) |
| **Choir** (nappes) | I | Huit zones. Une main posée dans une zone tient une note ; deux mains, deux notes. L'ouverture de la main règle la brillance. En mode maintien, rester 400 ms dans une zone verrouille la note jusqu'au prochain passage | Dents de scie désaccordées et filtre ; attaque de 300 ms, extinction de 800 ms |
| **Bells** (cloches) | S | Des zones frappées par un passage vers le bas | Modulation de fréquence, longue résonance |
| **Drone** (bourdon) | S | La hauteur d'une main choisit une note grave parmi quatre, tenue | Deux oscillateurs graves |
| **Grid drums** (percussions) | O | Quatre zones ; les frappes sont replacées sur la grille de la boucle, seule façon pour la percussion de survivre au retard | Bruit et sinusoïdes brèves |

### 7.9 La couture : de 30 gestes à 48 000 échantillons par seconde

Trois règles, sans exception.

1. **On ne fixe jamais directement un réglage audio pendant qu'une voix sonne.** Chaque mise à jour passe par une rampe : `param.setTargetAtTime(valeur, instant, τ)`, avec `τ` de 20 ms. Sans cela, le réglage avance par marches, trente fois par seconde, et le son grésille.
2. **Tout événement est daté sur l'horloge du son.** Une note porte un instant, `currentTime` du moteur audio plus 5 ms d'avance. La boucle programme ses notes par avance : un minuteur passe toutes les 25 ms et programme les 100 ms qui viennent, parce que les minuteurs du navigateur ne sont pas assez précis pour le rythme.
3. **Les voix sont bornées et toujours relâchées.** Huit voix au plus ; au-delà, la plus ancienne est reprise. Si aucune image n'a été analysée depuis 300 ms (onglet masqué, caméra figée), toutes les voix sont relâchées.

```text
 voix 1 ┐
 voix 2 ┼─► mélange ─► réverbération ─► gain général ─► limiteur ─► sortie
  …     ┘              (réponse calculée)   (−12 dB)     (plafond −1 dB)
```

- **Réverbération.** Par convolution, avec une réponse calculée au démarrage (un bruit qui s'éteint). Aucun fichier sonore n'est embarqué.
- **Limiteur.** Un compresseur réglé en limiteur, puis un plafond. Le plafond se vérifie sur chaque rendu de test (AIR-P-13).
- **Corde pincée.** L'algorithme de Karplus-Strong : une ligne à retard bouclée dont la longueur fixe la note, soit 326,9 échantillons pour le ré à 146,83 Hz à 48 000 échantillons par seconde. Il est écrit dans un module audio à part (AudioWorklet), parce que dans le graphe ordinaire du navigateur un retard pris dans une boucle ne peut pas descendre sous un bloc de 128 échantillons, soit 2,67 ms : aucune note au-dessus de 375 Hz ne serait possible.
- **Moteur audio.** Ouvert avec la consigne de retard « interactif ». Le retard affiché est la somme des deux valeurs déclarées par le navigateur ; la seconde, `outputLatency`, n'existe que dans les navigateurs récents : à défaut, l'écran dit que la mesure est partielle.

### 7.10 La boucle

- **Mesure.** 90 battements par minute par défaut (de 60 à 140), quatre temps, sur une, deux ou quatre mesures. À 90, une mesure dure 2,667 s, quatre mesures 10,67 s, une double croche 166,7 ms.
- **Ce qui est enregistré.** Des événements (début et fin de note, force, instrument) et les courbes des réglages continus à la cadence des images. Jamais de son.
- **Compensation du retard.** Les instants enregistrés sont avancés du retard estimé : la part mesurée, plus une valeur pour la caméra (50 ms par défaut, réglable de 0 à 120). Sans cela, avec 105 ms de retard, chaque note tombe en retard de 63 % d'une double croche, et la boucle boite.
- **Calage.** Aucun, à la croche ou à la double croche, avec une force de 0 à 100 %.
- **Couches.** Six au plus ; retirer la dernière ; couper une couche ; tout effacer.
- **Métronome.** Visuel par défaut ; un clic sonore en option.
- **Exports.** La session en JSON ; un fichier audio WAV rendu par le moteur hors ligne, le même que celui des tests, donc sans capture en direct ; un fichier MIDI à une piste par couche (souhaitable) ; une vidéo de la scène (optionnelle).

### 7.11 Les prises

Une prise est l'enregistrement du flux des points de la main, **jamais de l'image**.

- Contenu : la cadence, puis pour chaque image un instant et, par main, le côté, le score et les 21 points.
- Poids : 2 mains × 21 points × 3 coordonnées font 126 nombres par image, soit 3 780 par seconde à 30 images. En JSON brut, environ 26 Ko par seconde ; en entiers de 16 bits, 7,6 Ko par seconde. Dix secondes pèsent moins de 100 Ko une fois tassées.
- Usages : les tests (une prise rejouée donne toujours les mêmes événements) ; les rapports de défaut (« envoie-moi la prise ») ; le réglage du filtre ; et le **fantôme**, qui joue une prise tout seul quand personne n'est devant la caméra.
- Prises de synthèse : des générateurs fabriquent une main qui avance à vitesse constante, une main qui tremble avec une amplitude donnée, une main qui traverse des cordes, une main qui sort. Ce sont elles qui nourrissent les propriétés de la section 13.
- Les points d'une main ne sont pas une image, mais restent une donnée corporelle : une prise n'est enregistrée que sur demande, et reste sur l'appareil.

### 7.12 Sortie MIDI (souhaitable)

- Web MIDI existe dans Chrome, Edge et Opera ; Safari ne le propose pas. La fonction est détectée, et masquée quand elle manque.
- Notes avec leur force ; glissé par la molette de hauteur ; volume et brillance par des contrôleurs continus, limités à cent messages par seconde.
- En sortie MIDI, l'aimant est forcé à 1 tant que l'utilisateur n'a pas déclaré l'étendue de la molette de son synthétiseur : un glissé de trois octaves ne tient pas dans le réglage courant de deux demi-tons.

### 7.13 Réglages

| Réglage | Défaut | Réglage | Défaut |
|---|---|---|---|
| `frameRateIdeal` | 60 | `paramTauMs` | 20 |
| `numHands` | 2 | `lookaheadMs` | 5 |
| `graceMs` | 150 | `maxVoices` | 8 |
| `fcMin`, `beta`, `fcD` | 1,5 Hz, 5, 1 Hz | `masterGainDb` | −12 |
| `fcTrigger` | 6 Hz | `ceilingDb` | −1 |
| `pinchOn`, `pinchOff` | 0,25, 0,40 | `cameraLatencyMs` | 50 |
| `fistOn`, `fistOff` | 0,20, 0,35 | `tempo` | 90 |
| `zoneMargin` | 10 % | `loopBars` | 4 |
| `noteHysteresis` | 15 % | `dwellMs` | 400 |
| `stringRearmMs` | 80 | `wirelessWarnMs` | 100 |
| `minPluckSpeed` | 0,15 | `stallReleaseMs` | 300 |

### 7.14 Exemples chiffrés

**Thérémine.** Instrument Phantom, étendue de 110 à 880 Hz (notes 45 à 81), ré mineur harmonique, aimant à 1. Une prise de synthèse de trois secondes : la main de hauteur avance à vitesse constante de `u` = 0,30 à `u` = 0,60 ; la main de volume reste à `v` = 0,75.

La hauteur continue va de la note 55,8 à la note 66,6. Chaque changement se produit quand elle dépasse le milieu entre deux notes voisines de la gamme, plus 15 % de leur écart.

| Passage | Seuil (note) | Position `u` | Instant | Fréquence atteinte |
|---|---|---|---|---|
| Départ sur sol | — | 0,300 | 0 s | 196,00 Hz |
| sol → la | 56,30 | 0,314 | 0,139 s | 220,00 Hz |
| la → si bémol | 57,65 | 0,351 | 0,514 s | 233,08 Hz |
| si bémol → do dièse | 59,95 | 0,415 | 1,153 s | 277,18 Hz |
| do dièse → ré | 61,65 | 0,463 | 1,625 s | 293,66 Hz |
| ré → mi | 63,30 | 0,508 | 2,083 s | 329,63 Hz |
| mi → fa | 64,65 | 0,546 | 2,458 s | 349,23 Hz |
| fa → sol | 66,30 | 0,592 | 2,917 s | 392,00 Hz |

Huit notes, toutes dans la gamme, dans l'ordre. Ces instants sont ceux du signal brut. Le filtrage les retarde : à cette vitesse la coupure vaut 2 Hz, soit une traîne d'environ 80 ms. Le test compare donc la liste des notes exactement, et les instants à une image près par rapport à l'implémentation de référence.

Le volume : `v` = 0,75 donne −12 dB. Le rendu hors ligne fait 144 000 échantillons. On y vérifie que chaque palier est à sa fréquence à 5 centièmes de demi-ton près (0,57 Hz pour le sol à 196 Hz), que la crête ne dépasse pas −1 dB, et qu'il ne reste aucun son 800 ms après la sortie des mains.

**Harpe.** Seize cordes ; la corde `i` est à `u = (i + 0,5) / 16`. Un index passe de `u` = 0,20 à `u` = 0,45 en une demi-seconde.

| Corde | Position | Instant | Note | Fréquence |
|---|---|---|---|---|
| 3 | 0,219 | 0,038 s | la | 220,00 Hz |
| 4 | 0,281 | 0,163 s | do | 261,63 Hz |
| 5 | 0,344 | 0,288 s | ré | 293,66 Hz |
| 6 | 0,406 | 0,413 s | fa | 349,23 Hz |

Quatre notes, espacées de 125 ms, de force 0,17 (une vitesse de 0,5 largeur par seconde, divisée par 3). Le même geste fait deux fois plus vite donne les mêmes quatre notes, deux fois plus rapprochées et deux fois plus fortes. Un geste qui s'arrête pile sur une corde et repart en arrière ne la fait sonner qu'une fois.

---

<a id="parcours"></a>

## 8. Parcours utilisateurs

| N° | Qui | Parcours | Résultat attendu |
|---|---|---|---|
| P1 | Léa | Ouvre l'adresse, clique « Start », autorise la caméra, lève les mains | Deux mains fantômes à l'écran ; première note juste en moins de trente secondes |
| P2 | Un juge sans caméra | Clique « Play without a camera » | La souris fait une main ; le clavier joue les notes ; tout le reste est identique |
| P3 | Sam | Lance la calibration, tend les bras selon sa portée, choisit « une main » et « maintien » | Tout l'instrument tient dans sa zone ; les notes se verrouillent sans tenir la pose |
| P4 | Jules | Lance une boucle de quatre mesures : un bourdon, un arpège de harpe, une mélodie au thérémine ; exporte | Trois couches calées sur le temps ; un fichier audio et un fichier MIDI |
| P5 | Mme Roche | Active « Show the physics » | La fréquence, le nom de la note et la courbe du son s'affichent ; monter d'une octave double la fréquence |
| P6 | N'importe qui | Refuse la caméra, ou joue dans le noir, ou sort les mains du cadre | Un message clair à chaque fois ; aucune note coincée |
| P7 | N'importe qui | Joue avec un casque sans fil | L'écran signale le retard et conseille une sortie filaire |
| P8 | Un curieux | Duplique Harp, passe à douze cordes en gamme par tons, copie le lien | Le lien ouvre son instrument chez quelqu'un d'autre |
| P9 | Un testeur | Enregistre une prise de cinq secondes et la joint à son rapport | Le défaut se rejoue à l'identique sur une autre machine |
| P10 | L'agent de Kiro | Rend une prise avec un instrument et lit la liste des notes obtenues | Il vérifie son travail sans émettre un son (voir 14.4) |
| P11 | Personne | L'écran reste vide vingt secondes après un premier démarrage | Le fantôme joue une prise à faible volume ; il s'arrête dès qu'une main paraît |

---

<a id="exigences-f"></a>

## 9. Exigences fonctionnelles

Priorités : **I** indispensable (périmètre minimal), **S** souhaitable, **O** optionnel, **X** exclu de cette édition. Critères en notation EARS.

**Démarrage et capture**

- **AIR-F-01 (I) — Démarrage.** QUAND l'utilisateur clique « Start », le système DOIT demander la caméra, sans audio, et ouvrir le moteur audio. Avant ce clic, le système NE DOIT ni activer la caméra ni émettre un son.
- **AIR-F-02 (I) — Sans caméra.** SI la caméra est refusée ou absente, ALORS le système DOIT proposer le jeu au pointeur et au clavier, avec le même moteur.
- **AIR-F-03 (I) — Une image, une analyse.** Le système DOIT analyser chaque nouvelle image une fois et une seule, avec son horodatage.
- **AIR-F-04 (I) — Deux mains.** Le système DOIT suivre deux mains, leur attribuer un rôle, et conserver ce rôle par continuité tant que la main n'a pas disparu plus d'une demi-seconde.
- **AIR-F-05 (I) — Miroir.** Le système DOIT afficher et interpréter les mains en miroir.
- **AIR-F-06 (I) — Conseils.** SI aucune main n'est reconnue pendant trois secondes alors que l'image change, ALORS le système DOIT conseiller plus de lumière ou plus de recul.
- **AIR-F-07 (S) — Analyse déportée.** Le système DOIT pouvoir exécuter l'analyse hors du fil principal de la page.

**Repère et calibration**

- **AIR-F-08 (I) — Zone par défaut.** Sans calibration, la zone de jeu DOIT être les 80 % centraux de l'image.
- **AIR-F-09 (I) — Calibration.** QUAND l'utilisateur lance la calibration, le système DOIT relever la portée de ses mains selon 7.4, en déduire la zone de jeu, la conserver sur l'appareil, et permettre de la refaire ou de l'annuler.
- **AIR-F-10 (I) — Une main.** Chaque instrument indispensable DOIT être jouable d'une seule main.
- **AIR-F-11 (S) — Gaucher.** Un réglage DOIT inverser les rôles des mains.
- **AIR-F-12 (S) — Maintien.** OÙ le mode maintien est actif, rester 400 ms dans une zone DOIT verrouiller sa note jusqu'au prochain passage.

**Filtrage et gestes**

- **AIR-F-13 (I) — Filtrage.** Le système DOIT filtrer chaque coordonnée selon 7.5 et fournir un canal lissé et un canal vif.
- **AIR-F-14 (I) — Deux seuils.** Chaque geste de 7.6 DOIT s'enclencher et se relâcher à des seuils distincts.
- **AIR-F-15 (I) — Main perdue.** QUAND une main n'est plus vue, le système DOIT tenir ses valeurs 150 ms, puis relâcher ses notes.
- **AIR-F-16 (I) — Aucune note coincée.** SI aucune image n'a été analysée depuis 300 ms, ou si l'onglet est masqué, ALORS le système DOIT relâcher toutes les voix.
- **AIR-F-17 (I) — Une traversée, une note.** Une traversée de corde DOIT produire un déclenchement et un seul.

**Musique**

- **AIR-F-18 (I) — Gammes.** Le système DOIT proposer les gammes de 7.7, le choix de la fondamentale et de l'étendue.
- **AIR-F-19 (I) — Aimant.** Le système DOIT appliquer l'aimant de 7.7, réglable de 0 à 1, avec une valeur par défaut par instrument.
- **AIR-F-20 (I) — Volume.** Le volume DOIT suivre l'échelle en décibels de 7.7.
- **AIR-F-21 (I) — Trois instruments.** Le système DOIT livrer Phantom, Harp et Choir, tels que décrits en 7.8.
- **AIR-F-22 (S) — Deux de plus.** Le système DOIT livrer Bells et Drone.
- **AIR-F-23 (O) — Percussions.** Le système DOIT livrer Grid drums, dont les frappes sont replacées sur la grille de la boucle.
- **AIR-F-24 (I) — Changement d'instrument.** QUAND l'utilisateur change d'instrument, les voix en cours DOIVENT s'éteindre en fondu, sans claquement.

**Son**

- **AIR-F-25 (I) — Synthèse seule.** Tous les sons DOIVENT être synthétisés. Le système NE DOIT embarquer aucun fichier sonore.
- **AIR-F-26 (I) — Rampes.** Toute mise à jour d'un réglage continu DOIT passer par une rampe.
- **AIR-F-27 (I) — Voix bornées.** Le système NE DOIT jamais faire sonner plus de `maxVoices` voix ; au-delà, la plus ancienne est reprise.
- **AIR-F-28 (I) — Plafond.** La sortie DOIT passer par un limiteur et ne jamais dépasser le plafond de −1 dB. Le volume général DOIT être réglable, à −12 dB par défaut.
- **AIR-F-29 (I) — Corde pincée.** La corde pincée DOIT être synthétisée dans un module audio dédié, selon 7.9.
- **AIR-F-30 (S) — Réverbération.** Le système DOIT offrir une réverbération calculée, réglable et désactivable.

**Retard**

- **AIR-F-31 (I) — Affichage.** Le système DOIT afficher le retard par composante, en distinguant ce qui est mesuré de ce qui est estimé.
- **AIR-F-32 (I) — Sortie sans fil.** SI la sortie audio déclarée dépasse 100 ms, ALORS le système DOIT le signaler et conseiller une sortie filaire.
- **AIR-F-33 (I) — Vocabulaire.** Les libellés DOIVENT respecter le tableau de 5.4.

**Boucle et exports**

- **AIR-F-34 (I) — Boucle.** Le système DOIT enregistrer et rejouer une boucle d'une, deux ou quatre mesures, au tempo choisi, sur six couches au plus.
- **AIR-F-35 (I) — Compensation.** Le système DOIT avancer les événements enregistrés du retard estimé, selon 7.10.
- **AIR-F-36 (I) — Couches.** Le système DOIT permettre de retirer la dernière couche, d'en couper une et de tout effacer.
- **AIR-F-37 (S) — Calage.** Le système DOIT permettre de caler les événements à la croche ou à la double croche, avec une force réglable.
- **AIR-F-38 (I) — Export audio.** Le système DOIT exporter la boucle en fichier WAV par un rendu hors ligne.
- **AIR-F-39 (S) — Export MIDI.** Le système DOIT exporter la boucle en fichier MIDI, une piste par couche.
- **AIR-F-40 (S) — Session.** Le système DOIT enregistrer et rouvrir une session en JSON.
- **AIR-F-41 (S) — Sortie MIDI.** OÙ le navigateur le permet, le système DOIT envoyer notes et réglages vers une sortie MIDI, selon 7.12.
- **AIR-F-42 (O) — Vidéo.** Le système DOIT pouvoir enregistrer la scène et le son en vidéo.

**Instrument en fichier**

- **AIR-F-43 (I) — Format.** Un instrument DOIT être un fichier validé par schéma. Un fichier invalide DOIT être refusé avec la raison.
- **AIR-F-44 (I) — Éditeur.** Le système DOIT permettre de dupliquer un instrument et d'en changer la gamme, la fondamentale, l'étendue, le nombre de cordes ou de zones, l'aimant et le son.
- **AIR-F-45 (S) — Lien.** Le système DOIT produire un lien qui contient l'instrument dans le fragment d'adresse.
- **AIR-F-46 (O) — Zones à la main.** Le système DOIT permettre de placer et de redimensionner les zones directement sur la scène.

**Prises et banc d'essai**

- **AIR-F-47 (I) — Enregistrer.** QUAND l'utilisateur le demande, le système DOIT enregistrer une prise, faite des points des mains et de rien d'autre, et la proposer en téléchargement.
- **AIR-F-48 (I) — Rejouer.** Le système DOIT pouvoir rejouer une prise comme si les mains étaient devant la caméra.
- **AIR-F-49 (I) — Banc d'essai.** Le projet DOIT fournir une commande qui, pour une prise et un instrument, produit la liste des événements, un rendu audio et un rapport de mesures, sans périphérique audio.
- **AIR-F-50 (S) — Fantôme.** QUAND aucune main n'est vue pendant vingt secondes après un démarrage, le système DOIT jouer une prise à faible volume, et s'arrêter dès qu'une main paraît.

**Scène et pédagogie**

- **AIR-F-51 (I) — Scène.** Le système DOIT dessiner les mains, les zones ou les cordes, et une réponse visible à l'endroit du geste pour chaque note.
- **AIR-F-52 (I) — Image masquée.** L'image de la caméra NE DOIT pas être affichée par défaut ; un réglage DOIT permettre de l'afficher.
- **AIR-F-53 (S) — Physique.** OÙ le mode « Show the physics » est actif, le système DOIT afficher la fréquence, le nom de la note et la forme du son.
- **AIR-F-54 (S) — Hors ligne.** Après une première visite, le système DOIT fonctionner sans réseau.
- **AIR-F-55 (O) — Quatre mains.** Le système DOIT pouvoir suivre deux joueurs devant la même caméra.

**Exclusions**

- **AIR-F-56 (X) — Microphone.** Aucune demande d'accès au microphone.
- **AIR-F-57 (X) — Envoi.** Aucun envoi d'image ni de prise vers un serveur.
- **AIR-F-58 (X) — Échantillons.** Aucun son enregistré, aucune banque de sons.

---

<a id="exigences-n"></a>

## 10. Exigences non fonctionnelles

| Id | Domaine | Exigence |
|---|---|---|
| AIR-N-01 | Vie privée | Aucune image et aucune prise ne quittent le navigateur. Aucune requête après le chargement. Aucune mesure d'audience. Le modèle de vision est servi par le site lui-même. |
| AIR-N-02 | Silence de construction | Aucun test, aucun script, aucun hook et aucune commande de l'agent n'émet un son, ne lit un fichier audio sur un haut-parleur, ni ne touche au volume ou à la sortie audio de la machine. Les tests audio sont rendus hors ligne ; le navigateur de test est lancé sans écran et son coupé. |
| AIR-N-03 | Protection de l'oreille | Volume général à −12 dB par défaut ; plafond à −1 dB ; montée en une seconde au démarrage ; aucun saut de niveau au changement d'instrument. |
| AIR-N-04 | Performance | Au moins 25 analyses par seconde sur un portable courant ; moins de 5 ms de traitement par image hors analyse ; aucune coupure audio pendant cinq minutes de jeu. Cibles à mesurer. |
| AIR-N-05 | Retard | Part mesurable sous 60 ms en sortie filaire. Cible à mesurer ; le résultat est noté dans `docs/`. |
| AIR-N-06 | Accessibilité | WCAG 2.2 niveau AA pour tous les réglages ; tout se règle au clavier ; respect du réglage « moins de mouvement » ; aucun clignotement à plus de trois fois par seconde ; jeu à une main, maintien, zone calibrée. Limite dite : le jeu sans aucun retour visuel n'est pas traité dans cette édition. |
| AIR-N-07 | Compatibilité | Deux dernières versions de Chrome, Edge, Firefox et Safari sur ordinateur. Téléphones : au mieux, sans engagement. Sans accélération graphique : repli sur le processeur. |
| AIR-N-08 | Robustesse | Caméra débranchée, permission retirée, onglet masqué, moteur audio suspendu par le navigateur : chaque cas a un état clair et ne laisse aucune note en cours. |
| AIR-N-09 | Déterminisme | `core` est pur. Une même prise et un même instrument donnent la même liste d'événements, au bit près. Un rendu hors ligne se compare par mesures, avec tolérance, d'un navigateur à l'autre. |
| AIR-N-10 | Tests | Propriétés de la section 13 en intégration continue. Aucune caméra réelle : des prises, et un seul essai de bout en bout avec un fichier vidéo en guise de caméra. |
| AIR-N-11 | Licences | Code sous licence MIT. MediaPipe est sous licence Apache 2.0 ; **à vérifier** : la licence du fichier de modèle, sur sa fiche. Notices jointes. Aucun fichier sonore. Polices libres. |
| AIR-N-12 | Honnêteté | Vocabulaire de 5.4 vérifié automatiquement. Toute valeur de retard affichée porte la mention « mesuré » ou « estimé ». |
| AIR-N-13 | Hébergement | Site statique en HTTPS (obligatoire pour la caméra), gratuit, en ligne jusqu'au 29 janvier 2027 au moins. |
| AIR-N-14 | Langue | Interface en anglais pour la soumission ; textes externalisés. |

---

<a id="architecture"></a>

## 11. Architecture technique

### 11.1 Vue d'ensemble

```text
┌───────────────────────────────── navigateur ─────────────────────────────────┐
│ apps/web  (Vite + React)                                                     │
│  scène · boucle · réglages · calibration · éditeur d'instrument · physique   │
│        │                          │                           │              │
│  packages/vision             packages/core               packages/audio      │
│  caméra, modèle,             repère, filtre, mesures,    graphe, voix,       │
│  lecture et écriture         gestes, musique,            module de corde,    │
│  des prises                  instrument, boucle, MIDI    rendu hors ligne    │
│        │                          │                           ▲              │
│        └──── points des mains ───►└──── événements datés ─────┘              │
└──────────────────────────────────────────────────────────────────────────────┘

 apps/bench : une prise + un instrument ─► événements, fichier audio, rapport de mesures
              (navigateur sans écran, son coupé, aucun périphérique audio)
```

La frontière entre `core` et `audio` est une liste d'événements datés sur l'horloge du son. C'est la couture de 7.9, matérialisée par un type. `core` se teste dans Node, sans navigateur ; `audio` se teste par rendu hors ligne ; `vision` n'est qu'une fine enveloppe autour du modèle.

### 11.2 Arborescence

```text
.
├── .kiro/                  specs, steering, hooks, agents
├── apps/
│   ├── web/                le site
│   ├── bench/              banc d'essai : rendu d'une prise, mesures, rapport
│   └── mcp/                les « oreilles en chiffres » de l'agent (option)
├── packages/
│   ├── core/               pur : space, filter, features, gestures, music,
│   │                       instrument, voices, schedule, loop, midi, measure
│   ├── audio/              graph, voices, worklets/pluck, offline
│   ├── vision/             camera, landmarker, takes
│   └── schema/             instrument, prise, session (Zod)
├── instruments/            phantom, harp, choir, bells, drone
├── takes/                  prises de référence et générateurs de prises de synthèse
├── public/models/          le modèle de vision et ses fichiers d'exécution
├── docs/                   journal de bord, mesures de retard
└── scripts/hooks/          gardes appelées par les hooks
```

### 11.3 Modules de `core`

| Module | Rôle |
|---|---|
| `space` | Miroir, proportions, zone de jeu, calibration |
| `filter` | Filtre adaptatif, canal lissé et canal vif |
| `features` | `u`, `v`, `pinch`, `open`, vitesses, présence |
| `gestures` | Seuils doubles, traversées, réarmement, sortie de main |
| `music` | Notes, fréquences, gammes, aimant, échelle de volume |
| `instrument` | Lecture d'un fichier d'instrument ; des gestes aux événements |
| `voices` | Attribution des voix, reprise de la plus ancienne, relâchement |
| `schedule` | Datation sur l'horloge du son, fenêtre d'avance |
| `loop` | Enregistrement, compensation, calage, couches |
| `midi` | Écriture d'un fichier MIDI, messages de sortie |
| `measure` | Calcul sur un tableau d'échantillons : fréquence d'un palier, crête, niveau moyen, instants d'attaque, durée du silence final |

Le type qui traverse la couture :

```ts
export type MusicEvent =
  | { type: "noteOn"; t: number; voice: string; midi: number; velocity: number }
  | { type: "noteOff"; t: number; voice: string }
  | { type: "control"; t: number; voice: string;
      param: "pitch" | "gain" | "cutoff" | "vibrato"; value: number };
```

`t` est en secondes sur l'horloge du son. En jeu direct, c'est l'instant présent plus l'avance ; en rendu hors ligne, c'est l'instant de la prise.

### 11.4 Fichier d'instrument (extrait)

```json
{
  "format": "air-instrument/1",
  "name": "Phantom",
  "pointer": "palm",
  "scale": { "root": 50, "steps": [0, 2, 3, 5, 7, 8, 11] },
  "range": { "low": 45, "high": 81 },
  "snap": 0.6,
  "voices": 1,
  "controls": [
    { "hand": "pitch", "feature": "u", "to": "pitch" },
    { "hand": "volume", "feature": "v", "to": "gain", "curve": "db48" },
    { "hand": "pitch", "feature": "pinch", "to": "vibrato", "from": [0.4, 0.1], "into": [0, 40] }
  ],
  "gestures": [
    { "hand": "volume", "gesture": "fist", "do": "mute" }
  ],
  "oneHand": [
    { "feature": "u", "to": "pitch" },
    { "feature": "open", "to": "gain", "curve": "db48" }
  ],
  "sound": {
    "engine": "osc", "wave": "sine", "second": 0.15,
    "attackMs": 60, "releaseMs": 250, "glideMs": 30
  }
}
```

L'identifiant de format changera avec le nom du produit. Le fichier de la harpe est en annexe B.

### 11.5 Modèle de données

| Type | Champs principaux |
|---|---|
| `Take` | `format`, `fps`, `frames[]` |
| `Frame` | `t`, `hands[]` |
| `Hand` | `side`, `score`, `points[21][3]` |
| `PlayRect` | `u0`, `u1`, `v0`, `v1`, `calibratedAt` |
| `Features` | `u`, `v`, `pinch`, `open`, `speedU`, `speedV`, `present`, `edge` |
| `GestureEvent` | `t`, `hand`, `gesture`, `phase` (début ou fin), `value` |
| `MusicEvent` | Voir 11.3 |
| `Instrument` | `format`, `name`, `pointer`, `scale`, `range` ou `strings` ou `zones`, `snap`, `controls[]`, `gestures[]`, `oneHand[]`, `sound` |
| `LoopLayer` | `instrument`, `events[]`, `muted` |
| `Session` | `tempo`, `bars`, `layers[]`, `settings` |
| `LatencyReport` | `frameIntervalMs`, `inferenceMs`, `processingMs`, `audioBaseMs`, `audioOutputMs?`, `cameraAssumedMs` |
| `RenderReport` | `notes[]` (instant, note attendue, fréquence mesurée, écart en centièmes), `peakDb`, `rmsDb`, `maxVoices`, `silenceAfterMs` |

### 11.6 Banc d'essai

| Commande | Effet |
|---|---|
| `bench events --take <prise> --instrument <fichier>` | Imprime la liste des événements ; tourne dans Node, sans navigateur |
| `bench render --take <prise> --instrument <fichier> --out <dossier>` | Écrit `events.json`, `render.wav` et `report.json` ; navigateur sans écran, son coupé, rendu hors ligne |
| `bench compare <rapport> <référence>` | Compare deux rapports avec les tolérances de la section 13 ; code de sortie non nul en cas d'écart |
| `bench synth <forme> [paramètres]` | Fabrique une prise de synthèse : ligne droite, tremblement, traversée, sortie |

Le rendu hors ligne ne demande aucun périphérique audio : il calcule les échantillons dans un tableau, plus vite que le temps réel, et les écrit dans un fichier.

### 11.7 Serveur MCP (option)

Trois outils en lecture et en calcul : `render_take` (prise et instrument en entrée, rapport en sortie), `list_notes` (les notes mesurées dans un rendu), `compare_reports`. L'agent de Kiro s'en sert pour savoir ce qu'il a fait sonner, en nombres.

### 11.8 Scène

La scène est un canevas en deux dimensions redessiné à chaque image de l'écran : mains, zones, cordes, traces. Tous les réglages sont des contrôles ordinaires de la page, hors du canevas, pour le clavier et les lecteurs d'écran.

### 11.9 Hébergement

Un hébergement statique gratuit en HTTPS. Le modèle et ses fichiers d'exécution sont dans `public/models/`, avec un cache long. **À vérifier** : leur poids, qui fixe le temps du premier chargement. Rappel du règlement : l'adresse doit rester accessible gratuitement jusqu'au 29 janvier 2027.

---

<a id="interface"></a>

## 12. Interface et direction artistique

### 12.1 Écrans

| Écran | Contenu |
|---|---|
| Accueil | « Start », « Play without a camera », et une ligne : « Your camera image never leaves this page » |
| Scène | Les mains, les zones ou les cordes, le nom de l'instrument, la note en cours, une jauge de volume, le retard |
| Instruments | Un tiroir : les instruments livrés, les tiens, « dupliquer » |
| Boucle | La barre des mesures, les couches, le tempo, enregistrer, retirer, exporter |
| Calibration | La consigne, un décompte, le rectangle obtenu, « recommencer » |
| Éditeur d'instrument | Un formulaire : gamme, fondamentale, étendue, nombre de cordes ou de zones, aimant, son |
| Physique | La fréquence, le nom de la note, la courbe du son |
| Réglages | Aimant, gaucher, une main, maintien, volume, réverbération, retard supposé de la caméra, afficher l'image |

### 12.2 États à traiter

Avant le démarrage ; caméra demandée ; caméra refusée ; aucune caméra ; modèle en cours de chargement, avec sa progression ; modèle en échec, donc jeu au pointeur ; aucune main ; une main ; deux mains ; main au bord de la zone ; lumière insuffisante ; onglet masqué ; moteur audio suspendu par le navigateur ; sortie sans fil probable ; boucle pleine ; fichier d'instrument refusé ; MIDI indisponible.

### 12.3 Direction artistique : la séance

- **L'image de la caméra n'est pas montrée.** Sur un fond de nuit, seules les mains apparaissent, dessinées d'un trait clair avec une légère traîne : des mains de fantôme. C'est le thème de la saison, et c'est aussi une protection : on peut filmer une démonstration sans montrer la pièce ni le visage.
- **La vue remplace le toucher.** Rien ne résiste sous les doigts, donc chaque note répond à l'endroit du geste : une corde vibre, une bougie s'allume dans la zone du chœur, le thérémine laisse derrière la main la courbe de sa hauteur.
- **Trois couleurs.** Nuit, os, et une teinte spectrale pour ce qui sonne. Aucun éclair, aucun clignotement.
- **Réserve.** Jouer devant un écran sombre sans voir son image peut dérouter au début : un réglage affiche l'image, atténuée, derrière la scène.

### 12.4 Accessibilité

- Zone de jeu réglée sur la portée ; jeu à une main ; maintien ; force du filtrage réglable pour les mains qui tremblent.
- Tous les réglages au clavier, avec des libellés lus par les lecteurs d'écran ; la note en cours est aussi un texte.
- Respect du réglage « moins de mouvement » : plus de traîne ni de vibration des cordes, seulement des changements d'état.
- Contraste de 4,5 pour 1 au moins pour les textes.
- Le jeu au pointeur et au clavier donne accès à tout l'instrument sans caméra.

---

<a id="proprietes"></a>

## 13. Propriétés à tester, et preuve sans écoute

### 13.1 Trois niveaux de preuve, aucun haut-parleur

| Niveau | Ce qui est prouvé | Comment |
|---|---|---|
| 1 — Événements | D'une prise à la liste des notes et des réglages | Calcul pur dans Node ; comparaison exacte |
| 2 — Son rendu | De la liste d'événements aux échantillons | Rendu hors ligne dans un navigateur sans écran, son coupé ; mesures avec tolérance |
| 3 — Bout en bout | La page entière, d'une fausse caméra aux événements | Un fichier vidéo en guise de caméra ; on lit le journal des événements, pas le son |

### 13.2 Propriétés

Générées avec fast-check. Les générateurs fabriquent des prises de synthèse (trajectoires, tremblement d'amplitude donnée, images manquantes, cadence irrégulière) et des instruments (gammes, étendues, nombres de cordes quelconques).

| Id | Propriété |
|---|---|
| AIR-P-01 | **Zone de jeu.** Pour tout point, `u` et `v` sont entre 0 et 1, et `u` ne décroît pas quand la main va vers la droite de l'écran. |
| AIR-P-02 | **Filtre borné.** La sortie reste entre le minimum et le maximum des entrées vues ; pour une entrée constante elle y converge ; aucun horodatage, même répété, ne produit une valeur non numérique. |
| AIR-P-03 | **Hauteur monotone.** Pour tout instrument, si `u₁ ≤ u₂` alors la hauteur en `u₁` est inférieure ou égale à la hauteur en `u₂`, avec ou sans aimant. |
| AIR-P-04 | **Fréquences.** La note 69 vaut 440 Hz ; ajouter 12 double la fréquence. |
| AIR-P-05 | **Dans la gamme.** Avec l'aimant à 1, toute note émise appartient à la gamme et à l'étendue, pour toute prise. |
| AIR-P-06 | **Marge.** Pour toute prise dont la hauteur tremble avec une amplitude inférieure à la marge, il se produit au plus un changement de note. |
| AIR-P-07 | **Une traversée, une note.** Toute traversée franche d'une corde produit exactement un pincement ; un tremblement autour d'une corde en produit au plus un par délai de réarmement. |
| AIR-P-08 | **Balayage.** Un balayage de gauche à droite sur `k` cordes les fait sonner dans l'ordre montant ; le balayage inverse, les mêmes dans l'ordre descendant. |
| AIR-P-09 | **Aucune note coincée.** Pour toute prise, tout début de note a une fin, et après la dernière image, le délai de grâce et l'extinction, aucune voix n'est active. |
| AIR-P-10 | **Voix bornées.** À tout instant, le nombre de voix actives est inférieur ou égal à `maxVoices`. |
| AIR-P-11 | **Ordre et causalité.** Les instants des événements ne décroissent jamais, et aucun événement ne précède l'image qui l'a causé. |
| AIR-P-12 | **Déterminisme.** Même prise, même instrument : même liste d'événements, à l'identique. |
| AIR-P-13 | **Plafond.** Pour toute liste d'événements dans les bornes de voix, la crête du rendu ne dépasse pas −1 dB. |
| AIR-P-14 | **Justesse rendue.** Pour toute note de l'étendue tenue une demi-seconde, la fréquence mesurée est à 5 centièmes de demi-ton près de la fréquence attendue. |
| AIR-P-15 | **Silence final.** Une fois toutes les voix relâchées, le niveau du rendu passe sous −60 dB en 800 ms sans réverbération, en deux secondes avec. |
| AIR-P-16 | **Pas de marches.** Pour un glissé lent sans aimant, la fréquence mesurée par fenêtres de 10 ms ne fait aucun saut supérieur à celui d'une rampe idéale, à une tolérance près. C'est le test du grésillement. |
| AIR-P-17 | **Boucle.** La compensation avance chaque événement exactement du retard choisi, en restant dans la boucle ; un calage de force 1 place chaque attaque sur la grille, un calage de force 0 ne change rien ; le rendu d'une boucle a exactement la durée de ses mesures. |
| AIR-P-18 | **MIDI.** Écrire une session en fichier MIDI puis la relire redonne les mêmes notes, à une unité de temps du fichier près. |
| AIR-P-19 | **Schémas.** Tout instrument généré survit à un aller-retour d'écriture et de lecture ; tout fichier altéré est accepté comme valide ou refusé en entier, sans exception. |
| AIR-P-20 | **Prise.** Coder puis décoder une prise conserve les points au pas de codage près ; une prise ne contient que des instants, des côtés, des scores et des points. |
| AIR-P-21 | **Rôles stables.** Pour toute prise où deux mains se croisent sans disparaître, les rôles ne s'échangent pas. |
| AIR-P-22 | **Calibration.** Pour tout nuage de positions, le rectangle obtenu en contient au moins 90 %, respecte la taille minimale et reste dans l'image. |

### 13.3 Prises de référence

Des fichiers fixes dans `takes/`, chacun avec son rapport attendu : `left-hand-only`, `two-hands-cross`, `slow-rise` (l'exemple du thérémine en 7.14), `harp-sweep` (l'exemple de la harpe), `tremor-at-boundary`, `hand-leaves-mid-note`, `fast-jab`, et trois prises réelles enregistrées pendant le lot A1 pour régler le filtre.

### 13.4 Ce que les mesures ne prouvent pas

Elles disent quelles notes sonnent, quand, à quelle fréquence et à quel niveau. Elles ne disent pas si le son est beau ni si l'instrument est agréable à jouer. Cette part demande une oreille : la tienne, pas celle de l'agent. Une séance d'écoute par lot, notée dans le journal de bord, avec ce qui a été réglé.

---

<a id="kiro"></a>

## 14. Stratégie Kiro

### 14.1 Specs

| Spec | Parcours | Contenu |
|---|---|---|
| `capture-vision` | Quick Spec | AIR-F-01 à 04, 06 |
| `play-space` | Quick Spec | AIR-F-05, 08, 09 ; propriétés 01, 22 |
| `filtering` | Exigences d'abord | AIR-F-13, 15 ; propriété 02 |
| `gestures` | Exigences d'abord | AIR-F-14, 16, 17 ; propriétés 06, 07, 08, 21. **Candidat à la comparaison « spec contre vibe coding »** : petit, bien borné, plein de cas limites (seuils, réarmement, images manquantes) |
| `music-mapping` | Exigences d'abord | AIR-F-18 à 20 ; propriétés 03, 04, 05 |
| `instrument-format` | Conception d'abord | AIR-F-21, 43, 44 ; propriété 19 |
| `seam-and-voices` | Conception d'abord, la section 7.9 en entrée | AIR-F-24, 26, 27 ; propriétés 09 à 12 |
| `synth-engine` | Conception d'abord | AIR-F-25, 28, 29, 30 ; propriétés 13 à 16 |
| `loop-export` | Exigences d'abord | AIR-F-34 à 40 ; propriétés 17, 18 |
| `takes-bench` | Exigences d'abord | AIR-F-47 à 49 ; propriété 20 |
| `stage-ui` | Conception d'abord | AIR-F-31 à 33, 51 à 53 ; AIR-N-06 |
| `midi-out` | Quick Spec (option) | AIR-F-41 |

L'analyse des exigences est passée sur chaque `requirements.md` avant la conception. Les contradictions sont à chercher entre `gestures` et `seam-and-voices` : quatre délais s'y croisent (grâce de 150 ms, relâchement de 300 ms sans image, maintien de 400 ms, réarmement de 80 ms), et il est facile d'écrire deux règles qui se contredisent sur ce qui arrive à une note quand la main disparaît pendant un maintien.

### 14.2 Steering

| Fichier | Inclusion | Contenu |
|---|---|---|
| `product.md`, `tech.md`, `structure.md`, `testing.md` | Toujours | Fondation : pour qui, pile technique, arborescence, règles de test |
| `no-sound.md` | Toujours | L'agent n'émet aucun son et ne touche ni au volume ni à la sortie audio. Toute preuve passe par le banc d'essai : événements, rendu, rapport |
| `privacy.md` | Toujours | Aucune image conservée ni envoyée ; une prise ne contient que des points ; aucune requête vers un tiers |
| `two-clocks.md` | `fileMatch` sur `packages/audio/**` et `packages/core/src/{schedule,loop,voices}/**` | Les trois règles de 7.9 |
| `music-theory.md` | `fileMatch` sur `packages/core/src/music/**` et `instruments/**` | Formules, tableaux de gammes, noms des notes, centièmes de demi-ton, décibels |
| `mediapipe.md` | `fileMatch` sur `packages/vision/**` | Les faits vérifiés de 7.3 : paquet, réglages, forme du résultat, appel synchrone, piège du côté, fichiers servis par le site |
| `honest-latency.md` | `fileMatch` sur `apps/web/**` | Le vocabulaire de 5.4 ; « mesuré » ou « estimé » sur toute valeur |
| `release.md` | Manuelle | Mesures de retard, séance d'écoute, publication |

### 14.3 Hooks

| Hook | Déclencheur | Action |
|---|---|---|
| `no-sound-guard` | Avant usage d'outil, catégorie `shell` | Commande : refuse toute commande de l'agent qui jouerait un son ou réglerait le volume, et tout lancement d'un navigateur de test avec écran ou sans l'option de son coupé |
| `core-properties` | Enregistrement dans `packages/core/**` | Commande : lance les propriétés 01 à 12 |
| `render-check` | Enregistrement dans `packages/audio/**` ou `instruments/**` | Commande : rend les prises de référence et compare les rapports |
| `instrument-schema-guard` | Enregistrement dans `instruments/**` | Commande : valide chaque fichier d'instrument |
| `take-privacy-guard` | Enregistrement dans `takes/**` | Commande : refuse une prise qui contient autre chose que des points, ou qui pèse plus que le plafond par seconde |
| `no-audio-asset-guard` | Enregistrement de tout fichier | Commande : refuse l'ajout d'un fichier sonore au dépôt, hors du dossier de sortie ignoré |
| `wording-guard` | Enregistrement dans `apps/web/**` | Commande : contrôle du vocabulaire de 5.4 |
| `journal-reminder` | Après une tâche de spec | Commande : ajoute une ligne au journal de bord |

Toutes les actions sont de type commande : elles ne consomment pas de crédits. Les déclencheurs de fichier ne réagissent qu'aux modifications faites par l'agent ; chaque garde est donc aussi un contrôle de l'intégration continue.

Le hook à montrer dans la vidéo :

```json
{
  "version": "v1",
  "hooks": [
    {
      "name": "No sound: the agent never plays audio or touches the volume",
      "trigger": "PreToolUse",
      "matcher": "shell",
      "action": { "type": "command", "command": "node scripts/hooks/no-sound-guard.mjs" }
    }
  ]
}
```

Le script lit sur son entrée standard le JSON fourni par Kiro (`hook_event_name`, `cwd`, `session_id`, `tool_name`, `tool_input`). Il cherche dans la commande un lecteur audio (`aplay`, `paplay`, `afplay`, `ffplay`, `mpv`, `vlc`, `speaker-test`), un réglage de volume (`amixer`, `pactl`, `wpctl`, `osascript` avec `volume`), ou un lancement de navigateur de test sans l'option de son coupé. S'il en trouve un, il sort avec un code non nul et un message sur la sortie d'erreur : Kiro bloque l'outil et transmet le message à l'agent, qui doit passer par le banc d'essai. **À vérifier** : le nom exact du champ qui porte la commande dans `tool_input`, à lire sur un premier déclenchement.

### 14.4 Agents personnalisés, MCP, powers

- **`luthier`** : écrit un fichier d'instrument à partir d'une description d'une phrase, le valide, le rend sur les prises de référence et lit le rapport. Les six instruments sont son travail.
- **`seam-reviewer`**, en lecture seule : relit le code audio contre `two-clocks.md` ; il cherche les réglages fixés sans rampe et les minuteurs employés pour le rythme.
- **`wording-reviewer`**, en lecture seule : relit les libellés contre `honest-latency.md`.
- **MCP pendant la construction** : le serveur du projet (`render_take`, `list_notes`, `compare_reports`), qui sert d'oreilles en chiffres à l'agent ; un serveur de documentation pour les pages de MediaPipe et de l'audio du navigateur.
- **Power livré par le projet** (option) : ce serveur MCP, un skill « fabriquer un instrument » (décrire, écrire le fichier, rendre, lire le rapport, ajuster) et sa déclaration.

### 14.5 Surfaces

| Surface | Emploi |
|---|---|
| IDE | Specs, tests par propriétés (la fonction « Correctness » n'existe que là), scène |
| CLI | Le `luthier` à la chaîne sur les six instruments ; banc d'essai ; mode sans interface dans l'intégration continue pour une relecture par `seam-reviewer` (demande une clé, donc un abonnement payant) |
| Web | Une session en parallèle sur `synth-engine` pendant que l'IDE avance sur `gestures` : la liste d'événements les sépare proprement |
| Crew | Pas d'emploi naturel ici ; ne pas forcer |

### 14.6 Le récit à tenir

Quatre faits à pouvoir montrer, chiffres à l'appui, dans le texte de soumission :

1. **L'agent n'a jamais entendu l'instrument.** Le hook `no-sound-guard` l'en empêche, le journal compte ses déclenchements, et chaque comportement musical a sa preuve en fichier.
2. **Les propriétés portent la musique.** « Aucune note hors de la gamme », « aucune note coincée », « une traversée, une note » sont des phrases du cahier, des critères d'acceptation et des tests. Noter chaque contre-exemple trouvé ; les candidats probables sont deux images au même horodatage, une main qui sort pile sur une corde, deux mains dans la même zone, et un changement de note pendant le délai de grâce.
3. **Kiro est luthier.** Six instruments écrits à partir d'une phrase chacun. Montrer une phrase, le fichier obtenu, et le rapport de rendu.
4. **Le steering change le code.** Montrer le réglage fixé sans rampe que l'agent écrit avant `two-clocks.md`, la même ligne après, et la mesure du grésillement (AIR-P-16) dans les deux cas.

Budget indicatif : 700 à 900 des 4 000 crédits. **À vérifier** : le coût réel d'une spec complète, à mesurer sur `gestures`.

---

<a id="plan"></a>

## 15. Plan de réalisation

### 15.1 Lots

| Lot | Contenu | Jours |
|---|---|---|
| A1 | Capture, modèle servi par le site, mains à l'écran, enregistrement et rejeu de prises ; mesures de retard sur tes machines | 1 |
| A2 | Zone de jeu, calibration, filtrage, mesures, gestes ; prises de synthèse ; propriétés 01, 02, 06, 07, 21, 22 | 1 |
| A3 | Musique, format d'instrument, couture, voix ; propriétés 03 à 05, 08 à 12, 19 | 1 |
| A4 | Moteur audio : voix, module de corde, limiteur, rendu hors ligne ; banc d'essai ; propriétés 13 à 16 | 1 |
| A5 | Trois instruments, scène, réponse visuelle, affichage du retard, jeu sans caméra | 1 |
| A6 | Boucle, compensation, export audio ; propriété 17 ; accessibilité, hébergement, README | 1 |
| **Périmètre minimal** | | **6** |
| Options | Bells et Drone (0,5) ; export et sortie MIDI (1) ; physique (0,5) ; analyse déportée (0,5) ; vidéo (0,5) ; serveur MCP (0,5) ; calage (0,25) ; fantôme (0,25) ; lien de partage (0,25) ; hors ligne (0,25) ; réverbération (0,25) | 4,75 |

Hors vidéo et texte de soumission : compter 1,5 jour de plus. La vidéo demande ici plus de préparation qu'ailleurs : il faut composer et répéter la pièce en boucle.

### 15.2 Périmètre réduit, en 4 jours

| Lot | Ce qui est retiré | Jours |
|---|---|---|
| A1 | L'enregistrement de prises dans la page (prises de synthèse seulement) | 0,75 |
| A2 | La calibration (zone par défaut) | 0,75 |
| A3 | Rien | 0,75 |
| A4 | Le module de corde (harpe en oscillateurs simples) | 0,75 |
| A5 | Choir (deux instruments) | 0,75 |
| A6 | La boucle et l'export ; restent l'hébergement et le README | 0,25 |

À ce périmètre, il reste la preuve sans écoute et l'instrument en fichier : deux des quatre angles de 6.2. On perd le réglage sur la portée et la boucle, donc la pièce de la démonstration. Je ne le recommande pas : c'est la version qui ressemble le plus à ce qui existe.

Ce qui ne se retire jamais : la règle du silence et le banc d'essai, l'absence de note coincée, le plafond de niveau, l'affichage du retard.

### 15.3 Calendrier si le projet est mené seul

| Date | Travail |
|---|---|
| 12 novembre | A1 ; mesures de retard ; demande des crédits Kiro si ce n'est pas fait |
| 13 novembre | A2 |
| 14 novembre | A3 |
| 15 novembre | A4 |
| 16 novembre | A5 : première version jouable en ligne |
| 17 novembre | A6 |
| 18 et 19 novembre | Options, dans l'ordre : Bells et Drone, fantôme, physique, MIDI |
| 20 novembre | Séance d'écoute et de réglage ; corrections |
| 21 novembre | **Gel des fonctions** |
| 22 et 23 novembre | Vidéo, texte de soumission, billet de blog, publication sociale |
| 24 novembre | Marge ; soumission possible dès ce jour |

S'il passe après un autre projet : lancé après le **26 novembre**, le périmètre minimal ne tient plus avant une soumission le 3 décembre.

---

<a id="risques"></a>

## 16. Risques et parades

| Risque | Gravité | Parade |
|---|---|---|
| Le genre est saturé : originalité contestée | Haute | L'angle de 6.2, dit sans détour dans la soumission ; la pièce en boucle ; le récit de construction |
| Retard trop grand sur certaines machines | Moyenne | Instruments qui le supportent ; affichage ; conseil de sortie filaire ; jeu au pointeur |
| Suivi instable : lumière, arrière-plan, mains qui se recouvrent | Moyenne | Conseils à l'écran ; délai de grâce ; rôles par continuité ; démonstration filmée sous bonne lumière |
| L'analyse occupe la page et retarde les événements | Moyenne | Avance de programmation ; mesure dès A1 ; déport de l'analyse en option |
| Poids du modèle : premier chargement long | Moyenne | Progression affichée ; cache ; jeu au pointeur disponible pendant le chargement |
| Écarts entre navigateurs : règles de démarrage du son, module audio, mesure du retard | Moyenne | Essais sur les quatre navigateurs dès A4 ; replis ; mention « mesure partielle » |
| Notes coincées, le défaut classique du genre | Moyenne | Propriété 09 ; relâchement général sans image ou onglet masqué |
| Les mesures ne disent pas si c'est beau | Moyenne | Séances d'écoute planifiées, par toi |
| Un outil de construction émet un son sur ta machine | Faible, mais inacceptable | Steering `no-sound.md`, hook `no-sound-guard`, tests sans écran et son coupé |
| Juges sans caméra, ou qui la refusent | Moyenne | Jeu sans caméra ; fantôme ; vidéo |
| Côté gauche et droit inversés | Faible | Prise de référence `left-hand-only` |
| Fatigue des bras levés | Faible | Zone réglée sur une portée confortable ; jeu assis ; maintien |
| Musique protégée dans la vidéo | Faible | Improvisation dans l'outil, aimantée sur une gamme ; aucun air connu |

---

<a id="demo"></a>

## 17. Démonstration et soumission

### 17.1 Script de la vidéo (moins de trois minutes, en anglais)

| Temps | Image | Voix |
|---|---|---|
| 0:00 – 0:12 | Écran noir. Deux mains de fantôme apparaissent. Une note monte | Rien d'abord, puis : « No instrument. No install. A webcam, and thin air. » |
| 0:12 – 0:40 | Phantom : une phrase lente, aimantée. L'aimant coupé : le glissé des films d'épouvante. L'aimant remis | « Notes snap to a scale, so you can't play a wrong one. Unless you want the ghost. » |
| 0:40 – 1:25 | La boucle, sans coupe : un bourdon, la harpe, le chœur, puis le thérémine par-dessus. Le compteur de retard reste visible | « The camera sees thirty frames a second. Sound needs forty-eight thousand samples a second. The seam between those two clocks is the whole project. The loop even gives back the tenth of a second the camera takes. » |
| 1:25 – 1:45 | Calibration assise ; jeu à une main ; maintien | « It fits the reach you have. » |
| 1:45 – 2:35 | Kiro : le hook `no-sound-guard` qui bloque une commande ; une prise rejouée ; le rapport de mesures ; une propriété et son contre-exemple ; `luthier` qui écrit un instrument à partir d'une phrase | « The agent that built this instrument was never allowed to hear it. Every musical behaviour is a property test on recorded hand movements, rendered to a file and measured. » |
| 2:35 – 2:55 | Retour à la scène ; fin de la pièce ; l'adresse | « Open source. Nothing leaves your browser. » |

La musique de la vidéo est jouée dans l'outil, improvisée, sans aucun air existant. Les mots « real-time » et « instant » n'y figurent pas.

### 17.2 Pour les juges

L'adresse propose « Start » et « Play without a camera ». Si le juge ne fait rien, le fantôme joue. Le README a une section « Judge in three minutes » : trois gestes à essayer, où lire le retard, comment lancer le banc d'essai sur une prise.

### 17.3 Texte de soumission

Plan : d'où vient l'idée ; ce que ça fait ; comment c'est construit avec Kiro (specs, steering, hooks, agents, MCP, avec les chiffres du journal de bord) ; ce qui a résisté ; ce qui a été appris ; la suite. Citer les instruments voisins et dire ce qui diffère. Le journal de bord se tient dès le premier jour dans `docs/journal.md`.

### 17.4 Bonus

Billet de blog sur « un instrument construit par un agent qui n'entend pas » ; publication sociale commençant par `#KiroweenHackathon26`, avec quinze secondes de la pièce ; les autres bonus sont décrits dans le premier document.

---

<a id="recette"></a>

## 18. Recette

Chaque point se prouve par un journal ou un fichier, jamais à l'oreille. Une seule ligne fait exception, et elle te revient.

- [ ] Les vingt-deux propriétés passent ; les graines sont consignées.
- [ ] Exemple du thérémine (7.14) : `bench events` donne sol, la, si bémol, do dièse, ré, mi, fa, sol, dans cet ordre, aux instants de référence à une image près.
- [ ] Même exemple : `bench render` donne chaque palier à 5 centièmes de demi-ton près, une crête sous −1 dB, et le silence 800 ms après la sortie des mains.
- [ ] Exemple de la harpe : quatre notes (la, do, ré, fa), espacées de 125 ms à une image près, de force 0,17.
- [ ] Prise `hand-leaves-mid-note` : aucune voix active à la fin du rapport.
- [ ] Prise `tremor-at-boundary` : au plus un changement de note.
- [ ] Prise `left-hand-only` : côté « gauche ».
- [ ] Boucle de quatre mesures à 90 battements par minute : le rendu fait exactement 512 000 échantillons à 48 000 par seconde, soit 10,67 s.
- [ ] Le journal réseau du navigateur de test ne contient aucune requête après le chargement, ni aucune vers un tiers.
- [ ] La liste des fichiers du dépôt ne contient aucun fichier sonore ; le journal des permissions ne contient aucune demande de microphone.
- [ ] Le journal du hook `no-sound-guard` est joint ; la configuration du lanceur de tests montre l'absence d'écran et le son coupé.
- [ ] `docs/latency.md` donne, pour deux machines au moins, chaque composante du retard, avec « mesuré » ou « estimé ».
- [ ] Contrôle du vocabulaire : aucune occurrence de « real-time » ni d'« instant » dans le site construit.
- [ ] Contrôle automatique d'accessibilité sans erreur ; tous les réglages atteints au clavier ; parcours P2 automatisé.
- [ ] `/.kiro` présent à la racine et non ignoré ; licence ; notices ; README ; adresse en HTTPS.
- [ ] Vidéo de moins de trois minutes, sans marque de tiers ni musique protégée.
- [ ] **Séance d'écoute humaine** notée dans le journal de bord, avec la date et ce qui a été réglé.

---

<a id="questions"></a>

## 19. Questions ouvertes

1. Que désigne exactement « synthexis » ? Une adresse permettrait de se positionner contre lui.
2. Planchette : quelle catégorie, quel avancement ? C'est ce qui décide entre remplacer et compléter.
3. Quel nom anglais ?
4. Quelle caméra et quelle sortie audio pour la démonstration ? Le retard mesuré en dépend.
5. Quelle est la convention de côté du modèle sur une image en miroir ? À fixer par la prise de référence.
6. Quel est le poids du modèle, et la licence de son fichier ?
7. Quelles valeurs de filtre sur tes mains et ta caméra ?
8. La sortie MIDI entre-t-elle dans le périmètre ? Elle intéresse les musiciens, pas le jury.
9. Essaie-t-on les téléphones ?
10. Quand fais-tu les séances d'écoute ?
11. La pièce de la vidéo est-elle improvisée ou écrite à l'avance ?
12. Affiche-t-on l'image de la caméra par défaut pour les débutants, au prix de la mise en scène ?

---

<a id="annexes"></a>

## Annexes

### Annexe A — Glossaire

| Terme | Sens dans ce document |
|---|---|
| Thérémine | Instrument de 1920 dont on joue sans le toucher, une main pour la hauteur, une pour le volume |
| Prise | L'enregistrement des points des mains au fil du temps, sans image |
| Zone de jeu | Le rectangle de l'image dans lequel la position des mains est lue de 0 à 1 |
| Calibration | Le relevé de la portée du joueur, qui fixe la zone de jeu |
| Pointeur | Le point d'une main qui sert à viser : bout de l'index ou centre de la paume |
| Canal lissé, canal vif | Les deux sorties du filtrage : l'une stable pour les réglages, l'autre rapide pour les attaques |
| Pince, ouverture | Deux mesures de la main : écart pouce-index, et main fermée ou à plat |
| Seuils doubles | Un seuil pour enclencher, un autre pour relâcher, afin d'éviter les bascules répétées |
| Aimant | Le réglage qui tire la hauteur vers les notes de la gamme |
| Gamme | La liste des notes permises dans une octave |
| Numéro MIDI | Le rang d'une note : 69 pour le la à 440 Hz, un de plus par demi-ton |
| Centième de demi-ton | L'unité fine de justesse : cent par demi-ton |
| Décibel | L'unité de niveau : −6 dB divise l'amplitude par deux environ |
| Voix | Un son en cours ; l'instrument en joue huit au plus |
| Rampe | Le passage progressif d'un réglage à sa nouvelle valeur |
| Horloge du son | Le temps du moteur audio, compté en échantillons |
| Couture | Le passage des gestes, 30 par seconde, au son, 48 000 échantillons par seconde |
| Corde pincée | La synthèse de Karplus-Strong : une ligne à retard bouclée |
| Rendu hors ligne | Le calcul du son dans un tableau, sans haut-parleur, plus vite que le temps réel |
| Banc d'essai | L'outil qui rend une prise avec un instrument et mesure le résultat |
| Boucle, couche | Quelques mesures qui se répètent ; chaque passage enregistré est une couche |
| Compensation | L'avance donnée aux événements d'une boucle pour rattraper le retard |
| Calage | Le rapprochement des attaques vers la grille rythmique |
| Fantôme | La prise que l'instrument joue seul quand personne n'est là |

### Annexe B — Formats de fichiers

Instrument, la harpe :

```json
{
  "format": "air-instrument/1",
  "name": "Harp",
  "pointer": "index",
  "scale": { "root": 50, "steps": [0, 3, 5, 7, 10] },
  "strings": { "count": 16, "axis": "u" },
  "gestures": [
    { "hand": "any", "gesture": "cross", "do": "pluck", "velocity": "speed" },
    { "hand": "any", "gesture": "pinch", "do": "damp" }
  ],
  "sound": {
    "engine": "pluck",
    "decay": 0.996,
    "brightness": { "feature": "v", "into": [0.2, 0.9] }
  }
}
```

Prise (extrait ; une main, une image) :

```json
{
  "format": "air-take/1",
  "fps": 30,
  "frames": [
    {
      "t": 0.0,
      "hands": [
        {
          "side": "right",
          "score": 0.97,
          "points": [[0.41, 0.72, 0.0], [0.44, 0.66, -0.01], [0.47, 0.6, -0.02]]
        }
      ]
    }
  ]
}
```

Chaque main porte 21 points ; l'extrait n'en montre que trois.

Rapport de rendu (extrait) :

```json
{
  "take": "slow-rise",
  "instrument": "Phantom",
  "notes": [
    { "t": 0.0, "midi": 55, "expectedHz": 196.0, "measuredHz": 196.02, "cents": 0.2 },
    { "t": 0.21, "midi": 57, "expectedHz": 220.0, "measuredHz": 219.97, "cents": -0.2 }
  ],
  "peakDb": -13.4,
  "maxVoices": 1,
  "silenceAfterMs": 410
}
```

Les valeurs mesurées de cet extrait sont illustratives : elles montrent la forme du rapport, pas un résultat.

### Annexe C — Sources consultées le 11 novembre 2026

- Suivi des mains, guide Web : <https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js>
- Suivi des mains, modèle et mesures de Google : <https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker>
- Retard de sortie audio déclaré par le navigateur : <https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency>
- Prise en charge de Web MIDI : <https://caniuse.com/midi> (vue dans des résultats de recherche)
- Hand Tracking Instrument : <https://jasperbernaers.com/hand-tracking-instrument/>
- HandSynth : <https://handsynth.com/>
- Gesture Synth, un dépôt parmi d'autres : <https://github.com/Jia1267/gesture-synth> ; les autres sites du même nom ont été vus dans des résultats de recherche
- HandSonor : <https://handtracker.mpi-inf.mpg.de/projects/handsonor/> (vu dans des résultats de recherche, non lu)

Cités de mémoire, sans relecture ce jour : l'article du filtre « One Euro » (Casiez, Roussel et Vogel, 2012), l'algorithme de Karplus-Strong, la règle du retard minimal d'un bloc dans une boucle du graphe audio, la date de 1920 pour le thérémine, et la licence Apache 2.0 de MediaPipe. Ils figurent en annexe D.

### Annexe D — Points marqués « À vérifier », rassemblés

| Point | Section | Comment lever le doute |
|---|---|---|
| Ce que désigne « synthexis » | 1, 6.1 | Une adresse |
| Disponibilité du nom anglais | 2, 6.3 | Registre npm, nom de domaine, GitHub, bases de marques |
| Poids du modèle et de ses fichiers d'exécution | 4, 11.9 | Lire la taille des fichiers téléchargés |
| Licence du fichier de modèle | 10 | Sa fiche |
| Tous les retards de 5.1, sauf les chiffres de Google | 5.1 | Mesures du lot A1, notées dans `docs/latency.md` |
| Notification à chaque image vidéo dans les navigateurs visés | 7.2 | Tableaux de compatibilité ; essai |
| Convention de côté sur image en miroir | 7.3 | Prise `left-hand-only` |
| Valeurs du filtre et des seuils de gestes | 7.5, 7.6 | Réglage sur trois prises réelles |
| Retard minimal d'un bloc dans une boucle du graphe audio | 7.9 | Spécification de l'audio du navigateur |
| Présence d'`outputLatency` selon les navigateurs | 7.9 | Tableau de compatibilité ; essai |
| Web MIDI hors de Chrome, Edge et Opera | 7.12 | Tableau de compatibilité |
| Options du navigateur de test : fausse caméra, son coupé | 10, 13.1 | Documentation du lanceur de tests |
| Référence du filtre « One Euro » et de la corde pincée | 7.5, 7.9 | Relire les articles d'origine |
| Champ de la commande dans `tool_input` d'un hook | 14.3 | Premier déclenchement réel |
| Coût d'une spec en crédits | 14.6 | Mesure sur `gestures` |
| Cibles de performance et de retard | 4, 10 | Mesures pendant A1 et A4 |
