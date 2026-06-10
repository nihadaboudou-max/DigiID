# Module Utilisateur — Phase 1 (squelette) puis Phase 2 (complet)

Espace réservé au rôle `utilisateur`.

## Fichiers livrés en Phase 1

| Fichier     | Rôle                                                 |
| ----------- | ---------------------------------------------------- |
| `routes.py` | Tableau de bord utilisateur après connexion          |

## Fichiers à ajouter en Phase 2

| Fichier             | Rôle                                                       |
| ------------------- | ---------------------------------------------------------- |
| `service.py`        | Logique métier : profil, consentements, score, partage     |
| `profil.py`         | Consultation et modification du profil utilisateur         |
| `consentements.py`  | Gestion granulaire des consentements (RGPD-like)           |
| `repository.py`     | Accès base de données (séparation du métier)               |
| `schemas.py`        | Pydantic : ProfilDetail, ConsentementRequete, etc.         |
| `partage.py`        | Génération de QR code pour partager son DigiID             |

## Endpoints prévus

```
GET    /api/v1/utilisateur/profil
PATCH  /api/v1/utilisateur/profil
GET    /api/v1/utilisateur/score
GET    /api/v1/utilisateur/score/historique
GET    /api/v1/utilisateur/score/facteurs
POST   /api/v1/utilisateur/partage/qr-code
GET    /api/v1/utilisateur/consentements
PATCH  /api/v1/utilisateur/consentements/{categorie}
DELETE /api/v1/utilisateur/compte     # suppression définitive (droit à l'oubli)
GET    /api/v1/utilisateur/export     # export de toutes ses données (portabilité)
```
