# Module Administrateur — Phase 1 (squelette) puis Phase 2 (complet)

Espace réservé au rôle `administrateur` (et au-dessus).

## Fichiers livrés en Phase 1

| Fichier     | Rôle                                              |
| ----------- | ------------------------------------------------- |
| `routes.py` | Tableau de bord agrégé : compteurs et statistiques |

## Fichiers à ajouter en Phase 2

| Fichier            | Rôle                                                          |
| ------------------ | ------------------------------------------------------------- |
| `service.py`       | Logique métier : suspension, alertes, gestion utilisateurs    |
| `gestion_utilisateurs.py` | CRUD utilisateurs (vue admin, pseudonymisée)           |
| `gestion_alertes.py` | Liste, traitement, résolution des alertes                   |
| `statistiques.py`  | Génération de rapports agrégés (jour/semaine/mois)            |
| `schemas.py`       | Pydantic : ReponseUtilisateurAdmin, AlerteFiltre, etc.        |

## Principe d'isolation

L'admin ne voit JAMAIS les données personnelles brutes des utilisateurs :
- Email : seul le domaine ou un hash partiel est visible
- Nom/prénom : remplacés par les initiales
- Téléphone : caché
- Adresse : ville uniquement

Pour voir les données brutes, il faut une demande motivée tracée dans le
journal d'audit ET le rôle super administrateur.
