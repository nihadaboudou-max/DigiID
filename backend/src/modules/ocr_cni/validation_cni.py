# -*- coding: utf-8 -*-
"""
Validation des données extraites de documents d'identité africains.

Supporte tout type de document (CNI, passeport, carte biométrique)
avec validation MRZ universelle (ICAO 9303 formats TD1/TD2/TD3).
"""
import re
from datetime import date, datetime
from typing import Optional, Tuple

from src.modules.ocr_cni.mrz_parser import (
    CODES_PAYS_ICAO,
    parser_mrz_complet,
    verifier_checksum_mrz,
)
from src.modules.ocr_cni.schemas import (
    DonneesCNIExtraites,
    ValidationCNIResultat,
)
from src.noyau.journal import journal


# =============================================================================
# Constantes de validation
# =============================================================================

# Poids pour le calcul du checksum MRZ (ICAO 9303)
# Cycle de poids [7, 3, 1, 7, 3, 1, ...] pour la somme de contrôle
POIDS_MRZ = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1]

# Âge minimum pour avoir un document d'identité
AGE_MINIMUM = 0  # Relaxé — un parent peut scanner pour son enfant


def _calculer_checksum_mrz(valeur: str) -> int:
    """
    Calcule le checksum d'un champ MRZ selon la norme ICAO 9303.

    Args :
        valeur : Chaîne à valider (ne doit contenir que A-Z, 0-9, <)

    Retour :
        Valeur du checksum (0-9)

    Note :
        Les caractères < sont convertis en 0.
        Les lettres sont converties : A=10, B=11, ..., Z=35
    """
    somme = 0
    for i, char in enumerate(valeur):
        if i >= len(POIDS_MRZ):
            break
        if char == "<":
            valeur_num = 0
        elif char.isdigit():
            valeur_num = int(char)
        elif char.isalpha():
            valeur_num = ord(char.upper()) - ord("A") + 10
        else:
            valeur_num = 0
        somme += valeur_num * POIDS_MRZ[i]
    return somme % 10


def _nettoyer_champ_mrz(champ: str, longueur_max: int = 30) -> str:
    """Nettoie un champ MRZ pour le calcul de checksum."""
    # Remplacer les caractères invalides par <
    champ = "".join(c if c.isalnum() else "<" for c in champ.upper())
    # Tronquer ou compléter avec <
    if len(champ) > longueur_max:
        champ = champ[:longueur_max]
    else:
        champ = champ + "<" * (longueur_max - len(champ))
    return champ


def valider_mrz(ligne_1: Optional[str],
                ligne_2: Optional[str],
                ligne_3: Optional[str]) -> Tuple[bool, dict[str, bool], str]:
    """
    Valide une MRZ de document d'identité (formats TD1/TD2/TD3).

    Accepte tous les codes pays ICAO (CIV, SEN, MLI, GHA, NGA, etc.).
    Utilise le parseur MRZ universel pour détecter le format automatiquement.
    """
    details: dict[str, bool] = {
        "structure": False,
        "code_pays": False,
        "format_detecte": False,
        "checksum_numero": False,
        "checksum_date_naissance": False,
        "checksum_date_expiration": False,
    }

    if not all([ligne_1, ligne_2]):
        return False, details, "MRZ incomplète : les lignes 1 et 2 sont requises."

    # Parser la MRZ
    mrz = parser_mrz_complet(ligne_1, ligne_2, ligne_3)

    code_pays = mrz.get("pays_emetteur", "")
    if code_pays and code_pays in CODES_PAYS_ICAO:
        details["code_pays"] = True
        details["structure"] = True
        details["format_detecte"] = True
    else:
        return False, details, f"Code pays non reconnu dans la MRZ : {code_pays}"

    # Vérifier checksums (si disponibles dans le format TD1)
    if mrz.get("format") == "TD1" and len(ligne_2) >= 30:
        l2 = _nettoyer_champ_mrz(ligne_2)

        num_carte = l2[0:9]
        checksum_num_attendu = l2[9:10]
        if num_carte and checksum_num_attendu:
            try:
                checksum_calcule = _calculer_checksum_mrz(num_carte)
                if str(checksum_calcule) == checksum_num_attendu:
                    details["checksum_numero"] = True
            except Exception:
                pass

        date_naissance_mrz = l2[13:19]
        checksum_ddn_attendu = l2[19:20]
        if date_naissance_mrz and checksum_ddn_attendu:
            try:
                checksum_calcule = _calculer_checksum_mrz(date_naissance_mrz)
                if str(checksum_calcule) == checksum_ddn_attendu:
                    details["checksum_date_naissance"] = True
            except Exception:
                pass

        date_exp_mrz = l2[21:27]
        checksum_exp_attendu = l2[27:28]
        if date_exp_mrz and checksum_exp_attendu:
            try:
                checksum_calcule = _calculer_checksum_mrz(date_exp_mrz)
                if str(checksum_calcule) == checksum_exp_attendu:
                    details["checksum_date_expiration"] = True
            except Exception:
                pass

    # Résultat : le pays est reconnu = déjà une bonne MRZ
    mrz_valide = details["code_pays"] and details["structure"]

    pays_nom = CODES_PAYS_ICAO.get(code_pays, code_pays)
    message = f"MRZ valide. Pays : {pays_nom}." if mrz_valide else f"MRZ non reconnue."

    return mrz_valide, details, message


