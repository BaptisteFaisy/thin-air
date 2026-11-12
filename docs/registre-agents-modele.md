# Modèle de registre — à remplir à la main quand l'API manque

`scripts/registre-agents.mjs` attend son registre dans `out/agents.json`. Quand
aucune API ne l'écrit à notre place, on le recopie à la main à partir de ce
modèle. Le fichier est ignoré par git (`out/`), donc chacun peut le tenir sans
le valider ; ce qui compte, c'est qu'il soit rempli d'après des faits — jamais
d'estimations verbales à la place des horodatages.

## Le squelette à recopier

```json
{
  "quota": {
    "nom": "deux-par-lot",
    "simultanes": 2,
    "raison": "Deux agents suffisent à garder un worktree lisible par un humain."
  },
  "agents": [
    {
      "nom": "<nom-de-l-agent>",
      "lot": "<nom-du-lot>",
      "fichiers": ["<chemin>", "<chemin>"],
      "debut": "<ISO 8601>",
      "fin": null,
      "statut": "en_cours",
      "commits": [],
      "note": "",
      "reprise_minutes": null
    }
  ]
}
```

## Les champs

| Champ | Type | Obligatoire | Sens |
| --- | --- | --- | --- |
| `quota.nom` | texte | oui | le nom du quota, en une phrase qui se cite |
| `quota.simultanes` | nombre | oui | le plafond d'agents simultanés |
| `quota.raison` | texte | non | pourquoi ce plafond — il n'est jamais magique |
| `nom` | texte | oui | qui est cet agent |
| `lot` | texte | oui | quel lot il sert |
| `fichiers` | liste de textes | oui | ce qu'il a le droit de toucher |
| `debut` | date ISO | oui | quand il a commencé |
| `fin` | date ISO ou `null` | non | quand il a fini ; `null` tant qu'il tourne |
| `statut` | texte | oui | `en_cours`, `termine`, `abandonne` ou `repris_main` |
| `commits` | liste de textes | oui | les empreintes qu'il a produites |
| `note` | texte | non | la raison d'un abandon, le nom du fournisseur fautif |
| `reprise_minutes` | nombre ou `null` | non | le temps humain, seulement si `repris_main` |

## Les quatre statuts

| Statut | Quand l'écrire |
| --- | --- |
| `en_cours` | l'agent travaille ; `fin` reste `null` |
| `termine` | l'agent a fini, ses commits sont écrits |
| `abandonne` | l'agent n'a rien produit en 15 minutes ; la `note` dit pourquoi |
| `repris_main` | un humain a repris le fichier ; `reprise_minutes` dit combien de temps |

## Leçon d'écriture

Le registre dénombre, il ne raconte pas : un horodatage plutôt qu'un « ça a
pris un moment », un nombre de minutes plutôt qu'un « longtemps », une empreinte
de commit plutôt qu'un « c'est bon j'ai fini ». C'est la seule façon dont le
« Coût cumulé » de `scripts/registre-agents.mjs` reste vrai.

## Exemple rempli

```json
{
  "quota": {
    "nom": "deux-par-lot",
    "simultanes": 2,
    "raison": "Deux agents suffisent à garder un worktree lisible par un humain."
  },
  "agents": [
    {
      "nom": "registre-agents",
      "lot": "lot/registre-agents",
      "fichiers": ["scripts/registre-agents.mjs", "scripts/registre-agents.test.ts"],
      "debut": "2026-11-12T09:00:00Z",
      "fin": "2026-11-12T09:40:00Z",
      "statut": "termine",
      "commits": ["abc1234"],
      "note": "quatre fichiers livrés",
      "reprise_minutes": null
    },
    {
      "nom": "vision-fige",
      "lot": "lot/vision",
      "fichiers": ["packages/vision/src/index.ts"],
      "debut": "2026-11-12T09:10:00Z",
      "fin": "2026-11-12T09:25:00Z",
      "statut": "abandonne",
      "commits": [],
      "note": "aucun commit en 15 min, fournisseur figé",
      "reprise_minutes": null
    },
    {
      "nom": "schema-reprise",
      "lot": "lot/schema",
      "fichiers": ["packages/schema/src/index.ts"],
      "debut": "2026-11-12T09:15:00Z",
      "fin": "2026-11-12T10:05:00Z",
      "statut": "repris_main",
      "commits": ["def5678"],
      "note": "repris à la main après l'abandon",
      "reprise_minutes": 20
    }
  ]
}
```

Une fois le registre rempli, le tableau se régénère :

```bash
node scripts/registre-agents.mjs --markdown
```