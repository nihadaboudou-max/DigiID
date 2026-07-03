# -*- coding: utf-8 -*-
"""
Validation croisée des données extraites de documents d'identité.
Vérifications multi-niveaux :
- Cohérence recto/verso (mêmes informations sur les deux faces)
- Cohérence MRZ ↔ OCR texte
- Cohérence des dates (naissance < délivrance < expiration)
- Cohérence des formats par pays
- Vérification du checksum MRZ
- Détection d'anomalies (OCR incohérent, dates impossibles)
- Score de confiance global basé sur la convergence des sources
Utilise :
- extraction_cni.py pour le parsing OCR texte
- mrz_parser.py pour la validation MRZ
- validation_cni.py pour les validations individuelles
"""
import re
from datetime import date, datetime
from typing import Any, Optional, Tuple
from src.modules.ocr_cni.extraction_cni import extraire_donnees_cni
from src.modules.ocr_cni.mrz_parser import parser_mrz_complet
from src.modules.ocr_cni.schemas import DonneesCNIExtraites
from src.modules.ocr_cni.validation_cni import (
    valider_date_expiration,
    valider_date_naissance,
    valider_mrz,
    valider_numero_cni,
)
from src.noyau.journal import journal

# =============================================================================
# Constantes
# =============================================================================
# Seuils de confiance
SEUIL_CONFIANCE_ELEVE = 0.85
SEUIL_CONFIANCE_MOYEN = 0.60
SEUIL_CONFIANCE_FAIBLE = 0.30

# Poids des sources dans le score de confiance
POIDS_MRZ = 0.40
POIDS_OCR_TEXTE = 0.35
POIDS_COHERENCE = 0.25

