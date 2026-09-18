# PLAN — Interface unique d'extraction de documents (1 jour)

## 0. Objectif
- **1 seule route** `POST /api/v1/inspection-documents/upload` (auto-détection ou `type_document` fourni).
- **1 seul écran** frontend.
- Chaque document garde **son extracteur, son schéma, son nettoyage, sa table**.
- Pas de contrat/Protocol : des **adaptateurs = simples fonctions**.
- Périmètre : **CNI, Permis, Assurance, Carte grise, Carte de séjour, Consulaire**.

---

## 1. État des lieux

| Document | Moteur backend | Table | Frontend |
|---|---|---|---|
| CNI | `ocr_cni` ✅ | `verification_cni` ✅ | `DocumentTypeSelector` ✅ |
| Permis | `ocr_permis` ✅ | `permis_conduire` ✅ | ✅ |
| Assurance | `ocr_assurance` ✅ | `assurances_auto` ✅ | ✅ |
| **Carte grise** | ❌ à créer | ❌ à créer | ❌ à créer |
| **Carte de séjour** | ❌ à créer (enum existe) | ❌ à créer | partiel (enum existe) |
| **Consulaire** | ❌ à créer | ❌ à créer | ❌ à créer |

Existant réutilisable : OCR partagé `ocr_cni.ocr_engine.analyser_image_cni(contenu)`, classifieur `inspection_documents.classification.document_classifier.classifier_document`.

---

## 2. BACKEND — champs par document (mapping + nettoyage)

C'est le cœur du travail : chaque document a SES champs, SES regex, SON nettoyage.

### 2.1 Carte grise (certificat d'immatriculation)
| Champ table | Clé extraite | Règle / nettoyage |
|---|---|---|
| numero_immatriculation | `immatriculation` | nouveau `AB-123-CD` ; ancien `1234 AB 01` ; garder majuscules, tirets |
| numero_chassis | `vin` | 17 car. alphanum, **sans I/O/Q** |
| numero_moteur | `numero_moteur` | alphanum 5-20 |
| marque | `marque` (case D.1) | majuscules |
| modele | `modele` (D.3) | majuscules |
| genre | `genre` | VP, CT, CAM, TRR… |
| carrosserie | `carrosserie` | CI, BE… |
| energie | `energie` | enum : ESSENCE, DIESEL, ELECTRIQUE, HYBRIDE, GPL |
| puissance_fiscale_cv | `puissance` (P.6) | int |
| nombre_places | `places` (S.1) | int |
| poids_total_kg | `poids` (F.2) | int |
| date_premiere_mise_circulation | `date_mec` (B) | `JJ/MM/AAAA` |
| annee_vehicule | dérivé de `date_mec` | int |
| numero_formule | `formule` (E) | alphanum |
| titulaire_nom | `nom` (C.1) | majuscules |
| titulaire_prenoms | `prenoms` (C.1) | majuscules |
| titulaire_adresse | `adresse` (C.3) | texte |
| pays_emetteur | `pays` | code/texte |
| date_delivrance | `date_delivrance` | `JJ/MM/AAAA` |
| date_expiration | `date_expiration` | `JJ/MM/AAAA` (souvent absente) |

### 2.2 Carte de séjour
| Champ table | Clé extraite | Règle / nettoyage |
|---|---|---|
| type_titre | `titre` | CARTE_SEJOUR / TITRE_SEJOUR / RECEPISSE / CARTE_RESIDENT |
| numero_titre | `numero` | alphanum 6-15 |
| nom_famille | `nom` | majuscules |
| prenoms | `prenoms` | majuscules |
| sexe | `sexe` | M/F |
| date_naissance | `date_naissance` | `JJ/MM/AAAA` |
| lieu_naissance | `lieu_naissance` | texte |
| nationalite | `nationalite` | texte |
| adresse | `adresse` | texte |
| categorie | `categorie` | SALARIE / ETUDIANT / CONJOINT / VISITEUR / RESIDENT |
| date_delivrance | `date_delivrance` | `JJ/MM/AAAA` |
| date_expiration | `date_expiration` | `JJ/MM/AAAA` |
| autorite_delivrance | `autorite` | préfecture |
| pays_emetteur | `pays` | code/texte |
| mrz | `mrz_*` | MRZ type `I<`/`A<` si présente |

### 2.3 Consulaire (carte d'immatriculation consulaire)
| Champ table | Clé extraite | Règle / nettoyage |
|---|---|---|
| numero_immatriculation_consulaire | `numero_immat` | alphanum |
| nom_famille | `nom` | majuscules |
| prenoms | `prenoms` | majuscules |
| date_naissance | `date_naissance` | `JJ/MM/AAAA` |
| lieu_naissance | `lieu_naissance` | texte |
| nationalite | `nationalite` | texte |
| profession | `profession` | texte |
| situation_matrimoniale | `situation` | CELIBATAIRE/MARIE/DIVORCE/VEUF |
| adresse | `adresse` | texte |
| poste_consulaire | `consulat` | consulat/ambassade |
| pays_emetteur | `pays` | code/texte |
| numero_passeport | `passeport` | alphanum |
| personnes_a_charge | `charges` | int |
| date_delivrance | `date_delivrance` | `JJ/MM/AAAA` |
| date_expiration | `date_expiration` | `JJ/MM/AAAA` |

