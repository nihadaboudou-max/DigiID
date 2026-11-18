# Tables de la base logistique DigiID

Liste établie à partir des modèles déclarés dans le backend. Elle décrit le
schéma du code et ne vérifie pas l'état d'une base déployée.

## Tables principales

1. `acteurs_logistiques`
2. `arrets_ligne`
3. `bagages`
4. `colis`
5. `colis_evenements`
6. `gares`
7. `lignes`
8. `notifications_logistique`
9. `profils_logistiques`
10. `suivi_familial`
11. `suivi_familial_evenements`
12. `tickets`
13. `vehicules`
14. `voyages`

## Tables analytiques logistiques

1. `alertes_anomalies_scans_analytiques`
2. `dimension_chauffeur_analytique`
3. `dimension_date_analytique`
4. `dimension_gare_analytique`
5. `dimension_ligne_analytique`
6. `evenements_analytiques`
7. `previsions_demande_ligne_analytique`
8. `scores_confiance_chauffeurs`

## Vue matérialisée associée

- `vue_flux_par_ligne_analytique` — vue matérialisée, pas une table.
