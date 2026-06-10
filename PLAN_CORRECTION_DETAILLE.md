# 🔧 Plan détaillé de correction — Phase 6 Backend

## 📊 Problèmes identifiés

### 1. ❌ routes.py — Structure cassée
```
PROBLÈME: Fichier commence par @routeur_super_admin.patch au lieu des imports
- Imports manquants en début
- Endpoint GET /administrateurs/{id} manquant
- Imports Phase 6 au milieu du fichier (mauvaise pratique)
```

### 2. ❌ service_phase6.py — Imports cassés
```
PROBLÈME: Ligne 30 → "from src.modules.super_admin.schemas import AdminApercu as AdminApercuOrig"
- AdminApercu importé mais utilisé à d'autres endroits
- La fonction _utilisateur_vers_apercu importée depuis service.py
```

### 3. ❌ service_phase6.py — SQLAlchemy mal formé
```
PROBLÈME: Ligne 370 → type(SessionAuthentification.__table__.update()...)
- Syntaxe SQLAlchemy 2.0 invalide
- Devrait être update(SessionAuthentification).where(...)
```

### 4. ⚠️ SessionAuthentification — Manque `date_creation`
```
Le modèle a date_creation mais pas de default
Les dates doivent avoir timezone=True et default=func.now()
```

---

## ✅ Plan de correction

### **Étape 1: Recréer routes.py complet** (IMMÉDIAT)
- [x] Identifier tous les imports nécessaires
- [ ] Écrire routes.py en intégralité avec :
  - Imports de début (fastapi, sqlalchemy, etc.)
  - Endpoint de Phase 5 (suspension/activation)
  - Endpoint GET /administrateurs/{id} ✅ À AJOUTER
  - Tous les endpoints Phase 6
  - Documentation complète

**Fichier**: `backend/src/modules/super_admin/routes.py`  
**Approche**: Écrire de zéro avec tous les imports en début

---

### **Étape 2: Corriger service_phase6.py** (APRÈS Étape 1)
- [ ] Fixer les imports SQLAlchemy 2.0
- [ ] Corriger les requêtes UPDATE/DELETE
- [ ] Valider les timezones (UTC)
- [ ] Tester chaque fonction avec print() debug

**Fichier**: `backend/src/modules/super_admin/service_phase6.py`  
**Changements**:
```python
# ❌ AVANT (Ligne 370)
await session.execute(
    type(
        SessionAuthentification.__table__.update()
        .where(...)
        .values(...)
    )
)

# ✅ APRÈS
await session.execute(
    update(SessionAuthentification)
    .where(SessionAuthentification.utilisateur_id == admin_id, ...)
    .values(est_revoquee=True)
)
```

---

### **Étape 3: Valider schemas_phase6.py** (VÉRIFICATION)
- [x] AdminApercu dupliqué (schemas.py vs schemas_phase6.py)
- [ ] Ajouter AdminApercu dans schemas_phase6.py ou importer depuis schemas.py
- [ ] Valider tous les schémas Pydantic

---

### **Étape 4: Vérifier les modèles** (VÉRIFICATION)
- [x] Utilisateur — ✅ champs OK
- [x] ConfigurationSysteme — ✅ champs OK
- [x] SessionAuthentification — ✅ champs OK
- [x] JournalAudit — ✅ champs OK
- [ ] Ajouter indexes manquants si nécessaire

---

### **Étape 5: Créer tests** (APRÈS tout)
- [ ] test_service_phase6.py — tests unitaires
- [ ] test_routes_phase6.py — tests d'intégration API
- [ ] Fixtures pytest pour admin, session, audit

---

## 🎯 Dépendances à importer

### Dans routes.py
```python
from fastapi import (
    APIRouter, Depends, Request, status,
    HTTPException, Query
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime

from src.api import obtenir_session
from src.noyau.middleware import super_admin_courant, obtenir_ip_client
from src.modeles import Utilisateur
from src.modules.super_admin import service, service_phase6
from src.modules.super_admin.schemas import AdminApercu
from src.modules.super_admin.schemas_phase6 import (
    FiltresAudit, ListeAuditPaginee, StatistiquesCompletes,
    ListeFeatureFlags, MiseAJourFeatureFlags,
    ListeSessionsAdmin, ModifierAdminRequete,
    ResetMotDePasseReponse, Modifier2FARequete,
    DonneesAdminExport, ExportAuditRequete,
)
```