Règles de nettoyage communes (déjà présentes dans `ocr_permis`/`ocr_assurance`, à copier) :
- `_separer_mots_colles` (OCR colle les en-têtes), `_nettoyer_texte` (majuscules, espaces).
- `_parser_date` tolérant (`JJ.MM.AAAA`, `JJ/MM/AAAA`, ISA).
- exclusion des labels (`LABELS_A_EXCLURE`) pour ne pas prendre un intitulé comme valeur.

---

## 3. BACKEND — fichiers à créer / modifier

### 3.1 À créer (1 dossier par document, calqué sur `ocr_assurance`)
```
src/modeles/carte_grise.py          -> table cartes_grises
src/modeles/carte_sejour.py         -> table cartes_sejour
src/modeles/consulaire.py           -> table cartes_consulaires

src/modules/ocr_carte_grise/__init__.py
src/modules/ocr_carte_grise/schemas.py               (DonneesCarteGriseExtraites)
src/modules/ocr_carte_grise/extraction_carte_grise.py (regex + nettoyage)
src/modules/ocr_carte_grise/service.py               (traiter_upload_carte_grise)
src/modules/ocr_carte_grise/routes.py

src/modules/ocr_carte_sejour/...      (idem)
src/modules/ocr_consulaire/...        (idem)

src/modules/inspection_documents/facade.py
src/modules/inspection_documents/adaptateurs/__init__.py
src/modules/inspection_documents/adaptateurs/cni.py
src/modules/inspection_documents/adaptateurs/permis.py
src/modules/inspection_documents/adaptateurs/assurance.py
src/modules/inspection_documents/adaptateurs/carte_grise.py
src/modules/inspection_documents/adaptateurs/carte_sejour.py
src/modules/inspection_documents/adaptateurs/consulaire.py
```

Chaque `service.py` : `_lire_image` → `analyser_image_cni` → `extraire_donnees_xxx` → validation date expiration → `session.add(Model)` → commit → réponse.
Chaque `routes.py` : `POST /.../upload` (même forme que `ocr_assurance/routes.py`).

### 3.2 À modifier
| Fichier | Modification |
|---|---|
| `inspection_documents/schemas.py` | `TypeDocument` : ajouter `CARTE_GRISE = "carte_grise"`, `CARTE_CONSULAIRE = "carte_consulaire"` |
| `inspection_documents/service.py` | remplacer le pipeline interne par un appel à `facade.traiter(...)` (garder la route) |
| `inspection_documents/classification/patterns_documents.py` | patterns `carte_grise`, `consulaire` |
| `src/modeles/__init__.py` | exporter `CarteGrise`, `CarteSejour`, `CarteConsulaire` |
| `src/api/...` (routeur principal) | inclure les 3 nouveaux `routeur_*` |
| `alembic`/`create_all` | 3 nouvelles tables |

### 3.3 `facade.py` (code, sans contrat)
```python
# src/modules/inspection_documents/facade.py
from fastapi import UploadFile
from src.modules.inspection_documents.schemas import TypeDocument
from src.modules.ocr_cni.ocr_engine import analyser_image_cni
from src.modules.inspection_documents.classification.document_classifier import classifier_document
from src.modules.inspection_documents.adaptateurs import (
    adapter_cni, adapter_permis, adapter_assurance,
    adapter_carte_grise, adapter_carte_sejour, adapter_consulaire,
)

_ADAPTATEURS = {
    TypeDocument.CNI_BIOMETRIQUE: adapter_cni,
    TypeDocument.CNI_PAPIER:      adapter_cni,
    TypeDocument.PERMIS_CONDUIRE: adapter_permis,
    TypeDocument.CARTE_ASSURANCE: adapter_assurance,
    TypeDocument.CARTE_GRISE:     adapter_carte_grise,
    TypeDocument.CARTE_SEJOUR:    adapter_carte_sejour,
    TypeDocument.CARTE_CONSULAIRE: adapter_consulaire,
}

async def traiter(session, utilisateur, fichier: UploadFile, *, type_document=None,
                  face="recto", contexte="citoyen", enrolement_id=None) -> dict:
    contenu = await fichier.read()
    await fichier.seek(0)
    if type_document is None:
        ocr = analyser_image_cni(contenu)
        type_document = classifier_document(ocr["texte_brut"], ocr["mrz_lignes"])
    adapter = _ADAPTATEURS.get(type_document)
    if adapter is None:
        raise ValueError(f"Type non supporté : {type_document}")
    return await adapter(session, utilisateur, fichier,
                         face=face, contexte=contexte, enrolement_id=enrolement_id)
```

