# Méthode des agents — un quota, un registre, un coût

Un lot est mené par plusieurs agents qui travaillent en parallèle. Cette page
décrit comment on les limite, comment on les suit, et ce qu'on fait quand l'un
d'eux cale. C'est la règle du chantier, écrite une fois : chaque lot s'y réfère
au lieu de la réinventer.

Le registre qui matérialise cette méthode vit dans `out/agents.json` (fichier
ignoré par git, recopié à la main si l'API manque — voir
`docs/registre-agents-modele.md`). Le script `scripts/registre-agents.mjs` le
relit et en tire un tableau Markdown.

## 1. Le quota d'agents simultanés

**Un lot ne lance jamais plus de deux agents en parallèle.** Le quota porte un
nom — `deux-par-lot` — pour qu'un dépassement se dise en une phrase, et une
raison pour qu'il ne devienne pas un chiffre magique :

- chaque agent écrit dans son propre worktree ; relire deux diff en même temps
  est déjà le maximum qu'un humain tient sans égarer des décisions ;
- un agent est là pour délester la lecture, pas pour en créer une troisième ;
- au-delà de deux, les agents marchent sur les mêmes fichiers (`docs/CONTRACT.md`
  interdit qu'un lot touche à ceux d'un autre) et les conflits deviennent le
  travail lui-même.

Un lot qui dépasserait ce quota ne se lance pas : il se coupe en lots plus
petits, ou il attend la libération d'une place. Le quota se vérifie en lisant
le registre avant de lancer un nouvel agent.

## 2. Le lot se coupe avant de lancer

Un lot de **plus de quatre fichiers** ne part pas tel quel. On le coupe en
sous-lots d'au plus quatre fichiers, chacun confié à un agent, avant le premier
lancement. La raison est la même que celle du quota : quatre fichiers, c'est la
taille qu'un diff relit d'un coup ; au-delà, on ne découpe plus le travail, on
l'empile.

La règle s'applique **avant** de lancer un agent, pas après coup : un agent qui
reçoit un lot déjà trop gros n'est pas en mesure de le corriger en route.

## 3. Chaque agent reçoit un critère de succès écrit

Un agent part toujours avec :

- un **critère de succès écrit** — une phrase vérifiable, pas une intention
  (« le script `scripts/registre-agents.mjs` lit `out/agents.json` et produit
  les quatre sections du tableau » plutôt que « fais un registre ») ;
- **l'interdiction de merger** — un agent écrit et teste, il ne merge jamais ;
  le merge revient à celui qui a lancé le lot, seul face à la CI verte ;
- la liste exacte de ses fichiers, pour qu'il ne touche pas à ceux d'un autre ;
- une borne de temps, au-delà de laquelle il s'arrête et rend ce qu'il a.

## 4. Un agent qui ne produit rien est abandonné

Un agent qui n'a produit **aucun commit en 15 minutes** est abandonné. C'est
dans la note de l'abandon que ça se voit — le registre porte le statut
`abandonne` et la raison, par exemple « fournisseur figé », « attend un fichier
qui n'arrive pas ». L'abandon n'est pas un échec muet : il est **signalé** dans
le compte rendu du lot, à côté du temps qu'il a coûté.

Un travail abandonné se reprend soit par un autre agent, soit à la main. La
reprise manuelle est une chose à part, comptée à part : le statut `repris_main`
et le champ `reprise_minutes` le disent sans que le tableau le mélange avec le
travail d'un agent.

## 5. Le coût est noté

Le coût d'un lot, c'est son **temps** — le temps de travail cumulé des agents
et le temps de reprise manuelle quand un humain a repris la main. Les deux sont
écrits dans le registre, puis additionnés par `scripts/registre-agents.mjs` dans
la section « Coût cumulé ». Rien ne s'invente : le temps vient des horodatages
`debut` / `fin`, jamais d'une estimation verbale.

Un lot rendu sans ce tableau n'est pas rendu : sans coût, on ne peut pas dire
si découper en agents a gagné du temps ou en a perdu.

## 6. Le fournisseur qui fige, et son repli

Le fournisseur de texte peut figer : l'appel ne répond plus, et l'agent reste
suspendu à l'attendre. Deux garde-fous, et c'est tout :

- un agent qui fige **plus de 15 minutes sans produire** tombe sous la règle 4 :
  il est abandonné et signalé ;
- le fournisseur fautif est **documenté** — son nom dans la note de l'abandon,
  le repli écrit dans le compte rendu.

Le repli, dans l'ordre : réessayer une fois avec le même fournisseur ; passer
au fournisseur de repli ; reprendre le fichier à la main. Le registre ne
décide pas du repli, il le rend visible : la note d'abandon est l'endroit où
le fournisseur fautif est nommé.

## Où tout cela vit

| Artifact | Fichier | Rôle |
| --- | --- | --- |
| La méthode | `docs/methode-agents.md` | ce document |
| Le registre | `out/agents.json` | qui travaille sur quoi, depuis quand, à quel coût |
| Le modèle à la main | `docs/registre-agents-modele.md` | comment remplir le registre sans API |
| Le tableau | `scripts/registre-agents.mjs` | le registre relu en Markdown |
| Le banc | `scripts/registre-agents.test.ts` | les fixtures qui le vérifient |

Lancer le banc et le tableau :

```bash
npx vitest run --config scripts/vitest.scripts.config.ts scripts/registre-agents.test.ts
node scripts/registre-agents.mjs --markdown
```
