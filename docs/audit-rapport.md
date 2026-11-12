# Rapport d'audit d'accessibilité avec des personnes

Modèle à remplir **après** l'audit. Tant qu'il est vide, il ne prouve rien :
un gabarit n'est pas une preuve. Le protocole qui l'accompagne est
`docs/audit-utilisateurs.md` ; les feuilles de résultats sont des gabarits
vides versionnés dans `scripts/audit/feuille.tsv`, et les feuilles remplies
vivent hors du dépôt (`out/audit/`).

Remplacer tous les champs `[…]`. Supprimer les sections restées vides plutôt
que de les laisser en tête. Ne jamais coller une donnée personnelle : ni nom,
ni âge, ni pathologie détaillée, ni capture d'écran contenant une personne.

---

## 1. Identification

| | |
|---|---|
| Date de l'audit | `[AAAA-MM-JJ]` |
| Version auditée | `[branche ou version testée]` |
| Protocole suivi | `docs/audit-utilisateurs.md` (version du dépôt) |
| Participants | `[nombre] séances · codes anonymes : …` |
| Observateur | `[rôle, pas de nom]` |
| Lieu | `[domicile, bureau, en ligne — pas d'adresse]` |

## 2. Ce qui a été testé

| | |
|---|---|
| Profils testés | `[assis / malvoyant / tremblement — cocher ceux qui l'ont été]` |
| Tâches testées | `[T1 mélodie · T2 instrument · T3 calibrage · T4 note · T5 retard]` |
| Configuration produit | `[profils de mobilité utilisés : seated, tremor… · mode « jouer sans caméra » : oui]` |
| Poste | `[clavier, pointeur, lecteur d'écran utilisé]` |
| Son | coupé pour l'observateur ; l'observateur ne juge pas le rendu sonore |

**Rappel de méthode** : une tâche = une tentative, sans aide. Le temps ne
décide jamais de la note. Une tâche abandonnée est notée 0 et comptée dans
`abandon`. Une note de 1 signifie « pénible », pas « raté ».

## 3. Résultats

Tableau à produire avec la synthèse (une commande, aucun copier-coller
manuel) :

```sh
node scripts/audit/synthese.mjs out/audit/*.tsv
```

| Tâche | Profil | Participants | Temps moyen (s) | Abandons | Note moyenne |
|---|---|---|---|---|---|
| `[…]` | `[…]` | `[…]` | `[…]` | `[…]` | `[…]` |

La commande refuse une feuille mal formée : si une ligne manque, le tableau
ne sort pas. C'est le comportement voulu — pas de synthèse partielle.

### 3.1 Lecture par profil

Pour chaque profil, trois phrases : ce qui a fonctionné du premier coup, ce
qui a demandé un effort, ce qui a été impossible.

- **Assis, portée courte** : `[…]`
- **Malvoyante** : `[…]`
- **Tremblement des mains** : `[…]`

### 3.2 Tâches en échec ou abandons

| Tâche | Profil | Ce qui s'est passé | Reproductible ? |
|---|---|---|---|
| `[…]` | `[…]` | `[…]` | `[oui / non / une fois sur deux]` |

## 4. Ce que l'audit automatique ne peut pas voir

`docs/accessibility-report.md` prouve que les pages ne violent aucune règle
DOM détectable par l'outil, sur les huit écrans, au niveau AA. C'est vrai,
c'est important, et c'est insuffisant : un audit automatique vérifie des
**propriétés de la page**, jamais l'**aboutissement d'une personne**.

| Ce que l'outil automatique vérifie | Ce qu'il ne peut pas voir |
|---|---|
| Nom, rôle et valeur de chaque contrôle (`aria-*`, règles `axe`) | Si la personne trouve ce contrôle sans le chercher |
| Contraste calculé des couleurs | Si la zone de jeu reste lisible quand la main la masque |
| Présence d'une description sur le canvas | Que la description est comprise, et qu'elle décrit la bonne chose |
| `lang`, hiérarchie des titres, ordre des tabulations | Si l'ordre des tabulations est celui du **raisonnement** de la personne |
| Absence de divergence de rôle (`role="status"`) | Si l'annonce arrive au bon moment, et si elle est entendue |
| Cible tactile ≥ 24 px, focus visible | Si la cible est atteignable **par cette personne**, dans sa posture |
| Absence de média automatique, de flash | Si le mouvement de la scène fatigue, même réduit |
| Bon ordre DOM des panneaux | Si l'ordre des panneaux correspond à la priorité réelle |

Autrement dit, l'outil automatique ne voit ni la **charge** d'une tâche, ni
la **découverte** de l'interface, ni le **corps** de la personne, ni le
**geste** qui fait la mélodie. Il voit des chaînes de caractères dans une
arborescence. Ces trois séances ont porté sur ce qui reste quand tout le
reste est déjà conforme.

Trois points à écrire ici, même s'ils ne sont pas des échecs :

1. `[…]`
2. `[…]`
3. `[…]`

## 5. Constats et décisions

| # | Constat | Critère WCAG touché | Gravité | Décision | Où |
|---|---|---|---|---|---|
| 1 | `[…]` | `[…]` | `[majeure / mineure / à surveiller]` | `[correctif / lancer une piste / documenté]` | `[fichier ou lot]` |
| 2 | `[…]` | `[…]` | `[…]` | `[…]` | `[…]` |

Une ligne par constat, avec la décision prise. Un constat sans décision
n'est pas un constat : c'est une remarque.

## 6. Ce qui reste non couvert

- `[…]`
- `[…]`

Par exemple : les tâches hors §12.4 (bibliothèque, export, partage de prise),
le mode multi-main, les navigateurs non testés, le mode contraste forcé de
Windows — non couverts par ce rapport.

## 7. Limites de cet audit

- Trois personnes, une séance chacune : des obstacles précis, pas une
  proportion d'utilisateurs.
- L'observateur connaît l'interface : la consigne de passation limite le
  biais, elle ne l'annule pas.
- L'interface était neuve pour chaque participant : une partie des
  difficultés est de la découverte, pas du défaut.
- Aucun chiffre de ce rapport n'est extrapolable à d'autres populations.

## 8. Suites

| Action | Responsable | Échéance | Statut |
|---|---|---|---|
| `[…]` | `[…]` | `[AAAA-MM-JJ]` | `[…]` |

## 9. Pièces jointes

| Pièce | Où |
|---|---|
| Feuilles de résultats remplies | `out/audit/` — **hors du dépôt**, non versionnées |
| Protocole suivi | `docs/audit-utilisateurs.md` |
| Grille vierge | `scripts/audit/feuille.tsv` |
| Audit automatique | `docs/accessibility-report.md` |
| Promesses produit | `docs/accessibility.md`, `docs/cahier-des-charges.md` §12.4 |
