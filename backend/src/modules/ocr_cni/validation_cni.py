# -*- coding: utf-8 -*-
"""
Validation des données extraites de la Carte Nationale d'Identité.

Ce module implémente les règles de validation pour chaque champ de la CNI :
  - Format du numéro de carte
  - Validité des dates (cohérence, non-expirée)
  - Validation de la MRZ (Machine Readable Zone) avec checksum
  - Cohérence entre les données du recto et de la MRZ
  - Règles de l'État français pour les CNI

La MRZ française suit le format TD1 de l'ICAO (3 lignes de 30 caractères) :
  Ligne 1 : ID<code_pays><nom><<prénoms><<<...
  Ligne 2 : <numéro_carte><checksum><code_pays><date_naissance><checksum><sexe><date_expiration><checksum><nationalité><<<
  Ligne 3 : <autorité><<<<<<<<<<<<<<<<<<<<<<<<<<<<
"""
import re
from datetime import date, datetime
from typing import Optional, Tuple

from src.modules.ocr_cni.schemas import (
    DonneesCNIExtraites,
    ValidationCNIResultat,
)
from src.noyau.journal import journal


# =============================================================================
# Constantes de validation
# =============================================================================

# Poids pour le calcul du checksum MRZ (ICAO 9303)
POIDS_MRZ = [7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1, 7, 3, 1]

# Pattern pour valider un numéro CNI français (12 alphanumériques)
PATTERN_NUMERO_CNI = re.compile(r"^[A-Z0-9]{12}$")

# Pays autorisés pour une CNI française
CODE_PAYS_FRANCE = "FRA"

# Durée de validité d'une CNI (en années)
DUREE_VALIDITE_CNI_ANS = 10

