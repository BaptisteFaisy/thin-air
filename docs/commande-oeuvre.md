# Commande d'une œuvre — Thin Air

Ce dossier est destiné à un musicien qui n'a jamais vu le projet. Il dit ce
qu'est l'instrument, ce qu'il sait faire, ce qu'il ne sait pas faire, ce que
nous attendons comme livraison, et ce que nous rendons en échange.

---

## 1. En une page : ce qu'est l'instrument

**Thin Air** est un instrument que l'on joue **dans le vide, devant une
webcam**. Les mains sont lues par la caméra, l'air devient la partition, et
le son est synthétisé dans le navigateur. Rien à installer, aucun logiciel de
musique à ouvrir, aucun câble, aucun haut-parleur : la machine ne lit que les
mains.

Trois faits qui changent la façon d'écrire une pièce :

1. **Le retard est réel et il est dit.** La caméra donne 30 positions par
   seconde ; le son en demande 48 000 échantillons par seconde. Entre le geste
   et le son, il s'écoule de l'ordre d'un dixième de seconde. Nous ne le
   cachons pas : l'écran l'affiche, nous le mesurons, et **la boucle le
   compense** (ce que vous enregistrez est avancé du retard estimé, pour
   retomber sur le temps).
2. **Tout est synthétisé.** Le projet ne contient **aucun fichier sonore** :
   une garde automatique refuse tout échantillon versionné. Il n'y a pas de
   sample de batterie, pas de réplique de voix, pas de réplique d'instrument
   échantillonné. Les six timbres sont des algorithmes (oscillateur, corde
   pincée, modulation de fréquence, bruit filtré).
3. **Les notes sont aimantées.** Par défaut, chaque hauteur est rabattue sur la
   gamme de l'instrument : on ne peut pas jouer une note hors gamme. Le glissé
   libre existe (le théorémine), mais c'est un réglage, pas le mode par défaut.

Ce que nous faisons de votre pièce : nous la jouons dans la scène (le même
moteur que le navigateur), nous la rendons **hors ligne** en fichier WAV, nous
la mesurons (durée exacte, crête, voix simultanées, notes par couche), et nous
la filmons à l'écran pour la vidéo de démonstration. L'agent qui construit
l'instrument n'écoute jamais : la preuve est un rapport de mesures, l'écoute
est une affaire d'humains.

---

## 2. Les gestes possibles