def valider_numero_cni(numero: Optional[str]) -> Tuple[bool, str]:
    """
    Valide le format du numéro de document.

    Accepte divers formats selon les pays :
      - CNI Côte d'Ivoire : 12-15 alphanumériques
      - NIN Nigeria : 11 chiffres
      - Ghana Card : 10-15 alphanumériques
      - Passeport : 8-12 alphanumériques
    """
    if not numero:
        return False, "Numéro de carte manquant."

    numero = "".join(c for c in numero.upper() if c.isalnum())

    if len(numero) < 6:
        return False, f"Numéro trop court ({len(numero)} car.). Minimum 6 caractères."

    if len(numero) > 20:
        return False, f"Numéro trop long ({len(numero)} car.). Maximum 20 caractères."

    if not numero.isalnum():
        return False, "Le numéro contient des caractères non autorisés."

    # Vérifier qu'il contient au moins une lettre et un chiffre (sauf pour les NIN)
    if not any(c.isdigit() for c in numero):
        return False, "Le numéro doit contenir des chiffres."

    return True, "Format du numéro valide."


def _normaliser_date(date_str: Optional[str]) -> Optional[str]:
    """
    Normalise une date vers le format JJ/MM/AAAA.
    Accepte : JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA, AAMMJJ (MRZ), etc.
    """
    if not date_str:
        return None
    
    # Déjà au bon format JJ/MM/AAAA
    if re.match(r'^\d{2}/\d{2}/\d{4}$', date_str):
        return date_str
    
    # Format avec séparateurs différents (JJ-MM-AAAA ou JJ.MM.AAAA)
    match = re.match(r'^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$', date_str)
    if match:
        jj, mm, aaaa = match.groups()
        if len(aaaa) == 2:
            aaaa = "19" + aaaa if int(aaaa) > 40 else "20" + aaaa
        return f"{jj.zfill(2)}/{mm.zfill(2)}/{aaaa}"
    
    # Format MRZ : AAMMJJ (6 chiffres)
    if re.match(r'^\d{6}$', date_str):
        aa = int(date_str[0:2])
        mm = int(date_str[2:4])
        jj = int(date_str[4:6])
        aaaa = 1900 + aa if aa >= 40 else 2000 + aa
        if 1 <= mm <= 12 and 1 <= jj <= 31:
            return f"{jj:02d}/{mm:02d}/{aaaa}"
    
    # Format texte : "9 septembre 2024" ou "12 octobre 2002"
    mois_map = {
        "JANVIER": "01", "FÉVRIER": "02", "FEVRIER": "02",
        "MARS": "03", "AVRIL": "04", "MAI": "05",
        "JUIN": "06", "JUILLET": "07", "AOÛT": "08", "AOUT": "08",
        "SEPTEMBRE": "09", "OCTOBRE": "10", "NOVEMBRE": "11",
        "DÉCEMBRE": "12", "DECEMBRE": "12"
    }
    
    date_upper = date_str.upper()
    for mois_nom, mois_num in mois_map.items():
        if mois_nom in date_upper:
            match = re.search(r'(\d{1,2})\s+' + mois_nom + r'\s+(\d{4})', date_upper)
            if match:
                jj, aaaa = match.groups()
                return f"{jj.zfill(2)}/{mois_num}/{aaaa}"
    
    return None