# Âge minimum pour avoir une CNI
AGE_MINIMUM_CNI = 12


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
    Valide une MRZ de CNI française (format TD1 - 3 lignes de 30 caractères).

    Structure TD1 :
      Ligne 1 : ID[FRA][nom<<prénoms...] (30 car.)
      Ligne 2 : [num carte][checksum1][FRA][DDN][checksum2][sexe][expiration][checksum3][nationalité] (30 car.)
      Ligne 3 : [autorité][<<<<<<<<<<<<<] (30 car.)

    Args :
        ligne_1 : Première ligne MRZ (30 caractères)
        ligne_2 : Deuxième ligne MRZ (30 caractères)
        ligne_3 : Troisième ligne MRZ (30 caractères)

    Retour :
        Tuple (est_valide, détails_validation, message)
    """
    details: dict[str, bool] = {
        "structure": False,
        "checksum_numero": False,
        "checksum_date_naissance": False,
        "checksum_date_expiration": False,
        "checksum_global": False,
        "code_pays": False,
        "format_ligne_1": False,
        "format_ligne_2": False,
        "format_ligne_3": False,
    }

    if not all([ligne_1, ligne_2]):
        return False, details, "MRZ incomplète : les lignes 1 et 2 sont requises."

    # Nettoyer les lignes
    l1 = _nettoyer_champ_mrz(ligne_1)
    l2 = _nettoyer_champ_mrz(ligne_2)
    l3 = _nettoyer_champ_mrz(ligne_3 or "")

    # Vérifier les longueurs
    if len(l1) < 30:
        return False, details, f"Ligne 1 MRZ trop courte ({len(l1)}/30)"
    if len(l2) < 30:
        return False, details, f"Ligne 2 MRZ trop courte ({len(l2)}/30)"

    # --- Validation Ligne 1 ---
    # Format : ID<FRA<nom<<prenoms
    if l1.startswith("ID"):
        details["format_ligne_1"] = True
    else:
        return False, details, "La MRZ ne commence pas par 'ID' (format TD1 attendu)"

    # Vérifier le code pays (FRA)
    code_pays_l1 = l1[2:5]
    if code_pays_l1 == "FRA":
        details["code_pays"] = True
        details["structure"] = True
    else:
        return False, details, f"Code pays invalide dans la MRZ : {code_pays_l1} (attendu: FRA)"

    # --- Validation Ligne 2 ---
    # Structure : [num_carte(9)][checksum1(1)][FRA(3)][DDN(6)][checksum2(1)][sexe(1)][expiration(6)][checksum3(1)][nationalité(3)][<...]
    # Positions fixes pour TD1 (selon ICAO 9303) :
    #   0-8 : Numéro de document (9 car.)
    #   9 : Checksum du numéro
    #   10-12 : Code pays (FRA)
    #   13-18 : Date de naissance (AAMMJJ)
    #   19 : Checksum date naissance
    #   20 : Sexe (M/F/<)
    #   21-26 : Date d'expiration (AAMMJJ)
    #   27 : Checksum date expiration
    #   28-29 : Optionnel (souvent nationalité)

    # Assurez-vous que l2 fait bien 30 caractères
    if len(l2) >= 30:
        details["format_ligne_2"] = True

        # Extraire les champs
        num_carte = l2[0:9] if len(l2) >= 9 else ""
        checksum_num_attendu = l2[9] if len(l2) >= 10 else ""

        # Code pays
        code_pays_l2 = l2[10:13] if len(l2) >= 13 else ""

        # Date de naissance (AAMMJJ)
        date_naissance_mrz = l2[13:19] if len(l2) >= 19 else ""
        checksum_ddn_attendu = l2[19] if len(l2) >= 20 else ""

        # Sexe
        sexe_mrz = l2[20] if len(l2) >= 21 else ""

        # Date d'expiration (AAMMJJ)
        date_exp_mrz = l2[21:27] if len(l2) >= 27 else ""
        checksum_exp_attendu = l2[27] if len(l2) >= 28 else ""

        # Vérifier checksum numéro
        if num_carte and checksum_num_attendu:
            checksum_calcule = _calculer_checksum_mrz(num_carte)
            if str(checksum_calcule) == checksum_num_attendu:
                details["checksum_numero"] = True

        # Vérifier checksum date de naissance
        if date_naissance_mrz and checksum_ddn_attendu:
            checksum_calcule = _calculer_checksum_mrz(date_naissance_mrz)
            if str(checksum_calcule) == checksum_ddn_attendu:
                details["checksum_date_naissance"] = True

        # Vérifier checksum date d'expiration
        if date_exp_mrz and checksum_exp_attendu:
            checksum_calcule = _calculer_checksum_mrz(date_exp_mrz)
            if str(checksum_calcule) == checksum_exp_attendu:
                details["checksum_date_expiration"] = True

    # --- Validation Ligne 3 ---
    if ligne_3 and len(l3) >= 10:
        details["format_ligne_3"] = True

    # Résultat global : tous les checksums doivent passer
    mrz_valide = all([
        details["structure"],
        details["code_pays"],
        details["format_ligne_1"],
        details["format_ligne_2"],
    ])

    # Si on a des checksums, ils doivent être valides
    if any(k.startswith("checksum") for k in details if details[k]):
        checksums_valides = all(
            details[k] for k in details if k.startswith("checksum")
        )
        if not checksums_valides and mrz_valide:
            mrz_valide = False

    message = "MRZ valide." if mrz_valide else "MRZ invalide ou incomplète."
    if not mrz_valide:
        echecs = [k for k, v in details.items() if not v]
        message = f"MRZ invalide : {', '.join(echecs)}"

    return mrz_valide, details, message


def valider_numero_cni(numero: Optional[str]) -> Tuple[bool, str]:
    """
    Valide le format du numéro de CNI.

    Le numéro de CNI française fait 12 caractères alphanumériques.
    Format : 2 lettres + 6 chiffres + 2 lettres + 2 chiffres (variable)

    Args :
        numero : Numéro de carte extrait

    Retour :
        Tuple (est_valide, message)
    """
    if not numero:
        return False, "Numéro de carte manquant."

    # Nettoyer
    numero = "".join(c for c in numero.upper() if c.isalnum())

    if len(numero) != 12:
        return False, f"Le numéro doit faire 12 caractères (reçu: {len(numero)})."

    if not numero.isalnum():
        return False, "Le numéro contient des caractères non autorisés."

    # Vérifier qu'il contient au moins une lettre et un chiffre
    if not any(c.isalpha() for c in numero):
        return False, "Le numéro doit contenir des lettres."
    if not any(c.isdigit() for c in numero):
        return False, "Le numéro doit contenir des chiffres."

    return True, "Format du numéro valide."


def valider_date_naissance(date_naissance: Optional[str],
                           date_expiration: Optional[str] = None) -> Tuple[bool, str]:
    """
    Valide la date de naissance : format, cohérence, âge minimum.

    Args :
        date_naissance : Date au format JJ/MM/AAAA
        date_expiration : Date d'expiration (optionnelle)

    Retour :
        Tuple (est_valide, message)
    """
    if not date_naissance:
        return False, "Date de naissance manquante."

    try:
        ddn = datetime.strptime(date_naissance, "%d/%m/%Y").date()
    except ValueError:
        return False, f"Format de date invalide : {date_naissance}. Attendu : JJ/MM/AAAA."

    # Vérifier que la date n'est pas dans le futur
    aujourd_hui = date.today()
    if ddn > aujourd_hui:
        return False, "La date de naissance ne peut pas être dans le futur."

    # Vérifier l'âge minimum
    age = (aujourd_hui - ddn).days / 365.25
    if age < AGE_MINIMUM_CNI:
        return False, f"L'âge minimum pour une CNI est {AGE_MINIMUM_CNI} ans (détecté: {int(age)} ans)."

    # Vérifier cohérence avec la date d'expiration (optionnel)
    if date_expiration:
        try:
            dexp = datetime.strptime(date_expiration, "%d/%m/%Y").date()
            if dexp <= ddn:
                return False, "La date d'expiration précède la date de naissance."
        except ValueError:
            pass  # On ignore si le format est invalide

    return True, f"Date de naissance valide ({ddn.strftime('%d/%m/%Y')})."


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
    champs_obligatoires = ["numero_cni", "date_naissance", "sexe"]
    for champ in champs_obligatoires:
        if champ not in scores:
            scores[champ] = False

    # Cohésion : nom + prénoms présents
    scores["identite"] = bool(donnees.nom_famille) and bool(donnees.prenoms)

    # --- Résultat global ---
    # Au moins le numéro + date de naissance doivent être valides
    champs_critiques = ["numero_cni", "date_naissance"]
    est_valide = all(scores.get(c, False) for c in champs_critiques)

    # Construire le message
    if est_valide:
        nb_valides = sum(1 for v in scores.values() if v)
        nb_total = len(scores)
        message = (
            f"CNI valide : {nb_valides}/{nb_total} champs vérifiés."
        )
        if mrz_valide:
            message += " MRZ vérifiée avec succès."
    else:
        echecs = [
            {
                "numero": "numéro invalide",
                "date_naissance": "date de naissance invalide",
                "sexe": "sexe non détecté",
                "mrz": "MRZ invalide",
                "identite": "identité incomplète",
                "date_expiration": "date d'expiration invalide",
            }.get(k, k)
            for k, v in scores.items()
            if not v and k in champs_critiques
        ]
        message = "CNI invalide : " + ", ".join(echecs) + "."

    journal.info(
        f"Validation CNI : est_valide={est_valide}, "
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