| Geste | Comment | Ce qu'il commande |
|---|---|---|
| Position `u` (axe horizontal) | la main dans la zone de jeu | la **hauteur** (selon l'instrument : corde, zone, ou glissé) |
| Position `v` (axe vertical) | la main dans la zone de jeu | le **volume** (ou la brillance, selon l'instrument) |
| Pincer (pouce + index) | la main se ferme | l'extinction d'une corde, ou le **vibrato** du théorémine |
| Poing fermé | la main se ferme | le **cut** du son |
| Traversée vers le bas | la main descend d'une zone | la **frappe** d'une zone (cloches, percussions) |
| Pose tenue (400 ms) | la main reste dans une zone | le **maintien** d'une note (mode maintien) |
| Ouverture de la main | l'écartement des doigts | la **brillance** (nappes), la force (cordes) |

---

## 3. Les six instruments : ce que chacun sait faire

Chaque couche d'une session est **un** de ces six instruments, avec son propre
timbre, sa propre gamme et son nombre de voix.

| Instrument | Timbre et moteur | Étendue / gamme | Voix | Ce qu'il fait bien |
|---|---|---|---|---|
| **Phantom** (thérémine) | sinusoïde + harmonique 2 | la 45 → la 81 (110 à 880 Hz), ré mineur | 1 | une mélodie continue, glissée d'une note à l'autre (30 ms) ; vibrato par pincement |
| **Harp** (cordes pincées) | corde synthétique | 16 cordes, ré mineur pentatonique, ré 3 → ré 6 | 8 | arpèges, notes répétées, accords tenus |
| **Choir** (nappes) | dents de scie désaccordées + filtre | 8 zones, ré mineur | 2 | nappes longues, harmonies qui respirent ; la brillance suit l'ouverture de la main |
| **Bells** (cloches) | modulation de fréquence | 4 zones, ré mineur | 4 | frappes ponctuelles, longue résonance (3 s) |
| **Drone** (bourdon) | deux oscillateurs graves | 4 notes : la 1, do 2, mi 2, sol 2 | 2 | basse tenue, glissement lent de la hauteur |
| **Grid drums** (percussions) | bruit + corps sinusoïdal | 4 zones | 4 | frappes **replacées sur la grille** de la boucle — la seule façon, pour la percussion, de survivre au retard |

---

## 4. Ce que l'instrument ne sait pas faire

À lire avant d'écrire. Ces limites ne sont pas des bugs : ce sont les
conséquences du retard, du nombre de voix et de la règle « tout est
synthétisé ».

- **Pas de percussion de précision, pas de jeu rythmique fin.** Le retard
  (~0,1 s) vaut plusieurs doubles-croches : une frappe « à la double croche »
  n'arrive jamais à la double croche. C'est pourquoi les percussions existent
  (`Grid drums`) mais sont **replacées sur la grille** de la boucle. Écrivez
  la percussion comme une pulsation, pas comme une broderie.
- **Pas d'échantillons.** Aucun son enregistré n'existe dans le projet, et
  aucune garde n'en laissera entrer un. Une copie d'instrument, une voix
  samplée, un sample de batterie : impossible.
- **Pas de microtonal ni de notes hors gamme.** Les hauteurs sont des notes
  MIDI, rabattues sur la gamme de l'instrument. Seul le théorémine peut être
  réglé en glissé libre.
- **Pas de polyphonie libre.** Huit voix au plus par couche ; et par
  instrument : Phantom 1, Choir 2, Drone 2, Bells 4, Grid drums 4, Harp 8.
  Deux voix de chœur et deux de bourdon, c'est déjà un beau morceau.
- **Pas de tempo variable dans la boucle.** Le tempo est fixé pour toute la
  pièce ; les accélérations se font par changement de couche ou par
  changement de boucle, pas par un accelerando.
- **Pas d'expressivité note par note** au-delà de la force (`velocity`) et des
  quatre réglages continus : `pitch`, `gain`, `cutoff`, `vibrato`.
- **Pas d'enregistrement.** La boucle est écrite événement par événement ;
  nous ne capturons pas de jeu libre pour le couper.

---

## 5. Ce que nous attendons comme livraison

### 5.1 Le format

Deux options, au choix :

- **Une session JSON** (le format `thin-air-session/1`) : c'est la voie la plus
  directe. Le gabarit **`takes/pieces/modele-commande.json`** est un exemple
  minimal et valide — une couche, quatre mesures — que vous recopiez et
  remplacez. Tous les événements sont dans le fichier ; rien n'est caché.
- **Une partition** (portée + tempo + instruments + intentions) : nous la
  transcrivons en session, nous vous renvoyons le fichier pour relecture, et
  nous ne validons qu'après votre accord.

### 5.2 Les contraintes que la machine vérifie

Le script de commande refuse une session qui sort de ces bornes, et dit
pourquoi :

| Contrainte | Valeur |
|---|---|
| Tempo | **60 à 140** battements par minute |
| Longueur | **1, 2 ou 4** mesures (une boucle) |
| Temps par mesure | 4 conseillé (`beatsPerBar` libre dans le format) |
| Couches | **6 au plus**, une couche par instrument |
| Événements par couche | **au moins un** : une couche muette n'est pas livrable |
| Instants | dans un seul tour de boucle (`t` < longueur de la boucle) |
| Types d'événements | `noteOn` (t, voice, midi, velocity), `noteOff` (t, voice), `control` (t, voice, param, value) |
| `param` de `control` | `pitch`, `gain`, `cutoff` ou `vibrato` |
| `velocity` | de 0 à 1 |
| Hauteurs (`midi`) | dans la gamme de l'instrument de la couche |
| `settings` | **ne pas y toucher** : il règle le gain général, le plafond, la réverbération |

### 5.3 La durée visée

**Une à trois minutes.** La pièce est une boucle courte (1, 2 ou 4 mesures)
répétée ; le nombre de répétitions est calculé au rendu pour tenir la durée.
Une pièce qui dure 64 secondes est un bon format : c'est celui de la démo.

### 5.4 Comment vérifier votre pièce, vous-même

```bash
npx tsx apps/bench/src/oeuvre.ts --session votre-piece.json
```

Le script écrit un WAV dans `out/oeuvre-<nom>.wav` (dossier ignoré par git,
jamais versionné) et un rapport `out/oeuvre-<nom>.report.json` : durée exacte
en échantillons, crête en dB (plafond −1 dB), voix simultanées maximales,
notes par couche, et la liste des refus s'il y en a. **Ce rapport est ce que
nous vous renvoyons** : c'est la preuve, sans oreille, que votre pièce est
jouable et dans les bornes. Un exemple rempli est dans
[`oeuvre-rapport-modele.md`](oeuvre-rapport-modele.md).

---

## 6. Ce que nous rendons en échange

- **Le crédit.** Votre nom dans le README du projet, dans la documentation de
  l'œuvre, et dans la vidéo de démonstration. Nous écrivons la mention que
  vous validatez.
- **Une licence pour l'œuvre.** Nous demandons le droit de **reproduire,
  publier et diffuser l'enregistrement** de votre pièce — vidéo de
  démonstration, billet de blog, soumission au concours — **avec le crédit
  de votre nom**. La paternité reste la vôtre : nous ne revendiquons rien sur
  la composition. Nous proposons **CC BY 4.0** ; toute autre licence qui
  autorise ces usages se discute.
- **La fabrication.** Nous rendons, mesurons, intégrons et filmons. Vous
  n'avez pas à toucher au code.

---

## 7. Le calendrier (en jours ouvrés, depuis l'envoi de ce dossier)

| Jour | Étape | Qui fait quoi |
|---|---|---|
| J+0 | envoi de ce dossier, du gabarit et du script de vérification | nous |
| J+5 | vos questions, premier jet (une mesure suffit pour caler le rendu) | vous |
| J+12 | livraison complète (session ou partition) | vous |
| J+17 | validation : rendu hors ligne, rapport de mesures, corrections si un écart | nous, vous relisez |
| J+21 | intégration dans la démo, montage de la vidéo, séance d'écoute | nous et une oreille humaine |

L'écoute finale est faite par une personne : l'outil mesure, il n'écoute pas.
Comptez une séance d'écoute d'une demi-heure à la fin, et dites-nous ce que
vous entendez.

---

## 8. Qui fait quoi

- **Vous** : la musique. La forme, les hauteurs, les dynames, le silence.
- **Nous** : la transcription si vous livrez une partition, le rendu, la
  mesure, l'intégration dans la scène, la vidéo.
- **Baptiste** : l'arbitrage final, l'écoute, et toute publication.

Une question ? Écrivez avant d'écrire la pièce : une mesure de test vous
économisera une semaine.
