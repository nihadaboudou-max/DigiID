# Module Super Administrateur — Phase 1 (squelette) puis Phase 2

Niveau d'accès maximal du système. Réservé à une seule personne dans
l'organisation cible.

## Fichiers livrés en Phase 1

| Fichier     | Rôle                                                  |
| ----------- | ----------------------------------------------------- |
| `routes.py` | Tableau de bord système, derniers événements d'audit  |

## Fichiers à ajouter en Phase 2

| Fichier                     | Rôle                                                |
| --------------------------- | --------------------------------------------------- |
| `service.py`                | Logique métier sensible                             |
| `gestion_administrateurs.py` | Création / suspension / rotation des admins       |
| `audit_complet.py`          | Consultation du journal d'audit complet, recherche  |
| `configuration_systeme.py`  | Modification des paramètres en ligne (feature flags) |
| `donnees_brutes.py`         | Accès aux données personnelles brutes (motivé)      |
| `sauvegardes.py`            | Déclenchement de sauvegardes manuelles              |

## Capacités exclusives

Seul le super admin peut :
- Créer un nouvel administrateur
- Suspendre un administrateur
- Consulter le journal d'audit complet (immuable)
- Accéder aux données personnelles brutes (avec motivation tracée)
- Modifier les feature flags
- Voir les métriques techniques système
- Déclencher une rotation de la clé maître de chiffrement

Toute action super admin est tracée dans le journal d'audit avec un
niveau de sensibilité maximal.