# =============================================================================
# Validation croisée principale
# =============================================================================
def valider_croisee(
    donnees_recto: Optional[DonneesCNIExtraites] = None,
    donnees_verso: Optional[DonneesCNIExtraites] = None,
    mrz_lignes: Optional[Tuple[Optional[str], Optional[str], Optional[str]]] = None,
) -> dict:
    """
    Validation croisée complète entre toutes les sources disponibles.
    Args :
         donnees_recto : Données extraites du recto (OCR texte)
         donnees_verso : Données extraites du verso (OCR texte)
         mrz_lignes : Tuple (ligne1, ligne2, ligne3) de la MRZ
    Retour :
         Dictionnaire structuré avec :
           - score_global : 0.0 - 1.0
           - est_coherent : booléen
           - details : dict des vérifications
           - anomalies : liste des anomalies détectées
           - message : résumé textuel
    """
    resultat: dict = {
        "score_global": 0.0,
        "est_coherent": False,
        "details": {},
        "anomalies": [],
        "avertissements": [],
        "message": "",
        "sources_disponibles": {
            "recto": donnees_recto is not None,
            "verso": donnees_verso is not None,
            "mrz": mrz_lignes is not None and any(mrz_lignes),
        },
    }
    verifications: dict = {}
    anomalies: list = []
    avertissements: list = []
    # ── 1. Validation MRZ (si disponible) ──
    if mrz_lignes and any(mrz_lignes):
        mrz_valide, details_mrz, msg_mrz = valider_mrz(
            mrz_lignes[0], mrz_lignes[1], mrz_lignes[2],
        )
        verifications["mrz_structure"] = mrz_valide
        verifications["mrz_details"] = details_mrz
        # Parser la MRZ pour récupérer les données structurées
        mrz_data = parser_mrz_complet(
            mrz_lignes[0], mrz_lignes[1], mrz_lignes[2],
        )
        if not mrz_valide:
            avertissements.append(f"MRZ partiellement valide : {msg_mrz}")
    else:
        mrz_data = {}
    # ── 2. Validation des formats individuels ──
    # Recto
    if donnees_recto:
        v_recto = _valider_donnees_source(donnees_recto, "recto")
        verifications["recto"] = v_recto
        if donnees_recto.numero_cni:
            num_valide, msg_num = valider_numero_cni(donnees_recto.numero_cni)
            if not num_valide:
                anomalies.append(f"Numéro CNI recto invalide : {msg_num}")
        if donnees_recto.date_naissance:
            ddn_valide, msg_ddn = valider_date_naissance(
                donnees_recto.date_naissance,
                donnees_recto.date_expiration,
            )
            if not ddn_valide:
                anomalies.append(f"Date naissance recto : {msg_ddn}")
        if donnees_recto.date_expiration:
            dexp_valide, msg_dexp = valider_date_expiration(
                donnees_recto.date_expiration,
            )
            if not dexp_valide:
                avertissements.append(f"Date expiration recto : {msg_dexp}")
    # Verso
    if donnees_verso:
        v_verso = _valider_donnees_source(donnees_verso, "verso")
        verifications["verso"] = v_verso
        if donnees_verso.numero_cni:
            num_valide, msg_num = valider_numero_cni(donnees_verso.numero_cni)
            if not num_valide:
                anomalies.append(f"Numéro CNI verso invalide : {msg_num}")
        if donnees_verso.date_naissance:
            ddn_valide, msg_ddn = valider_date_naissance(
                donnees_verso.date_naissance,
                donnees_verso.date_expiration,
            )
            if not ddn_valide:
                anomalies.append(f"Date naissance verso : {msg_ddn}")
    # ── 3. Cohérence recto/verso ──
    if donnees_recto and donnees_verso:
        coherent, msg_coherence = _verifier_coherence_recto_verso(
            donnees_recto, donnees_verso,
        )
        verifications["coherence_recto_verso"] = coherent
        if not coherent:
            avertissements.append(f"Recto/Verso : {msg_coherence}")
    else:
        verifications["coherence_recto_verso"] = True  # Pas de conflit possible
    # ── 4. Cohérence MRZ ↔ OCR ──
    source_principale = donnees_recto or donnees_verso
    if source_principale and mrz_data:
        coherent_mrz, msg_mrz_coherence = _verifier_coherence_mrz_ocr(
            source_principale, mrz_data,
        )
        verifications["coherence_mrz_ocr"] = coherent_mrz
        if not coherent_mrz:
            avertissements.append(f"MRZ/OCR : {msg_mrz_coherence}")
    else:
        verifications["coherence_mrz_ocr"] = True
    # ── 5. Cohérence des dates ──
    source = donnees_recto or donnees_verso
    if source:
        dates_coherentes, msg_dates = _verifier_coherence_dates(
            source.date_naissance,
            source.date_delivrance,
            source.date_expiration,
        )
        verifications["coherence_dates"] = dates_coherentes
        if not dates_coherentes:
            anomalies.append(f"Dates : {msg_dates}")
    else:
        verifications["coherence_dates"] = True
    # ── 6. Détection d'anomalies ──
    anomalies_detectees = _detecter_anomalies(
        donnees_recto, donnees_verso, mrz_data,
    )
    anomalies.extend(anomalies_detectees)
    # ── 7. Score de confiance global ──
    score = _calculer_score_confiance(
        verifications, donnees_recto, donnees_verso, mrz_data,
    )
    resultat["score_global"] = round(score, 2)
    resultat["est_coherent"] = score >= SEUIL_CONFIANCE_MOYEN
    resultat["details"] = verifications
    resultat["anomalies"] = anomalies
    resultat["avertissements"] = avertissements
    # Message résumé
    if score >= SEUIL_CONFIANCE_ELEVE:
        resultat["message"] = "Document authentique : toutes les sources concordent."
    elif score >= SEUIL_CONFIANCE_MOYEN:
        nb_anomalies = len(anomalies)
        resultat["message"] = (
            f"Document partiellement fiable : {nb_anomalies} anomalie(s) détectée(s)."
        )
    else:
        resultat["message"] = (
            "Document non fiable : anomalies majeures entre les sources."
        )
    journal.info(
        f"Validation croisée : score={resultat['score_global']}, "
        f"coherent={resultat['est_coherent']}, "
        f"anomalies={len(anomalies)}, "
        f"sources={resultat['sources_disponibles']}"
    )
    return resultat

# =============================================================================
# Fonctions de vérification
# =============================================================================
def _valider_donnees_source(
    donnees: DonneesCNIExtraites,
    source: str,
) -> dict:
    """Valide la complétude et qualité d'une source de données."""
    champs_attendus = [
        "nom_famille", "prenoms", "date_naissance",
        "numero_cni", "date_expiration",
    ]
    champs_presents = sum(1 for champ in champs_attendus
                          if getattr(donnees, champ, None))
    total_champs = len(champs_attendus)
    return {
        "champs_presents": champs_presents,
        "total_champs": total_champs,
        "taux_completion": champs_presents / total_champs if total_champs else 0,
        "confiance_ocr": donnees.taux_confiance_moyen or 0,
        "format_carte": donnees.format_carte or "inconnu",
        "mrz_presente": bool(donnees.mrz_ligne_1),
    }

