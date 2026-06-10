# 🚀 Phase 6 — Finalisation du Backend Super Admin

## 📋 État actuel

### ✅ Déjà en place
- **Schemas**: `schemas_phase6.py` — Tous les schémas Pydantic
- **Service**: `service_phase6.py` — Logique métier complète
- **Routes**: `routes.py` — Endpoints Phase 6 définis (mais partiellement)
- **Frontend**: Phase 5 100% complète et prête

### ⚠️ Problèmes à résoudre

1. **Routes.py incomplet**
   - Endpoint `GET /administrateurs/{id}` manquant (détails admin)
   - Imports manquants
   - Structure imparfaite

2. **Service_phase6.py incomplet**
   - Certaines fonctions utilisent des objets non-importés (`AdminApercu`)
   - Gestion des dates/timezones instable
   - Quelques requêtes SQLAlchemy mal formées

3. **Modèles manquants ou imparfaits**
   - `ConfigurationSysteme` — pas trouvé dans les modèles
   - `SessionAuthentification` — présent mais schéma de response missing
   - `JournalAudit` — présent mais quelques champs manquent

4. **Service original (service.py)**
   - Fonction `_utilisateur_vers_apercu` importée mais pas trouvée

5. **Tests manquants**
   - Aucun test unitaire Phase 6
   - Aucun test d'intégration API

---

## 🎯 Plan d'action

### **Étape 1: Audit et diagnostic du codebase** ✓ (EN COURS)
- [x] Explorer la structure
- [ ] Vérifier les modèles manquants
- [ ] Vérifier les imports
- [ ] Valider la syntaxe

### **Étape 2: Corriger les modèles** (PROCHAINE)
- [ ] Créer/corriger `ConfigurationSysteme`
- [ ] Valider `SessionAuthentification`
- [ ] Ajouter les champs manquants

### **Étape 3: Corriger le service** 
- [ ] Fixer les imports
- [ ] Valider les requêtes SQLAlchemy
- [ ] Tester chaque fonction

### **Étape 4: Compléter les routes**
- [ ] Ajouter `GET /administrateurs/{id}`
- [ ] Valider tous les endpoints
- [ ] Ajouter la documentation

### **Étape 5: Tests**
- [ ] Tests unitaires (service)
- [ ] Tests intégration (API)
- [ ] Tests de sécurité

### **Étape 6: Validation avec le frontend**
- [ ] Tester les appels API
- [ ] Corriger les désynchronisations

---

## 📊 Checklist détaillée

### Modèles (`backend/src/modeles/`)
- [ ] `Utilisateur` — valider tous les champs
- [ ] `ConfigurationSysteme` — créer si absent
- [ ] `SessionAuthentification` — vérifier schéma
- [ ] `JournalAudit` — ajouter champs manquants

### Service Phase 6 (`service_phase6.py`)
- [ ] `lister_audit()` — valider requête
- [ ] `exporter_audit_csv()` — tester CSV
- [ ] `calculer_statistiques()` — vérifier aggrégats
- [ ] `lister_feature_flags()` — vérifier modèle
- [ ] `modifier_feature_flags()` — audit renforcé ✓
- [ ] `lister_sessions_admin()` — vérifier statuts
- [ ] `revoquer_session_admin()` — vérifier révocation
- [ ] `modifier_administrateur()` — vérifier chiffrement
- [ ] `reinitialiser_mot_de_passe_admin()` — vérifier sécurité
- [ ] `basculer_2fa_admin()` — vérifier secret
- [ ] `supprimer_administrateur()` — vérifier marquage soft-delete
- [ ] `exporter_admin_donnees()` — vérifier structure
- [ ] `exporter_liste_admins_csv()` — tester CSV

### Routes (`routes.py`)
- [ ] `GET /administrateurs/{id}` — **MANQUANT**
- [ ] `PATCH /administrateurs/{id}` — vérifier
- [ ] `DELETE /administrateurs/{id}` — vérifier
- [ ] `POST /administrateurs/{id}/reset-password` — vérifier
- [ ] `PATCH /administrateurs/{id}/2fa` — vérifier
- [ ] `GET /administrateurs/{id}/sessions` — vérifier
- [ ] `POST /administrateurs/{id}/sessions/{id}/revoquer` — vérifier
- [ ] `GET /audit` — vérifier
- [ ] `GET /audit/export/csv` — vérifier
- [ ] `GET /statistiques` — vérifier
- [ ] `GET /configuration/feature-flags` — vérifier
- [ ] `PATCH /configuration/feature-flags` — vérifier
- [ ] `GET /administrateurs/export/csv` — vérifier
- [ ] `GET /administrateurs/{id}/export` — vérifier

### Tests
- [ ] Test unitaire: `test_lister_audit.py`
- [ ] Test unitaire: `test_statistiques.py`
- [ ] Test unitaire: `test_feature_flags.py`
- [ ] Test unitaire: `test_sessions_admin.py`
- [ ] Test unitaire: `test_modifier_admin.py`
- [ ] Test intégration: `test_api_super_admin_v2.py`
- [ ] Test E2E: Cypress/Playwright (frontend)

---

## 🔧 Commandes pour démarrer

```bash
# 1. Vérifier la structure
python -m mypy backend/src/modules/super_admin/service_phase6.py --strict

# 2. Vérifier les imports
python -c "from backend.src.modules.super_admin import service_phase6"

# 3. Lancer les tests (une fois créés)
pytest backend/tests/modules/super_admin/test_service_phase6.py -v

# 4. Lancer le serveur
python -m uvicorn backend.src.main:app --reload
```

---

## 📚 Dépendances à vérifier

```python
# Dans service_phase6.py
from sqlalchemy import func, select, or_, and_, cast, String, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# Modèles
from src.modeles import (
    Utilisateur,
    JournalAudit,
    SessionAuthentification,  # À vérifier
    ConfigurationSysteme,      # À créer si absent
)

# Noyau
from src.noyau import (
    dechiffrer_donnee,
    chiffrer_donnee,
    hacher_mot_de_passe,
    journal,
)
from src.noyau.exceptions import (
    ErreurRessourceIntrouvable,
    ErreurValidation,
    ErreurAutorisation,
    ErreurConflit,
)
from src.noyau.journal import journal_audit
```

---

## 🎓 Points clés pour la finalisation

### Sécurité
1. ✅ Vérification rôle super_admin sur chaque endpoint
2. ✅ Audit tracé pour chaque action
3. ✅ Rate limiting sur les modifications
4. ✅ Validation stricte des entrées
5. ✅ Chiffrement des données sensibles (prenom/nom)
6. ✅ Soft-delete au lieu de hard-delete

### Performance
1. ✓ Pagination du journal d'audit (50/page)
2. ✓ Indexes sur JournalAudit.date_evenement
3. ✓ Cache des statistiques (à 5 min)?
4. ✓ Lazy loading des relations

### Fiabilité
1. ✓ Gestion des timezones (UTC)
2. ✓ Transactions ACID
3. ✓ Gestion des erreurs explicite
4. ✓ Messages d'erreur sécurisés (pas de données sensibles)
5. ✓ Logging structuré

---

## 📞 Prochaines étapes

1. **Immédiate**: Vérifier les modèles et imports manquants
2. **Court terme**: Fixer service_phase6.py et routes.py
3. **Moyen terme**: Ajouter les tests
4. **Validation**: Tester avec le frontend

---

**Statut global**: 70% complété  
**Blockers**: Modèles manquants, imports cassés  
**ETA Phase 6**: 2-3 jours avec tests
