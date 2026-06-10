# Module Monitoring — Phase 2 (extension)

Santé du système, métriques, alertes.

## Fichiers livrés en Phase 1

| Fichier        | Statut    | Rôle                                          |
| -------------- | --------- | --------------------------------------------- |
| `routes.py`    | ✅ Livré  | Endpoints `/sante` et `/version` (publics)    |

## Fichiers à ajouter en Phase 2

| Fichier        | Rôle                                                         |
| -------------- | ------------------------------------------------------------ |
| `metriques.py` | Exposition Prometheus (req/s, latence, erreurs, scores)      |
| `taches.py`    | Configuration Celery + tâches asynchrones                    |
| `alertes.py`   | Génération et envoi d'alertes (email, webhook)               |
| `service.py`   | Logique de surveillance et déclenchement d'alertes           |
| `regles.py`    | Règles d'alerte (seuils par type d'événement)                |

## Métriques Prometheus prévues

| Métrique                       | Type      | Tags                          |
| ------------------------------ | --------- | ----------------------------- |
| `digiid_requetes_total`        | Counter   | méthode, chemin, statut       |
| `digiid_latence_requetes`      | Histogram | méthode, chemin               |
| `digiid_erreurs_total`         | Counter   | type, code                    |
| `digiid_utilisateurs_actifs`   | Gauge     | rôle                          |
| `digiid_scores_calcules`       | Counter   | -                             |
| `digiid_tentatives_intrusion`  | Counter   | type                          |

Exposition sur `/metrics` (réservé super admin).
