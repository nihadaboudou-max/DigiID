# -*- coding: utf-8 -*-
"""Extraction (regex + nettoyage) du Certificat d'Identification Personnelle.

Champs cibles (document ANIP / Bénin) :
  - NPI (numéro de pièce)
  - Nom, Prénom(s), Date / Lieu de naissance, Nationalité, Téléphone
  - Adresse (Com. / Arr. / Quart. / Lieu)
  - Filiation (Père / Mère)
  - Date d'expiration (« Expire le »)
"""
import re
import unicodedata
from typing import List, Optional

from src.modules.ocr_cip.schemas import DonneesCIPExtraites
from src.noyau.journal import journal

LABELS_A_EXCLURE = {
    "NOM", "PRENOM", "PRENOMS", "DATE", "LIEU", "NAISSANCE", "NATIONALITE",
    "TELEPHONE", "ADRESSE", "RESIDENCE", "PERE", "MERE", "FILIATION",
    "EXPIRE", "DELIVRANCE", "REPUBLIQUE", "BENIN", "CERTIFICAT",
    "IDENTIFICATION", "PERSONNELLE", "NUMERO", "PERSONNEL", "ANIP",
    "COM", "ARR", "QUART", "TITULAIRE",
}


def _sans_accents(texte: str) -> str:
    texte = unicodedata.normalize("NFKD", texte or "")
    return "".join(c for c in texte if not unicodedata.combining(c))


def _nettoyer_texte(texte: str) -> str:
    texte = _sans_accents(texte or "").upper()
    texte = re.sub(r"[ \t]+", " ", texte)
    return texte.strip()


def _extraire_apres(texte: str, patterns: List[str], longueur: int = 60) -> Optional[str]:
    for pat in patterns:
        m = re.search(
            rf"{pat}\s*[:\-]?\s*([A-Z0-9À-Ÿ][A-Z0-9À-Ÿ\s\-\./']{{0,{longueur}}}?)"
            rf"(?=\n|\s{{3,}}|$|NOM|PRENOM|DATE|LIEU|NATIONAL|TELEPHONE|ADRESSE|PERE|MERE|EXPIRE)",
            texte,
        )
        if m:
            valeur = re.sub(r"\s+", " ", m.group(1)).strip(" .-:")
            if valeur and valeur.upper() not in LABELS_A_EXCLURE and len(valeur) >= 2:
                return valeur
    return None


def _extraire_npi(texte: str) -> Optional[str]:
    """NPI = Numéro Personnel d'Identification (pièce du CIP)."""
    for pat in [
        r"NUMERO\s*PERSONNEL\s*D['’]?\s*IDENTIFICATION",
        r"N\s*[°O]?\s*PERSONNEL\s*D['’]?\s*IDENTIFICATION",
        r"\bNPI\b",
    ]:
        m = re.search(rf"{pat}\s*[:\-]?\s*([0-9]{{8,14}})", texte)
        if m:
            return m.group(1)

    # Repli : suite de 10 chiffres isolée près de « NPI » / « IDENTIFICATION »
    m = re.search(
        r"(?:NPI|IDENTIFICATION|PERSONNEL).{0,40}?([0-9]{10})",
        texte,
    )
    if m:
        return m.group(1)

    return None


def _extraire_numero_serie(texte: str) -> Optional[str]:
    """Numéro de série imprimé près de la photo (souvent 13 chiffres)."""
    m = re.search(r"\b([0-9]{12,14})\b", texte)
    if m:
        return m.group(1)
    return None


def _extraire_date(texte: str, contextes: List[str]) -> Optional[str]:
    for contexte in contextes:
        m = re.search(
            rf"{contexte}\s*[:\-]?\s*(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}})",
            texte,
        )
        if m:
            return m.group(1)
    return None


