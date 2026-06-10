# Module Vérification Visuelle — Phase 4

Reconnaissance faciale, anti-doublon, anti-spoofing, et comparaison aux
listes officielles de personnes recherchées (sous consentement explicite).

## Fichiers prévus

| Fichier                  | Rôle                                                   |
| ------------------------ | ------------------------------------------------------ |
| `service.py`             | Orchestration de la vérification visuelle              |
| `detection_visage.py`    | Vérification qu'un visage est bien présent             |
| `embedding_facial.py`    | Génération d'un vecteur 512D via InsightFace           |
| `anti_spoofing.py`       | Détection des photos d'écran et impressions            |
| `comparaison.py`         | Comparaison d'embeddings (cosine similarity)           |
| `recherche_doublons.py`  | Recherche dans la base DigiID                          |
| `listes_recherchees.py`  | Comparaison OFAC, ONU, Interpol                        |
| `routes.py`              | Endpoints `/api/v1/utilisateur/verification/*`         |
| `schemas.py`             | Pydantic : ResultatVerification, etc.                  |

## Algorithme principal

```
1. Recevoir image utilisateur (PNG/JPEG)
2. Détecter qu'un visage est présent (sinon : refus)
3. Anti-spoofing : vérifier que ce n'est pas une photo d'écran
4. Extraire l'embedding facial 512 dimensions
5. Comparer aux embeddings DigiID existants (recherche doublon)
6. Si consentement actif : comparer aux listes officielles
7. Stocker l'embedding (chiffré) dans la table Utilisateur
8. Retourner : statut + score de confiance + facteurs
```

## Modèles utilisés

| Tâche               | Modèle                | Source                          |
| ------------------- | --------------------- | ------------------------------- |
| Détection visage    | RetinaFace            | InsightFace                     |
| Embedding facial    | ArcFace               | InsightFace                     |
| Anti-spoofing       | MiniFASNet            | Silent-Face-Anti-Spoofing       |

## Listes de personnes recherchées

| Source                  | Type                       | Mise à jour      |
| ----------------------- | -------------------------- | ---------------- |
| OFAC SDN List           | Sanctions américaines      | Quotidienne      |
| UN Consolidated List    | Sanctions ONU              | Hebdomadaire     |
| Interpol Notices        | Mandats publics            | Quotidienne      |

## Conformité légale

- **Consentement explicite obligatoire** avant toute comparaison aux listes
- Consentement enregistré dans `Consentement` (catégorie `verification_personnes_recherchees`)
- Possibilité de retirer le consentement à tout moment (effet immédiat)
- Embeddings chiffrés au repos (AES-256-GCM)
- Documenté dans le dossier CDP/APDP avec finalité explicite (KYC bancaire)

## Sécurité

- Limite : 10 vérifications / utilisateur / jour
- Toute tentative loguée dans le journal d'audit
- Aucune photo brute conservée — uniquement l'embedding (irréversible)
- Embeddings supprimés en cas de droit à l'oubli (effet immédiat)