def _verifier_coherence_recto_verso(
    recto: DonneesCNIExtraites,
    verso: DonneesCNIExtraites,
) -> Tuple[bool, str]:
    """
    Vérifie que les données du recto et du verso concordent.
    Compare les champs critiques qui doivent être identiques
     sur les deux faces du document.
    """
    incoherences = []
    # Comparaison du numéro de document
    if recto.numero_cni and verso.numero_cni:
        if recto.numero_cni.upper() != verso.numero_cni.upper():
            incoherences.append("numéro différent")
    if recto.nom_famille and verso.nom_famille:
        if recto.nom_famille.upper() != verso.nom_famille.upper():
            incoherences.append("nom différent")
    if recto.date_naissance and verso.date_naissance:
        if recto.date_naissance != verso.date_naissance:
            incoherences.append("date de naissance différente")
    if not incoherences:
        return True, "Recto et verso cohérents."
    message = "; ".join(incoherences[:3])
    return False, f"Incohérences : {message}."

def _verifier_coherence_mrz_ocr(
    donnees_ocr: DonneesCNIExtraites,
    donnees_mrz: dict,
) -> Tuple[bool, str]:
    """
    Vérifie la cohérence entre les données OCR texte et la MRZ.
    Compare les champs qui devraient être identiques :
       - Nom
       - Date de naissance
       - Numéro de document
       - Date d'expiration
    """
    incoherences = []
    # Nom
    nom_ocr = (donnees_ocr.nom_famille or "").upper().strip()
    nom_mrz = (donnees_mrz.get("nom_famille") or "").upper().strip()
    if nom_ocr and nom_mrz and nom_ocr != nom_mrz:
        # Vérifier si l'un est contenu dans l'autre
        if nom_ocr not in nom_mrz and nom_mrz not in nom_ocr:
            incoherences.append("nom")
    # Date de naissance
    ddn_ocr = donnees_ocr.date_naissance or ""
    ddn_mrz = donnees_mrz.get("date_naissance_date") or ""
    if ddn_ocr and ddn_mrz:
        # Normaliser les formats
        ddn_ocr_norm = ddn_ocr.replace("/", "")
        ddn_mrz_norm = ddn_mrz.replace("/", "")
        if ddn_ocr_norm != ddn_mrz_norm:
            incoherences.append("date de naissance")
    # Numéro de document
    num_ocr = (donnees_ocr.numero_cni or "").upper().strip()
    num_mrz = (donnees_mrz.get("numero_document") or "").upper().strip()
    if num_ocr and num_mrz:
        if num_ocr.replace(" ", "") != num_mrz.replace(" ", ""):
            if len(num_ocr) > 5 and len(num_mrz) > 5:
                incoherences.append("numéro de document")
    # Date d'expiration
    dexp_ocr = donnees_ocr.date_expiration or ""
    dexp_mrz = donnees_mrz.get("date_expiration_date") or ""
    if dexp_ocr and dexp_mrz:
        dexp_ocr_norm = dexp_ocr.replace("/", "")
        dexp_mrz_norm = dexp_mrz.replace("/", "")
        if dexp_ocr_norm != dexp_mrz_norm:
            incoherences.append("date d'expiration")
    if not incoherences:
        return True, "MRZ et OCR texte cohérents."
    message = ", ".join(incoherences[:3])
    return False, f"MRZ/OCR incohérent sur : {message}."

def _verifier_coherence_dates(
    date_naissance: Optional[str],
    date_delivrance: Optional[str],
    date_expiration: Optional[str],
) -> Tuple[bool, str]:
    """
    Vérifie la chronologie des dates : naissance < délivrance < expiration.
    Une carte d'identité ne peut pas être délivrée avant la naissance
     du titulaire, ni expirer avant sa délivrance.
    """
    def parser_date(d: Optional[str]) -> Optional[date]:
        if not d:
            return None
        try:
            return datetime.strptime(d.strip(), "%d/%m/%Y").date()
        except (ValueError, AttributeError):
            return None
    ddn = parser_date(date_naissance)
    ddel = parser_date(date_delivrance)
    dexp = parser_date(date_expiration)
    if ddn and ddel and ddel <= ddn:
        return False, (
            "La date de délivrance précède la date de naissance. "
            f"Délivrance: {ddel}, Naissance: {ddn}"
        )
    if ddel and dexp and dexp <= ddel:
        return False, (
            "La date d'expiration précède la date de délivrance. "
            f"Expiration: {dexp}, Délivrance: {ddel}"
        )
    if ddn and dexp and dexp <= ddn:
        return False, (
            "La date d'expiration précède la date de naissance. "
            f"Expiration: {dexp}, Naissance: {ddn}"
        )
    if ddn:
        age = (date.today() - ddn).days / 365.25
        if age > 150:
            return False, f"Âge improbable : {age:.0f} ans."
    return True, "Chronologie des dates cohérente."