### Dans service_phase6.py
```python
from sqlalchemy import (
    func, select, or_, and_, cast, String, 
    update, delete, Index
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional
import csv, io, json, secrets, string

from src.config import parametres
from src.config.constantes import RolesUtilisateur
from src.modeles import (
    Utilisateur, JournalAudit, SessionAuthentification, 
    ConfigurationSysteme
)
from src.noyau import (
    dechiffrer_donnee, chiffrer_donnee, 
    hacher_mot_de_passe, journal
)
from src.noyau.exceptions import (
    ErreurRessourceIntrouvable, ErreurValidation, 
    ErreurAutorisation, ErreurConflit
)
from src.noyau.journal import journal_audit
from src.modules.super_admin.service import _utilisateur_vers_apercu
from src.modules.super_admin.schemas import AdminApercu
from src.modules.super_admin.schemas_phase6 import (
    FiltresAudit, ListeAuditPaginee, EvenementAuditItem,
    StatistiquesCompletes, StatistiquesUtilisateurs,
    StatistiquesAdmins, StatistiquesSessions, StatistiquesScore,
    FeatureFlagItem, ListeFeatureFlags,
    SessionAdminItem, ListeSessionsAdmin,
    ModifierAdminRequete, DonneesAdminExport,
)
```

---

## 🔐 Endpoint GET /administrateurs/{id} — À AJOUTER

```python
@routeur_super_admin.get(
    "/administrateurs/{admin_id}",
    response_model=AdminApercu,
    summary="Obtenir les détails d'un administrateur",
)
async def obtenir_admin_detail(
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Retourne les détails complets d'un administrateur.
    
    Champs retournés :
      - id, email, prenom, nom, role
      - est_actif, deux_fa_active, est_email_verifie
      - date_creation, date_derniere_connexion
    """
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.id == admin_id,
            Utilisateur.est_supprime == False,
        )
    )
    admin = resultat.scalar_one_or_none()
    
    if admin is None:
        raise HTTPException(
            status_code=404,
            detail="Administrateur introuvable",
        )
    
    # Vérifier que c'est bien un admin
    if admin.role not in ["administrateur", "super_administrateur"]:
        raise HTTPException(
            status_code=404,
            detail="Utilisateur introuvable",
        )
    
    return _utilisateur_vers_apercu(admin)
```

---

## 📋 Checklist d'exécution

### Phase 1 — Reconstruction (JOUR 1)
- [ ] Recréer routes.py complet
- [ ] Corriger service_phase6.py (imports + SQLAlchemy)
- [ ] Valider schemas_phase6.py
- [ ] Tester les imports avec `python -c "from src.modules.super_admin import service_phase6"`

### Phase 2 — Validation (JOUR 2)
- [ ] Lancer le serveur FastAPI
- [ ] Tester les endpoints avec curl/Postman
- [ ] Vérifier les erreurs 500 et les logs
- [ ] Corriger les bugs trouvés

### Phase 3 — Tests (JOUR 3)
- [ ] Créer tests unitaires
- [ ] Créer tests d'intégration
- [ ] Tests E2E avec le frontend
- [ ] Coverage > 80%

### Phase 4 — Documentation (JOUR 4)
- [ ] Documenter chaque endpoint
- [ ] Créer des exemples curl
- [ ] Mettre à jour README
- [ ] Créer guide d'utilisation

---

## 🚀 Commandes pour valider

```bash
# 1. Vérifier la syntaxe
python -m py_compile backend/src/modules/super_admin/routes.py
python -m py_compile backend/src/modules/super_admin/service_phase6.py

# 2. Importer les modules
python -c "from src.modules.super_admin import routes, service_phase6"

# 3. Lancer mypy pour les types
python -m mypy backend/src/modules/super_admin/ --strict

# 4. Lancer les tests (une fois créés)
pytest backend/tests/modules/super_admin/ -v --cov

# 5. Lancer le serveur en dev
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

---

**Statut**: Plan prêt pour exécution  
**Durée estimée**: 4-6 heures avec tests  
**Blockers**: Aucun — tous les modèles et dépendances sont présents
