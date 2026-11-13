# Le rapport de défaut en un clic

Quand quelque chose cloche (« la note vient trop tard », « une note reste
coincée », « le fantôme ne suit pas »), le cahier demande une seule chose :
**envoie-moi la prise** (§7.11). Ce rapport est la forme automatisée de cet
envoi : une commande qui rassemble, dans **un seul fichier JSON auto-suffisant**,
tout ce qu'il faut pour comprendre et rejouer le défaut — sans image, sans son,
sans donnée personnelle.

## Ce que contient le fichier

| Clé | Contenu |
|---|---|
| `prise` | la prise : le flux des points des mains, rien d'autre (AIR-F-47) |
| `instrument` | l'instrument joué |
| `reglages` | les réglages effectifs (défauts + instrument + options) |
| `rapport` | le rapport de rendu : le même que `report.json` du banc |
| `retard` | les mesures de retard (§5.1) : cadence, décalage des notes, extinction |
| `version` | le commit du dépôt |
| `date` | la date d'écriture, en UTC |
| `rejeu` | la commande qui reproduit le fichier à l'identique |
| `resume` | un résumé en clair, lisible par un humain |

Le fichier se **relit** : un lecteur le revérifie avec les schémas existants
(prise, instrument, rapport de rendu), et refuse en entier tout fichier qui
porterait une clé de plus qu'attendu.

## Pour l'utilisateur — comment l'obtenir

1. Sur la page, enregistrez la prise qui produit le défaut
   (`?record=1`, puis « Télécharger la prise » — elle reste sur l'appareil,
   AIR-F-47), ou récupérez une prise déjà enregistrée.
2. Lancez, à la racine du dépôt :

   ```bash
   npx tsx scripts/rapport-defaut.mjs \
     --prise <prise.json> --instrument instruments/phantom.json \
     --out out/rapport-defaut
   ```

   `--settings <fichier>` est optionnel, pour figer des réglages précis.
3. Joignez **le fichier** `out/rapport-defaut/rapport-defaut.json` au rapport
   de défaut (une issue, un ticket, une conversation). Il n'y a rien d'autre à
   joindre : la prise, l'instrument, les réglages et le rendu sont dedans.

Ce que le rapport ne contient **jamais** : aucune image, aucun extrait sonore,
aucun chemin absolu, aucun nom, aucune adresse. Les chemins sont relatifs au
dépôt (le nom du fichier seul hors du dépôt). La prise reste une donnée
corporelle (§7.11) : vous ne transmettez que les points des mains, volontairement.

## Pour le mainteneur — du rapport à la correction

1. **Rejouer.** La commande `rejeu` écrite dans le fichier reproduit le rapport
   à l'identique, hors la date :

   ```bash
   npx tsx scripts/rapport-defaut.mjs --prise <prise> --instrument <instrument> --out <dossier>
   ```

2. **Comprendre.** Le `resume` dit l'essentiel ; `rapport` porte la justesse
   (cents), la crête, le niveau moyen, le silence final ; `retard` porte la
   cadence réelle de la prise, le décalage des notes et l'extinction du son.

3. **Comparer.** Extrayez `rapport` et passez-le au banc contre une prise de
   référence, comme le fait la CI :

   ```bash
   npx tsx apps/bench/src/cli.ts compare <rapport.json> <reference.json>
   ```

4. **Transformer en prise de référence.** Une fois le défaut compris, figez la
   prise rejouable dans `takes/reference/` (elle ne contient que des points,
   elle est donc versionnable sans réserve) et ajoutez la mesure attendue à la
   recette (§18), pour que la correction soit garantie à chaque exécution.

5. **Corriger.** Ouvrez une PR de correctif qui porte la prise de référence, le
   test qui échoue, puis le changement qui le fait passer — dans cet ordre, pour
   que le correctif soit une preuve, pas une affirmation.

## Vérifications

Le rapport est couvert par un test (`apps/bench/src/rapport-defaut.test.ts`)
qui vérifie, à chaque exécution, qu'il se relit, qu'il porte les clés attendues,
qu'il ne contient ni image ni donnée personnelle (clé par clé), et qu'un rejeu
donne le même rapport.
