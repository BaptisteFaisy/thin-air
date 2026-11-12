# Inventaire — worktrees, branches mortes et runners protégés

État consolidé du dépôt `Tradoooo/thin-air` (renommé depuis
`BaptisteFaisy/thin-air` le 12 novembre 2026), produit par
`node scripts/inventaire.mjs`. Le script constate, il ne supprime rien : le
plan de nettoyage en fin de rapport est une **proposition**, jamais une
commande exécutée.

## La règle

1. **Aucun dossier de runner ne vit dans un worktree.** Un worktree est un
   espace jetable : la CI y exécute `git clean -ffdx`, et tout ce qui n'est
   pas versionné disparaît. Un `actions-runner-*` (ou son `_work*`) abandonné
   dans un worktree est un runner en sursis — c'est exactement le geste qui a
   coûté deux runners le 12 novembre (constat, règle et réinscription dans
   `docs/runners.md`). Le script signale tout worktree qui en contient un, et
   sort alors en 1.

2. **Un worktree d'agent est supprimé après le merge de sa branche.** Un
   worktree n'est pas un stockage : c'est l'échafaudage d'un lot. Une fois sa
   branche fusionnée dans `main`, il devient une copie morte qui s'accumule
   (59 worktrees au 12 novembre). Après le merge, dans cet ordre :
   `git worktree remove <chemin>`, puis `git branch -d lot/<nom>` ; jamais
   l'inverse, et jamais sans avoir relu `node scripts/inventaire.mjs` pour
   repérer un dossier orphelin laissé derrière.

## Le rapport du jour

Sortie réelle de `node scripts/inventaire.mjs`, relancée le 12 novembre 2026 :