def _detecter_anomalies(
    recto: Optional[DonneesCNIExtraites],
    verso: Optional[DonneesCNIExtraites],
    mrz_data: dict,
) -> list:
    """
    Détecte les anomalies et tentatives de fraude potentielles.
    Vérifie :
       - Document expiré depuis longtemps
       - Âge incohérent avec le type de document
       - Données contradictoires entre sources
       - OCR de très mauvaise qualité
    """
    anomalies = []
    source = recto or verso
    if source:
        # Document expiré
        if source.date_expiration:
            try:
                dexp = datetime.strptime(
                    source.date_expiration.strip(), "%d/%m/%Y",
                ).date()
                if dexp < date.today():
                    jours_expire = (date.today() - dexp).days
                    if jours_expire > 365:
                        anomalies.append(
                            f"Document expiré depuis {jours_expire} jours."
                        )
            except ValueError:
                pass
        # Âge
        if source.date_naissance:
            try:
                ddn = datetime.strptime(
                    source.date_naissance.strip(), "%d/%m/%Y",
                ).date()
                age = (date.today() - ddn).days / 365.25
                if age < 0:
                    anomalies.append("Date de naissance dans le futur.")
                elif age < 16 and source.format_carte == "nouveau_2021":
                    anomalies.append(
                        f"Âge ({age:.0f} ans) faible pour une CNI."
                    )
            except ValueError:
                anomalies.append("Format de date de naissance invalide.")
        # Confiance OCR très faible
        if source.taux_confiance_moyen is not None:
            if source.taux_confiance_moyen < 0.3:
                anomalies.append(
                    f"Qualité OCR faible ({source.taux_confiance_moyen:.0%})."
                )
    # Incohérence MRZ
    if mrz_data and source:
        if mrz_data.get("sexe") and source.sexe and source.sexe != "non_detecte":
            sexe_mrz = mrz_data["sexe"].upper()[:1]
            sexe_ocr = source.sexe.upper()[:1]
            if sexe_mrz in ("M", "F") and sexe_ocr in ("M", "F"):
                if sexe_mrz != sexe_ocr:
                    anomalies.append("Sexe différent entre MRZ et OCR texte.")
    return anomalies

def _calculer_score_confiance(
    verifications: dict,
    recto: Optional[DonneesCNIExtraites],
    verso: Optional[DonneesCNIExtraites],
    mrz_data: dict,
) -> float:
    """
    Calcule un score de confiance global basé sur la convergence des sources.
    Pondération :
       - MRZ valide : 40%
       - OCR texte (recto/verso) : 35%
       - Cohérence entre sources : 25%
    """
    score_mrz = 0.0
    score_ocr = 0.0
    score_coherence = 0.0
    # 1. Score MRZ
    if verifications.get("mrz_structure"):
        score_mrz = 1.0
        details_mrz = verifications.get("mrz_details", {})
        if isinstance(details_mrz, dict):
            checksums_ok = sum(1 for k, v in details_mrz.items()
                               if k.startswith("checksum") and v)
            score_mrz = min(0.5 + (checksums_ok * 0.15), 1.0)
    # 2. Score OCR
    confiances_ocr = []
    for source_key in ("recto", "verso"):
        if source_key in verifications:
            v = verifications[source_key]
            if isinstance(v, dict):
                confiances_ocr.append(v.get("taux_completion", 0))
                confiances_ocr.append(v.get("confiance_ocr", 0))
    if confiances_ocr:
        score_ocr = sum(confiances_ocr) / len(confiances_ocr)
    # 3. Score de cohérence
    coherence_keys = [
        "coherence_recto_verso",
        "coherence_mrz_ocr",
        "coherence_dates",
    ]
    coherent_count = sum(
        1 for k in coherence_keys
        if verifications.get(k, True)  # True par défaut si pas de conflit
    )
    score_coherence = coherent_count / len(coherence_keys)
    # Score final pondéré
    score_final = (
        score_mrz * POIDS_MRZ
        + score_ocr * POIDS_OCR_TEXTE
        + score_coherence * POIDS_COHERENCE
    )
    return min(score_final, 1.0)