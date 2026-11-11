# Modules audio (`AudioWorklet`)

Le moteur de corde pincée vit ici, en module audio à part : dans le graphe
ordinaire du navigateur, un retard pris dans une boucle ne descend pas sous un
bloc de 128 échantillons (2,67 ms), donc aucune note au-dessus de 375 Hz
(cahier §7.9). Le calcul est le même que `../dsp/engines.ts` — un seul
algorithme, deux habillages (hors ligne pour la preuve, module audio pour le
jeu direct).

Aucun fichier sonore n'est embarqué : tout est synthétisé (AIR-F-25).