```text
# Inventaire du dépôt — 2026-11-12

worktrees enregistrés : 59 (+ le principal)
branches distantes : 72 (dont 0 merge-queue, éphémères)
branches non mergées dans origin/main : 71
worktrees orphelins : 0

## Worktrees

chemin                branche                   commit              modifié  taille   note
audit-depot           lot/audit-depot           1a0b78f 2026-11-12  oui      3.1 Mo   modifié
budget-ci             lot/budget-ci             d2fc5cb 2026-11-12  non      3.0 Mo
cam-live              lot/cam-live              627913b 2026-11-12  non      3.0 Mo
camera-live-controls  lot/camera-live-controls  c033b36 2026-11-12  non      3.9 Mo
contrat-api           lot/contrat-api           cae5d34 2026-11-12  non      4.2 Mo
deploiement-garanti   lot/deploiement-garanti   cdbec9a 2026-11-12  oui      3.0 Mo   modifié
e2e-fix               lot/e2e-fix               0a02a19 2026-11-12  non      50.6 Mo  modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, public/models/, public/models/hand_landmarker.task, public/models/wasm/vision_wasm_internal.wasm
features              lot/features              869a4cc 2026-11-12  non      3.0 Mo
horodatage            lot/horodatage            4bf04ed 2026-11-12  non      4.2 Mo
hors-ligne-public     lot/hors-ligne-public     ced68f1 2026-11-12  oui      29.1 Mo  modifié ; modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm
inventaire            lot/inventaire            c22e849 2026-11-12  oui      3.2 Mo   modifié
isolation-runner      lot/isolation-runner      2783d09 2026-11-12  non      3.0 Mo
moteur-tiers          lot/moteur-tiers          cdbec9a 2026-11-12  oui      3.2 Mo   modifié
n1-licence            lot/n1-licence            efb47f1 2026-11-11  non      2.2 Mo
n2-a11y               lot/n2-a11y               a099ac0 2026-11-11  non      6.1 Mo
n3-poids              lot/n3-poids              15850bb 2026-11-11  non      49.5 Mo  modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, public/models/, public/models/hand_landmarker.task, public/models/wasm/vision_wasm_internal.wasm
n4-offline            lot/n4-offline            0bcfff6 2026-11-11  non      78.0 Mo  modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, public/models/, public/models/hand_landmarker.task, public/models/wasm/vision_wasm_internal.wasm
n5-galerie            lot/n5-galerie            10025b4 2026-11-11  non      2.8 Mo
n6-worker             lot/n6-worker-web         a31ed38 2026-11-12  non      3.7 Mo
n7-prises             lot/n7-prises             0c88b18 2026-11-11  non      2.2 Mo
n8-soumission         lot/n8-soumission         bf899ff 2026-11-11  non      2.6 Mo
pas-ce-que            lot/pas-ce-que            c22e849 2026-11-12  non      4.1 Mo
preuves               lot/preuves               1a0b78f 2026-11-12  oui      80.5 Mo  modifié ; modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, apps/web/out/dist/models/hand_landmarker.task, apps/web/out/dist/models/wasm/vision_wasm_internal.wasm
quotidien-format      lot/quotidien-format      d49ac73 2026-11-12  oui      4.2 Mo   modifié
raccourcis            lot/raccourcis            c22e849 2026-11-12  non      3.2 Mo
rapport-defaut        lot/rapport-defaut        5475955 2026-11-12  non      3.0 Mo
registre-agents       lot/registre-agents       e58ef71 2026-11-12  non      4.3 Mo
release               lot/release               d1516b1 2026-11-12  non      4.3 Mo
t1-worker             lot/t1-worker             3c5abfe 2026-11-11  non      2.8 Mo
t2-lib                lot/t2-lib                2ad7080 2026-11-11  non      2.2 Mo
t3-registre           lot/t3-registre           f8f63ce 2026-11-12  non      2.2 Mo
t4-mobilite           lot/t4-mobilite           9d507f2 2026-11-11  non      2.9 Mo
t5-lecons             lot/t5-lecons             7a14ca6 2026-11-12  non      2.2 Mo
t6-fuzz               lot/t6-fuzz               5733536 2026-11-11  non      2.2 Mo
t7-kiosque            lot/t7-kiosque            4dfcee8 2026-11-11  non      2.8 Mo
t8-lien-prise         lot/t8-lien-prise         41f06d6 2026-11-11  non      2.2 Mo
ui-lecons             lot/ui-lecons             87b8d79 2026-11-12  non      3.7 Mo
ui-lecons-data        lot/ui-lecons-data        8a94a5c 2026-11-12  non      3.8 Mo
ui-montage            lot/ui-montage            b2e3ebb 2026-11-12  non      3.8 Mo
v10-oeuvre            lot/v10-oeuvre            ff37dd6 2026-11-12  non      8.5 Mo
v3-poids              lot/v3-poids              db4510a 2026-11-12  non      46.8 Mo  modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, public/models/, public/models/hand_landmarker.task, public/models/wasm/vision_wasm_internal.wasm
v4-publier            lot/v4-publier            bf26338 2026-11-12  non      2.6 Mo
v5-audit              lot/v5-audit              9116cd4 2026-11-12  non      2.6 Mo
v6-horloges           lot/v6-horloges           03864a8 2026-11-12  non      3.4 Mo
v7-compensation       lot/v7-compensation       43df604 2026-11-12  non      2.6 Mo
v8-postmortem         lot/v8-postmortem         0e09096 2026-11-12  non      2.6 Mo
v9-sonde              lot/v9-sonde              be8c143 2026-11-12  non      2.6 Mo
variants-wasm         lot/variants-wasm         1a0b78f 2026-11-12  oui      47.3 Mo  modifié ; modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, public/models/, public/models/hand_landmarker.task, public/models/wasm/vision_wasm_internal.wasm
versions-formats      lot/versions-formats      aeed0e8 2026-11-12  non      3.0 Mo
w1-mcp                lot/w1-mcp                35b14ac 2026-11-11  non      2.2 Mo
w10-piece             lot/w10-piece             007f21c 2026-11-11  non      8.1 Mo
w2-luthier            lot/w2-luthier            a23595a 2026-11-11  non      2.2 Mo
w3-gallery            lot/w3-gallery            4057f23 2026-11-11  non      2.1 Mo
w4-e2e                lot/w4-e2e                95a5601 2026-11-11  non      78.0 Mo  modèle: apps/web/dist/models/hand_landmarker.task, apps/web/dist/models/wasm/vision_wasm_internal.wasm, public/models/, public/models/hand_landmarker.task, public/models/wasm/vision_wasm_internal.wasm
w5-a11y               lot/w5-a11y               4057f23 2026-11-11  non      2.1 Mo
w6-golden             lot/w6-golden             4e93936 2026-11-11  oui      2.1 Mo   modifié
w7-tuning             lot/w7-tuning             b1bb582 2026-11-11  non      2.1 Mo
w8-twoclocks          lot/w8-twoclocks          44b62e3 2026-11-11  non      2.2 Mo
w9-latency            lot/w9-latency            d02e92e 2026-11-11  non      3.0 Mo

## Branches distantes

branche                     commit   date        mergée  non mergés
ci/inferhub-conflit         2b44163  2026-11-11  non     3         
gh-pages                    03ee91e  2026-11-12  non     1         
lot/a1-space                25073a1  2026-11-11  non     1         
lot/a2-filter               340c80c  2026-11-11  non     2         
lot/a3-music                3bb56d1  2026-11-11  non     1         
lot/a4-schema               f99d5d7  2026-11-11  non     1         
lot/a5-audio                2350f3a  2026-11-11  non     2         
lot/a6-loop-midi            00a3561  2026-11-11  non     4         
lot/a7-kiro-instruments     9cd60bf  2026-11-11  non     4         
lot/a8-docs-build           378ff67  2026-11-11  non     6         
lot/a9-audio-live           bd73175  2026-11-11  non     2         
lot/b1a-takegen             16d3d4a  2026-11-11  non     1         
lot/b1b-gestures            045d95a  2026-11-11  non     1         
lot/b2-instrument-pipeline  1110f46  2026-11-11  non     4         
lot/b3-bench                df138c2  2026-11-11  non     4         
lot/b4-web                  a508881  2026-11-11  non     2         
lot/b5-vision               3c42618  2026-11-11  non     2         
lot/budget-ci               d2fc5cb  2026-11-12  non     2         
lot/cam-live                627913b  2026-11-12  non     2         
lot/camera-live-controls    c033b36  2026-11-12  non     1         
lot/contrat-api             cae5d34  2026-11-12  non     1         
lot/e2e-fix                 0a02a19  2026-11-12  non     1         
lot/horodatage              4bf04ed  2026-11-12  non     1         
lot/integr-deploy           799bab2  2026-11-11  non     1         
lot/integr-dist-check       28bd813  2026-11-11  non     1         
lot/integr-outillage        26d6a8d  2026-11-11  non     2         
lot/integr-recette          682104c  2026-11-11  non     1         
lot/integr-takes-compact    1fdf89d  2026-11-11  non     1         
lot/isolation-runner        2783d09  2026-11-12  non     2         
lot/n1-licence              efb47f1  2026-11-11  non     1         
lot/n2-a11y                 fd35714  2026-11-11  non     4         
lot/n3-poids                15850bb  2026-11-11  non     2         
lot/n4-offline              0bcfff6  2026-11-11  non     3         
lot/n5-galerie              10025b4  2026-11-11  non     2         
lot/n6-worker               10af47d  2026-11-11  non     1         
lot/n6-worker-web           a31ed38  2026-11-12  non     1         
lot/n7-prises               0c88b18  2026-11-11  non     1         
lot/n8-soumission           bf899ff  2026-11-11  non     2         
lot/quotidien-format        d49ac73  2026-11-12  non     1         
lot/rapport-defaut          5475955  2026-11-12  non     1         
lot/registre-agents         e58ef71  2026-11-12  non     1         
lot/release                 d1516b1  2026-11-12  non     2         
lot/t1-worker               3c5abfe  2026-11-11  non     1         
lot/t2-lib                  2ad7080  2026-11-11  non     1         
lot/t3-registre             f8f63ce  2026-11-12  non     2         
lot/t4-mobilite             9d507f2  2026-11-11  non     1         
lot/t5-lecons               7a14ca6  2026-11-12  non     1         
lot/t6-fuzz                 d1a78f4  2026-11-12  non     2         
lot/t7-kiosque              4dfcee8  2026-11-11  non     1         
lot/t8-lien-prise           41f06d6  2026-11-11  non     2         
lot/ui-lecons               87b8d79  2026-11-12  non     1         
lot/ui-lecons-data          8a94a5c  2026-11-12  non     4         
lot/ui-montage              b2e3ebb  2026-11-12  non     1         
lot/v10-oeuvre              ff37dd6  2026-11-12  non     2         
lot/v3-poids                db4510a  2026-11-12  non     4         
lot/v4-publier              bf26338  2026-11-12  non     2         
lot/v5-audit                9116cd4  2026-11-12  non     1         
lot/v6-horloges             03864a8  2026-11-12  non     1         
lot/v7-compensation         43df604  2026-11-12  non     3         
lot/v8-postmortem           0e09096  2026-11-12  non     1         
lot/v9-sonde                be8c143  2026-11-12  non     4         
lot/versions-formats        aeed0e8  2026-11-12  non     1         
lot/w1-mcp                  35b14ac  2026-11-11  non     2         
lot/w10-piece               007f21c  2026-11-11  non     6         
lot/w10-piece-doc-humain    9248875  2026-11-12  non     1         
lot/w11-kit                 d45c6c2  2026-11-11  non     3         
lot/w2-luthier              f7e0678  2026-11-11  non     2         
lot/w4-e2e                  95a5601  2026-11-11  non     2         
lot/w7-tuning               aac1208  2026-11-12  non     1         
lot/w8-twoclocks            44b62e3  2026-11-11  non     4         
lot/w9-latency              d02e92e  2026-11-11  non     3         
main                        c22e849  2026-11-12  oui     0         


## Worktrees orphelins

aucun

## Plan de nettoyage (propositions, aucune suppression automatique)

cible                         action       raison                                            
worktree audit-depot          à inspecter  branche lot/audit-depot absente du distant        
worktree deploiement-garanti  à inspecter  branche lot/deploiement-garanti absente du distant
worktree features             à inspecter  branche lot/features absente du distant           
worktree hors-ligne-public    à inspecter  branche lot/hors-ligne-public absente du distant  
worktree inventaire           à inspecter  branche lot/inventaire absente du distant         
worktree moteur-tiers         à inspecter  branche lot/moteur-tiers absente du distant       
worktree pas-ce-que           à inspecter  branche lot/pas-ce-que absente du distant         
worktree preuves              à inspecter  branche lot/preuves absente du distant            
worktree raccourcis           à inspecter  branche lot/raccourcis absente du distant         
worktree variants-wasm        à inspecter  branche lot/variants-wasm absente du distant      
worktree w3-gallery           à inspecter  branche lot/w3-gallery absente du distant         
worktree w5-a11y              à inspecter  branche lot/w5-a11y absente du distant            
worktree w6-golden            à inspecter  branche lot/w6-golden absente du distant          
```