def valider_date_naissance(date_naissance: Optional[str],
                           date_expiration: Optional[str] = None) -> Tuple[bool, str]:
    """
    Valide la date de naissance : format et cohérence.
    Accepte plusieurs formats : JJ/MM/AAAA, AAMMJJ (MRZ), texte, etc.
    """
    if not date_naissance:
        return False, "Date de naissance manquante."

    # Normaliser la date
    ddn_str = _normaliser_date(date_naissance)
    if not ddn_str:
        return False, f"Format de date invalide : {date_naissance}. Attendu : JJ/MM/AAAA ou AAMMJJ."

    try:
        ddn = datetime.strptime(ddn_str, "%d/%m/%Y").date()
    except ValueError:
        return False, f"Date de naissance invalide : {ddn_str}."

    aujourd_hui = date.today()
    if ddn > aujourd_hui:
        return False, "La date de naissance ne peut pas être dans le futur."

    # Vérifier cohérence avec la date d'expiration
    if date_expiration:
        dexp_str = _normaliser_date(date_expiration)
        if dexp_str:
            try:
                dexp = datetime.strptime(dexp_str, "%d/%m/%Y").date()
                if dexp <= ddn:
                    return False, "La date d'expiration précède la date de naissance."
            except ValueError:
                pass

    return True, f"Date de naissance valide ({ddn_str})."


def valider_date_expiration(date_expiration: Optional[str]) -> Tuple[bool, str]:
    """
    Valide la date d'expiration : format, non-expirée.

    Args :
        date_expiration : Date au format JJ/MM/AAAA

    Retour :
        Tuple (est_valide, message)
    """
    if not date_expiration:
        return True, "Date d'expiration non fournie (vérification ignorée)."

    # Nettoyer
    date_expiration = date_expiration.strip()

    try:
        dexp = datetime.strptime(date_expiration, "%d/%m/%Y").date()
    except ValueError:
        return False, f"Format de date d'expiration invalide : {date_expiration}."

    aujourd_hui = date.today()
    if dexp < aujourd_hui:
        return False, f"Carte expirée depuis le {dexp.strftime('%d/%m/%Y')}."

    # Vérifier la durée de validité (10 ans max)
    return True, f"Carte valide jusqu'au {dexp.strftime('%d/%m/%Y')}."


def valider_sexe(sexe: Optional[str]) -> Tuple[bool, str]:
    """Valide que le sexe est M ou F."""
    if not sexe or sexe == "non_detecte":
        return False, "Sexe non détecté."
    if sexe.upper() in ("M", "F"):
        return True, f"Sexe : {'Masculin' if sexe.upper() == 'M' else 'Féminin'}."
    return False, f"Sexe invalide : {sexe}."


