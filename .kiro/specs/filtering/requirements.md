---
spec: filtering
parcours: "Exigences d'abord"
exigences: [AIR-F-13, AIR-F-15]
proprietes: [AIR-P-02]
sections: ["§7.5", "§5.2", "§13.2"]
---

# filtering — Exigences

**Parcours : Exigences d'abord** — les critères sont écrits et analysés avant
la conception, parce que le filtre touche à deux horloges : il lisse des
positions (continues) et ne doit pas retarder les déclenchements (§5.2).

## Critères (EARS)

- **AIR-F-13** — Le système DOIT filtrer chaque coordonnée selon §7.5 et
  fournir **un canal lissé et un canal vif**.
- **AIR-F-15** — QUAND une main n'est plus vue, le système DOIT tenir ses
  valeurs **150 ms** (`graceMs`), puis relâcher ses notes.
- **AIR-P-02** — La sortie reste entre le minimum et le maximum des entrées
  vues ; pour une entrée constante elle y converge ; aucun horodatage, même
  répété, ne produit une valeur non numérique.

## Le compromis, écrit noir sur blanc (§7.5)

Lisser fort supprime le tremblement mais fait traîner le geste ; lisser peu
fait l'inverse. Le filtre « One Euro » (Casiez, Roussel et Vogel) lisse fort
quand la main est lente et peu quand elle est rapide :

```text
vitesse        d   = (x − x_précédent) / Te
vitesse lissée d̂   = lissage(d, coupure fc_d)
coupure        fc  = fc_min + β · |d̂|
sortie         x̂   = α · x + (1 − α) · x̂_précédent,  α = 1 / (1 + 1 / (2π · fc · Te))
```

Valeurs de départ (`defaults.ts`) : `fcMin` 1,5 Hz, `beta` 5, `fcD` 1 Hz,
canal vif `fcTrigger` 6 Hz. À régler sur trois prises réelles (§7.5, annexe D).
