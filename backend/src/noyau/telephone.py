# -*- coding: utf-8 -*-
"""
Validation et normalisation des numéros de téléphone — format Bénin (+229).

RÈGLES MÉTIER (contrainte S3)
=============================
1. Tout numéro est stocké **normalisé** : ``+229`` suivi de 10 chiffres
   (plan de numérotation béninois depuis 2024 : ``01`` + 8 chiffres).
2. Un numéro ne peut être associé qu'à **un seul compte** : le numéro est
   chiffré au repos (AES-256-GCM) mais on conserve son **empreinte SHA-256**
   (``Utilisateur.telephone_hash``) qui porte la contrainte d'unicité et permet
   la recherche sans déchiffrer la base.
3. La vérification par **OTP/SMS** conditionne l'activation du compte
   (``Utilisateur.est_telephone_verifie``).

Formes acceptées en entrée (saisie guichet, presse-papiers, carnet de contacts) :
    +229 01 97 12 34 56 · 0022901971234 56 · 0197123456 · 97 12 34 56
Toutes ressortent sous la forme canonique ``+2290197123456``.
"""
from __future__ import annotations

import hashlib
import re
from typing import Optional

from src.noyau.exceptions import ErreurValidation

#: Indicatif international du Bénin.
INDICATIF_BENIN = "+229"

#: ``+229`` + 10 chiffres (``01`` … ``09`` puis 8 chiffres).
MOTIF_BENIN = re.compile(r"^\+229(0[1-9]\d{8})$")

#: Caractères tolérés dans une saisie utilisateur.
_CARACTERES_SAISIE = re.compile(r"[\s.\-()/]")


def normaliser_telephone(valeur: Optional[str]) -> Optional[str]:
    """
    Normalise un numéro béninois en ``+229XXXXXXXXXX``.

    Retourne ``None`` si la valeur est vide. Lève ``ErreurValidation`` si le
    numéro est présent mais mal formé (message prêt pour l'utilisateur).
    """
    if valeur is None:
        return None

    brut = _CARACTERES_SAISIE.sub("", str(valeur)).strip()
    if not brut:
        return None

    # ``00229…`` (forme internationale composée) → ``+229…``
    avec_indicatif = brut.startswith("+")
    if brut.startswith("00"):
        brut = "+" + brut[2:]
        avec_indicatif = True

    chiffres = brut.lstrip("+")

    # 2. Retirer l'indicatif s'il est présent.
    indicatif_benin = chiffres.startswith("229")
    if indicatif_benin:
        chiffres = chiffres[3:]

    # 3. Numéro local : 10 chiffres (01…) ou 8 chiffres (ancien plan → 01).
    # ⚠️ Le complément « 01 » ne s'applique qu'à une saisie **locale** (sans
    #    indicatif) : ``+229 01 97 12 34`` (tronqué) doit être refusé, et non
    #    « réparé » en un numéro faux.
    if not avec_indicatif and len(chiffres) == 8:
        chiffres = "01" + chiffres

    candidat = f"{INDICATIF_BENIN}{chiffres}"
    if not MOTIF_BENIN.match(candidat):
        raise ErreurValidation(
            f"Numéro de téléphone invalide : {valeur!r}",
            message_utilisateur=(
                "Numéro invalide. Format attendu : +229 01 XX XX XX XX."
            ),
            donnees_supplementaires={"champ": "telephone"},
        )
    return candidat


def hasher_telephone(normalise: str) -> str:
    """Empreinte SHA-256 du numéro normalisé (colonne d'unicité, indexée)."""
    return hashlib.sha256(normalise.encode("utf-8")).hexdigest()


def masquer_telephone(normalise: Optional[str]) -> Optional[str]:
    """Version affichable : ``+229 01 ** ** 34 56``."""
    if not normalise:
        return None
    chiffres = normalise.replace(INDICATIF_BENIN, "")
    if len(chiffres) < 8:
        return normalise
    return (
        f"{INDICATIF_BENIN} {chiffres[:2]} ** ** {chiffres[-4:-2]} {chiffres[-2:]}"
    )


def est_telephone_benin(valeur: Optional[str]) -> bool:
    """Validation non bloquante (formulaires, imports)."""
    try:
        return normaliser_telephone(valeur) is not None
    except ErreurValidation:
        return False


#: Numéro international générique : ``+`` + 8 à 15 chiffres (E.164).
MOTIF_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def normaliser_numero_tiers(valeur: Optional[str]) -> Optional[str]:
    """
    Normalise un numéro **tiers** saisi au guichet (destinataire d'un colis,
    proche à prévenir, acheteur du ticket, passager).

    Différence avec :func:`normaliser_telephone` (qui concerne le compte) :
      - un numéro béninois est ramené à la forme canonique ``+229…`` ;
      - un numéro **étranger** explicite (``+226…``, ``+33…``) est conservé
        sous sa forme E.164 — un colis peut venir du Burkina ou du Togo ;
      - en revanche toute saisie qui n'est ni un numéro béninois, ni un
        international plausible est **refusée** : c'est ce point qui empêche
        d'enregistrer « n'importe quoi » dans un formulaire de colis.

    Lève ``ValueError`` (→ HTTP 422 côté FastAPI) si le numéro est invalide.
    """
    if valeur is None:
        return None
    brut = _CARACTERES_SAISIE.sub("", str(valeur)).strip()
    if not brut:
        return None

    try:
        return normaliser_telephone(brut)
    except ErreurValidation:
        # Un numéro explicitement béninois (+229…) mais mal formé ne doit
        # JAMAIS être « récupéré » par la branche internationale.
        if brut.startswith(("+229", "00229")):
            raise ValueError(
                f"Numéro invalide ({valeur!r}) : format attendu "
                "+229 01 XX XX XX XX."
            )
        pass  # pas un numéro béninois → on tente l'international

    compose = brut[2:] if brut.startswith("00") else brut
    if not compose.startswith("+"):
        compose = "+" + compose
    if compose.count("+") != 1 or not MOTIF_E164.match(compose):
        raise ValueError(
            f"Numéro invalide ({valeur!r}) : format attendu +229 01 XX XX XX XX."
        )
    return compose