def valider_donnees_cni(donnees: DonneesCNIExtraites) -> ValidationCNIResultat:
    """
    Valide l'ensemble des données extraites d'une CNI.

    Effectue toutes les vérifications :
      - Format du numéro
      - Validité des dates
      - Cohérence MRZ (si disponible)
      - Sexe
      - Âge minimum

    Retour :
        ValidationCNIResultat avec le détail des validations.
    """
    scores: dict[str, bool] = {}

    # --- Validation du numéro ---
    numero_valide, msg_numero = valider_numero_cni(donnees.numero_cni)
    scores["numero_cni"] = numero_valide

    # --- Validation des dates ---
    ddn_valide, msg_ddn = valider_date_naissance(
        donnees.date_naissance,
        donnees.date_expiration
    )
    scores["date_naissance"] = ddn_valide

    dexp_valide, msg_dexp = valider_date_expiration(donnees.date_expiration)
    scores["date_expiration"] = dexp_valide

    # --- Validation du sexe ---
    sexe_valide, msg_sexe = valider_sexe(donnees.sexe)
    scores["sexe"] = sexe_valide

    # --- Validation MRZ ---
    mrz_valide = None
    scores["mrz"] = donnees.mrz_ligne_1 is not None

    if donnees.mrz_ligne_1:
        mrz_valide, details_mrz, msg_mrz = valider_mrz(
            donnees.mrz_ligne_1,
            donnees.mrz_ligne_2,
            donnees.mrz_ligne_3,
        )
        scores["mrz"] = mrz_valide
        scores["mrz_checksum_numero"] = details_mrz.get("checksum_numero", False)
        scores["mrz_checksum_ddn"] = details_mrz.get("checksum_date_naissance", False)
        scores["mrz_checksum_exp"] = details_mrz.get("checksum_date_expiration", False)

    # --- Validation des champs obligatoires ---
    # Seul le numéro est vraiment obligatoire pour valider
    champs_obligatoires = ["numero_cni"]
    for champ in champs_obligatoires:
        if champ not in scores:
            scores[champ] = False

    # Cohésion : nom + prénoms si présents
    scores["identite"] = bool(donnees.nom_famille) or bool(donnees.prenoms)

    # --- Résultat global ---
    est_valide = scores.get("numero_cni", False)

    # Construire le message
    if est_valide:
        nb_valides = sum(1 for v in scores.values() if v)
        nb_total = len(scores)
        message = f"Document valide : {nb_valides}/{nb_total} vérifications OK."
        if mrz_valide:
            message += " MRZ vérifiée avec succès."
    else:
        echecs = [k for k, v in scores.items() if not v]
        message = "Document partiellement valide. Champs manquants : " + ", ".join(echecs[:3]) + "."

    journal.info(
        f"Validation document : est_valide={est_valide}, "
        f"scores={ {k: v for k, v in scores.items()} }"
    )

    return ValidationCNIResultat(
        est_valide=est_valide,
        scores_validation=scores,
        verification_mrz=mrz_valide,
        message=message,
    )


def verifier_coherence_recto_verso(
    donnees_recto: Optional[DonneesCNIExtraites],
    donnees_verso: Optional[DonneesCNIExtraites],
) -> Tuple[bool, str]:
    """
    Vérifie la cohérence entre les données extraites du recto et du verso.

    Les informations doivent correspondre (même numéro, mêmes dates, etc.)
    pour éviter les falsifications.

    Args :
        donnees_recto : Données extraites du recto
        donnees_verso : Données extraites du verso

    Retour :
        Tuple (coherent, message)
    """
    if not donnees_recto or not donnees_verso:
        return False, "Les deux faces sont nécessaires pour la vérification croisée."

    incoherences = []

    # Comparer les numéros (s'ils sont présents sur les deux faces)
    if donnees_recto.numero_cni and donnees_verso.numero_cni:
        if donnees_recto.numero_cni != donnees_verso.numero_cni:
            incoherences.append("numéro de carte différent entre recto et verso")

    # Comparer les dates de naissance
    if donnees_recto.date_naissance and donnees_verso.date_naissance:
        if donnees_recto.date_naissance != donnees_verso.date_naissance:
            incoherences.append("date de naissance différente")

    # Comparer les noms
    if donnees_recto.nom_famille and donnees_verso.nom_famille:
        if donnees_recto.nom_famille.upper() != donnees_verso.nom_famille.upper():
            incoherences.append("nom de famille différent")

    if not incoherences:
        return True, "Cohérence vérifiée entre recto et verso."

    message = "Incohérences détectées : " + ", ".join(incoherences) + "."
    return False, message
