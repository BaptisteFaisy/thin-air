# Modèle de récapitulatif quotidien

Le récapitulatif d'une journée tient sur un écran et répond à cinq questions,
dans le même ordre tous les jours :

1. **Ce qui a avancé** — les PR mergées, les mesures faites, les défauts
   corrigés. Ce qui est terminé et vérifié.
2. **Ce qui est resté bloqué** — ce qui attend quelqu'un : une décision, une
   lecture, une séance, une dépendance. Un blocage écrit est un blocage qui
   ne disparaît pas tout seul.
3. **Ce qui a coûté cher** — le temps perdu, les reprises manuelles d'agents,
   les exécutions de CI à relancer, les fichiers réécrits trois fois.
4. **Ce qu'il faut faire demain** — la liste de reprise : une PR à finir, un
   point à trancher, une mesure à refaire.
5. **Risques** — ce qui peut casser : une preuve qui manque, une licence qui
   n'est pas établie, une régression qui pourrait passer inaperçue.

## Le fichier produit par le script

`scripts/recap.mjs` écrit `docs/recap-<AAAA-MM-JJ>.md` :

```sh
node scripts/recap.mjs            # la journée du jour
node scripts/recap.mjs --date 2026-11-11
node scripts/recap.mjs --hors-ligne   # sans GitHub : les sources sont notées « indisponible »
```

Les sources sont les PR mergées et les exécutions de la CI (par la CLI `gh`),
le journal de bord (`docs/journal.md`) et le rapport d'audit
(`docs/audit-rapport.md`). Le réseau n'est jamais obligatoire : quand `gh` est
absent ou muet, la source est notée « indisponible » dans le récapitulatif, et
le reste est écrit quand même.

## Le modèle à remplir à la main

Quand l'API manque — ou quand le script ne produit pas un récapitulatif
utile — on copie ce modèle dans `docs/recap-<AAAA-MM-JJ>.md` et on le remplit.
Une puce par fait, daté, vérifiable : pas de « ça a bien avancé ».

```markdown
# Récapitulatif du <AAAA-MM-JJ> (<jour de la semaine>)

## 1. Ce qui a avancé

- <ce qui est terminé et vérifié>

## 2. Ce qui est resté bloqué

- <ce qui attend quelqu'un, et qui>

## 3. Ce qui a coûté cher

- <temps perdu, reprises, fichiers réécrits>

## 4. Ce qu'il faut faire demain

- <la liste de reprise, dans l'ordre>

## 5. Risques

- <ce qui peut casser, et ce qui le rendrait visible>
```

## Les règles de rédaction

- **Un fait, une puce.** Si la puce contient « et », c'est deux puces.
- **Une source par fait** : le numéro de PR, le nom du fichier, la commande
  qui a produit la mesure. Un fait sans source n'est pas un fait, c'est une
  impression.
- **Les chiffres sont mesurés**, jamais estimés : « 23 reprises de CI en
  échec », pas « beaucoup de reprises ».
- **Un blocage nomme qui attend quoi**, sinon il traîne.
- **Une décision d'écart avec le cahier** va aussi dans le journal de bord
  (`docs/journal.md`), pas seulement ici.
- **Le récapitulatif ne remplace pas la recette** : ce qui n'a pas été
  écouté avec des personnes reste « non prouvé », ici comme dans
  `docs/audit-rapport.md`.