### 3.4 Format de réponse unique (simple, pas de schema lourd)
Chaque adaptateur renvoie le même dict :
```python
{
  "type_document": "carte_grise",
  "identifiant": "<uuid>",
  "statut": "approuve",              # approuve | rejete | expiree | en_attente
  "donnees": { ...champs du document... },
  "message": "...",
  "champs_extraits": 9,
  "texte_brut": "...",              # pour debug
  "temps_ms": 1200,
}
```

---

## 4. FRONTEND — tâches

| Fichier | Modification |
|---|---|
| `src/types/inspection.ts` | `TypeDocument` : ajouter `CARTE_GRISE`, `CARTE_CONSULAIRE` ; ajouter interfaces `DonneesCarteGrise`, `DonneesCarteSejour`, `DonneesConsulaire` |
| `src/services/inspectionApi.ts` | 1 fonction `uploaderDocument(fichier, typeDocument)` → route unique ; type réponse `ReponseDocumentUnifie` |
| `src/composants/inspection/DocumentTypeSelector.tsx` | ajouter Carte grise, Consulaire (séjour existe) |
| `src/composants/inspection/ExtractionResults.tsx` | rendu des champs **par type** (table de libellés par document) |
| `src/composants/inspection/DocumentHistory.tsx` | libellés carte grise / consulaire |
| `src/app/inspection/page.tsx` | `LIBELLES` + `champsParType` pour les 3 nouveaux |

Rendu par type (exemple) :
```ts
export const CHAMPS_PAR_TYPE: Record<string, { key: string; libelle: string }[]> = {
  carte_grise: [
    { key: "numero_immatriculation", libelle: "Immatriculation" },
    { key: "numero_chassis", libelle: "N° châssis (VIN)" },
    { key: "marque", libelle: "Marque" },
    { key: "modele", libelle: "Modèle" },
    { key: "energie", libelle: "Énergie" },
    { key: "puissance_fiscale_cv", libelle: "Puissance (CV)" },
    { key: "date_premiere_mise_circulation", libelle: "1ère mise en circulation" },
    { key: "titulaire_nom", libelle: "Titulaire" },
  ],
  carte_sejour: [
    { key: "numero_titre", libelle: "N° titre" },
    { key: "type_titre", libelle: "Type" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "nationalite", libelle: "Nationalité" },
    { key: "date_expiration", libelle: "Expiration" },
  ],
  consulaire: [
    { key: "numero_immatriculation_consulaire", libelle: "N° immatriculation" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "poste_consulaire", libelle: "Poste consulaire" },
    { key: "numero_passeport", libelle: "N° passeport" },
    { key: "date_expiration", libelle: "Expiration" },
  ],
};
```

---

## 5. ORDRE D'EXÉCUTION — 1 JOUR

| Créneau | Backend | Frontend |
|---|---|---|
| 09:00–09:30 | `facade.py` + dict réponse + enum `TypeDocument` (CARTE_GRISE, CARTE_CONSULAIRE) | — |
| 09:30–11:00 | 3 modèles/tables (`carte_grise`, `carte_sejour`, `consulaire`) + export `modeles/__init__.py` | — |
| 11:00–12:30 | 3 moteurs : `schemas` + `extraction_*` + `service` + `routes` | — |
| 12:30–13:30 | 6 adaptateurs | — |
| 13:30–14:30 | brancher route unique + classifier + patterns | — |
| 14:30–15:30 | — | `types`, `inspectionApi`, sélecteur, historique |
| 15:30–16:30 | — | `ExtractionResults` + `inspection/page.tsx` par type |
| 16:30–17:15 | tests upload des 6 docs + migration tables | test écran |
| 17:15–17:45 | suppression doublons (`nlp_extractor`, `fusion_engine`, `field_mapper`, `validation_engine`) | nettoyage labels |

---

## 6. CHECKLIST FINALE
- [ ] `TypeDocument` backend + frontend complets (6 documents).
- [ ] 3 nouvelles tables créées + modèles exportés.
- [ ] 3 moteurs (extraction + service + route) opérationnels.
- [ ] 6 adaptateurs + `facade.py` + route unique branchée.
- [ ] Réponse unique identique pour les 6 documents.
- [ ] Frontend : sélecteur, upload unique, affichage par type.
- [ ] Patterns de classification carte grise / consulaire ajoutés.
- [ ] Test réel : un upload par document, vérifier `donnees` mappées au bon champ.
- [ ] Doublons `inspection_documents` supprimés.

---

## 7. POINTS DE VIGILANCE
- **Carte grise** : les champs sont codés (D.1, P.6, F.2, B, E) → mapper les **codes** avant les libellés.
- **Consulaire** : toujours vérifier le **poste consulaire** (peut être confondu avec l'adresse).
- **Séjour** : `date_expiration` obligatoire (rejet si passée), MRZ type `I<`/`A<`.
- **Ne pas** recréer d'OCR : réutiliser `analyser_image_cni`.
- **1 base PostgreSQL** = OK ; **1 table par document** = obligatoire (pas de `donnees_specifiques` JSON fourre-tout).