def _extraire_adresse_composee(texte: str) -> dict:
    """Com. / Arr. / Quart. / Lieu sous « Adresse de résidence »."""
    resultat = {
        "commune": None,
        "arrondissement": None,
        "quartier": None,
        "adresse": None,
    }
    m_com = re.search(r"COM\.?\s*[:\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-]{1,40})", texte)
    m_arr = re.search(r"ARR\.?\s*[:\-]?\s*([A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9\s\-]{0,40})", texte)
    m_quart = re.search(r"QUART\.?\s*[:\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-]{1,40})", texte)
    m_lieu = re.search(r"LIEU\s*[:\-]?\s*([A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9\s\-/,]{1,80})", texte)

    if m_com:
        resultat["commune"] = m_com.group(1).strip()
    if m_arr:
        resultat["arrondissement"] = m_arr.group(1).strip()
    if m_quart:
        resultat["quartier"] = m_quart.group(1).strip()

    parties = [
        f"Com. : {resultat['commune']}" if resultat["commune"] else None,
        f"Arr. : {resultat['arrondissement']}" if resultat["arrondissement"] else None,
        f"Quart. : {resultat['quartier']}" if resultat["quartier"] else None,
        f"Lieu : {m_lieu.group(1).strip()}" if m_lieu else None,
    ]
    compose = " | ".join(p for p in parties if p)
    if compose:
        resultat["adresse"] = compose
    else:
        resultat["adresse"] = _extraire_apres(
            texte, [r"ADRESSE\s*DE\s*RESIDENCE", r"ADRESSE"], 120
        )
    return resultat


def _extraire_telephone(texte: str) -> Optional[str]:
    m = re.search(
        r"(?:NUMERO\s*DE\s*)?TELEPHONE\s*[:\-]?\s*((?:\+?229[\s\-]?)?[0-9][0-9\s\-]{7,14})",
        texte,
    )
    if m:
        return re.sub(r"[\s\-]+", "", m.group(1))
    return None


def extraire_donnees_cip(
    texte_brut: str,
    confiance: float = 0.0,
    *,
    qr_detecte: bool = False,
    qr_contenu: Optional[str] = None,
    embedding_present: bool = False,
) -> DonneesCIPExtraites:
    """Extraction robuste des champs d'un CIP ANIP."""
    if not texte_brut:
        return DonneesCIPExtraites(
            texte_brut="",
            taux_confiance_moyen=confiance,
            qr_code_detecte=qr_detecte,
            qr_code_contenu=qr_contenu,
            embedding_visage_present=embedding_present,
        )

    texte = _nettoyer_texte(texte_brut)

    npi = _extraire_npi(texte)
    numero_serie = _extraire_numero_serie(texte)
    if numero_serie and npi and numero_serie == npi:
        numero_serie = None

    nom_famille = _extraire_apres(texte, [r"\bNOM\b"], 40)
    prenoms = _extraire_apres(texte, [r"PRENOM\s*\(?S?\)?", r"PRENOMS"], 50)
    lieu_naissance = _extraire_apres(
        texte, [r"LIEU\s*DE\s*NAISSANCE", r"NE\s*A"], 50
    )
    nationalite = _extraire_apres(texte, [r"NATIONALITE"], 30) or (
        "BÉNIN" if "BENIN" in texte else None
    )
    telephone = _extraire_telephone(texte)
    adresse_parts = _extraire_adresse_composee(texte)

    nom_pere = _extraire_apres(texte, [r"\bPERE\b"], 50)
    nom_mere = _extraire_apres(texte, [r"\bMERE\b"], 50)

    date_naissance = _extraire_date(
        texte, [r"DATE\s*DE\s*NAISSANCE", r"NE\s*E?\s*LE", r"NAISSANCE"]
    )
    date_expiration = _extraire_date(
        texte, [r"EXPIRE\s*LE", r"EXPIRATION", r"VALABLE\s*JUSQU"]
    )
    date_delivrance = _extraire_date(
        texte, [r"DELIVRE\s*LE", r"DELIVRANCE", r"FAIT\s*LE"]
    )

    champs_ok = sum(
        bool(v)
        for v in (npi, nom_famille, prenoms, date_naissance, date_expiration)
    )
    journal.info(
        f"CIP — extraction : {champs_ok}/5 champs principaux | "
        f"QR={'oui' if qr_detecte else 'non'} | visage={'oui' if embedding_present else 'non'}"
    )

    return DonneesCIPExtraites(
        npi=npi,
        numero_document=npi,
        numero_serie=numero_serie,
        nom_famille=nom_famille,
        prenoms=prenoms,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        nationalite=nationalite,
        telephone=telephone,
        adresse=adresse_parts.get("adresse"),
        commune=adresse_parts.get("commune"),
        arrondissement=adresse_parts.get("arrondissement"),
        quartier=adresse_parts.get("quartier"),
        nom_pere=nom_pere,
        nom_mere=nom_mere,
        pays_emetteur="Bénin",
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        qr_code_detecte=qr_detecte,
        qr_code_contenu=qr_contenu,
        embedding_visage_present=embedding_present,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )
