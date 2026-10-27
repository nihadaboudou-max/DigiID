# -*- coding: utf-8 -*-
"""Extraction (regex + nettoyage) du Certificat d'Identification Personnelle.

Champs cibles (document ANIP / Bénin) — structure type du CIP :
  - En-tête : RÉPUBLIQUE DU BÉNIN / CERTIFICAT D'IDENTIFICATION PERSONNELLE
  - N° de série (12–14 chiffres, près de la photo)
  - NPI = « Numéro Personnel d'Identification » (~10 chiffres, en haut à droite)
  - Nom, Prénom(s), Date / Lieu de naissance (souvent « 12 octobre 2002 », « Com. : … »)
  - Nationalité, Téléphone
  - Adresse de résidence : Com. / Arr. / Quart. / Lieu
  - Filiation : Père / Mère
  - Expire le : JJ/MM/AAAA (souvent en rouge)
  - QR code + photo titulaire
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

# Communes fréquentes (corrige collage OCR du type « SPARAKOU » ← « Com. : PARAKOU »).
_COMMUNES_BENIN = {
    "PARAKOU", "COTONOU", "PORTO-NOVO", "ABOMEY", "ABOMEY-CALAVI", "BOHICON",
    "NATITINGOU", "DJougou", "DJOUGOU", "LOKOSSA", "OUIDAH", "KANDI",
    "SAVALOU", "COME", "COMé", "SEME-PODJI", "SEME-KPODJI", "ALLADA",
}

_MOIS_FR = {
    "JANVIER": "01", "FEVRIER": "02", "MARS": "03", "AVRIL": "04",
    "MAI": "05", "JUIN": "06", "JUILLET": "07", "AOUT": "08",
    "SEPTEMBRE": "09", "OCTOBRE": "10", "NOVEMBRE": "11", "DECEMBRE": "12",
    # Variantes OCR fréquentes
    "ECTOBRE": "10", "0CTOBRE": "10", "0CT0BRE": "10",
    "NQVEMBRE": "11", "N0VEMBRE": "11",
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
        # Séparateurs OCR bruités : « Prenomt)a NIHAD », « Nome -ABOUDOU »
        m = re.search(
            rf"{pat}[\s/:.)\-]*([A-ZÀ-Ÿ][A-Z0-9À-Ÿ\s\-\./']{{0,{longueur}}}?)"
            rf"(?=\n|\s{{3,}}|$|NOM|PRENOM|DATE|LIEU|NATIONAL|TELEPHONE|ADRESSE|PERE|MERE|EXPIRE|QUART|ARR)",
            texte,
        )
        if m:
            valeur = re.sub(r"\s+", " ", m.group(1)).strip(" .-:)")
            # Préfixe OCR collé (« a NIHAD » ← « Prenomt)a NIHAD »)
            valeur = re.sub(r"^[A-Z]\s+(?=[A-Z]{2,})", "", valeur)
            # Suffixes OCR courts (« . IF », « 4 »)
            valeur = re.sub(r"\s+[A-Z0-9]{1,2}$", "", valeur).strip(" .-:")
            if valeur and valeur.upper() not in LABELS_A_EXCLURE and len(valeur) >= 2:
                return valeur
    return None


# Confusions OCR fréquentes sur les chiffres du CIP.
# ⚠️ Ne pas mapper G→9 aveuglément : l'OCR lit souvent « 8 » comme « g »
# (ex. réel 7801… → OCR « 7g0… » → ancien mapping produisait 790…).
_OCR_CHIFFRE = str.maketrans({
    "O": "0", "Q": "0", "D": "0",
    "I": "1", "L": "1", "|": "1",
    "Z": "2",
    "A": "4",
    "S": "5",
    "B": "8",
    "G": "8",  # prioritaire : 7G0… → 780… (CIP ANIP)
    "T": "7",
})

_LABELS_NPI = [
    r"NUMERO\s*PERSONNEL\s*D['’]?\s*IDENTIFICATION",
    r"NUMEROPERSONNELD['’]?IDENTIFICATION",
    r"N\s*[°O]?\s*PERSONNEL\s*D['’]?\s*IDENTIFICATION",
    r"\bNPI\b",
]


def _vers_chiffres_ocr(jeton: str) -> str:
    """Normalise un jeton OCR (lettres confondues) en chiffres."""
    s = (jeton or "").upper()
    # Contexte fort : « 7G » lu à la place de « 78 » (pas « 79 »).
    s = re.sub(r"7G", "78", s)
    return s.translate(_OCR_CHIFFRE)


def _candidat_npi(jeton: str, exclus: Optional[set] = None) -> Optional[str]:
    """
    NPI Bénin = typiquement 10 chiffres.
    Accepte 8–11 chiffres après correction OCR ; exclut les n° de série (12–14).
    """
    exclus = exclus or set()
    brut = re.sub(r"[^0-9A-Z]", "", (jeton or "").upper())
    if not brut:
        return None

    corrige = _vers_chiffres_ocr(brut)
    chiffres = re.sub(r"[^0-9]", "", corrige)
    if not chiffres:
        return None

    for m in re.finditer(r"(?<!\d)(\d{10})(?!\d)", chiffres):
        c = m.group(1)
        if c not in exclus and not any(c in s for s in exclus):
            return c
    for m in re.finditer(r"\d{10}", chiffres):
        c = m.group(0)
        if any(c in s for s in exclus):
            continue
        return c

    if 8 <= len(chiffres) <= 11 and chiffres not in exclus:
        return chiffres[:10] if len(chiffres) == 11 else chiffres
    return None


def _numeros_serie_dans(texte: str) -> set:
    """Numéros de série / doc (12–14 chiffres), à ne pas confondre avec le NPI."""
    return {m.group(1) for m in re.finditer(r"(?<!\d)([0-9]{12,14})(?!\d)", texte)}


def _extraire_npi(texte: str) -> Optional[str]:
    """NPI = Numéro Personnel d'Identification (pièce du CIP, ~10 chiffres)."""
    series = _numeros_serie_dans(texte)

    for pat in _LABELS_NPI:
        m = re.search(
            rf"{pat}\s*[:\-.\s]*([0-9A-Z][0-9A-Z\s\-.]{{5,22}})",
            texte,
        )
        if m:
            npi = _candidat_npi(m.group(1), exclus=series)
            if npi:
                return npi

    m = re.search(
        r"(?:NPI|IDENTIFICATION|PERSONNEL).{0,50}?"
        r"([0-9A-Z](?:[0-9A-Z\s\-.]{6,20}))",
        texte,
    )
    if m:
        npi = _candidat_npi(m.group(1), exclus=series)
        if npi:
            return npi

    for m in re.finditer(r"(?<!\d)([0-9]{10})(?!\d)", texte):
        c = m.group(1)
        if any(c in s for s in series):
            continue
        return c

    return None


def _extraire_numero_serie(texte: str, npi: Optional[str] = None) -> Optional[str]:
    """Numéro de série imprimé près de la photo (souvent 13–14 chiffres)."""
    for m in re.finditer(r"(?<!\d)([0-9]{12,14})(?!\d)", texte):
        serie = m.group(1)
        if npi and (serie == npi or npi in serie):
            continue
        return serie
    return None


def _normaliser_date_fr(fragment: str) -> Optional[str]:
    """« 12 octobre 2002 » / « I2-ECTOBRE2002 » → JJ/MM/AAAA."""
    frag = _sans_accents(fragment or "").upper()
    frag = re.sub(r"[^A-Z0-9\s/\-.]", " ", frag)
    frag = re.sub(r"\s+", " ", frag).strip()
    # Jour OCR : I2 / l2 → 12
    frag = re.sub(r"(?<!\d)[IL|](\d)", r"1\1", frag)

    for mois_nom, mois_num in _MOIS_FR.items():
        m = re.search(
            rf"(\d{{1,2}})\s*[.\-/]?\s*{mois_nom}\s*[.\-/]?\s*(\d{{4}})",
            frag,
        )
        if m:
            jj, aaaa = m.group(1).zfill(2), m.group(2)
            return f"{jj}/{mois_num}/{aaaa}"
    return None


def _extraire_date(texte: str, contextes: List[str]) -> Optional[str]:
    for contexte in contextes:
        m = re.search(
            rf"{contexte}\s*[:\-]?\s*"
            rf"(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}}"
            rf"|\d{{1,2}}\s*[A-Z]{{3,12}}\s*\d{{4}})",
            texte,
        )
        if m:
            brut = m.group(1)
            if re.search(r"[A-Z]{3,}", brut):
                return _normaliser_date_fr(brut) or brut
            return brut
        # Date collée sans séparateur après le libellé OCR (« EPLELES20/11/2024 »)
        m2 = re.search(
            rf"{contexte}\s*[:\-.]?\s*(\d{{1,2}}[./\-]\d{{1,2}}[./\-]\d{{2,4}})",
            texte,
        )
        if m2:
            return m2.group(1)
    return None


def _corriger_commune(valeur: Optional[str]) -> Optional[str]:
    if not valeur:
        return None
    brut = re.sub(r"\s+", " ", valeur).strip(" .-:")
    # Couper aux libellés suivants collés par l'OCR
    brut = re.split(
        r"\b(?:ARR|QUART|LIEU|TITULAIRE|NATIONAL|TELEPHONE|PERE|MERE)\b",
        brut,
        maxsplit=1,
    )[0].strip(" .-:/")
    if not brut:
        return None
    premier = brut.split()[0].upper()
    for com in _COMMUNES_BENIN:
        com_u = _sans_accents(com).upper()
        if premier == com_u or premier.endswith(com_u) and len(premier) - len(com_u) <= 1:
            return com_u
        if com_u in brut.upper():
            return com_u
    return brut


def _extraire_adresse_composee(texte: str) -> dict:
    """Com. / Arr. / Quart. / Lieu sous « Adresse de résidence »."""
    resultat = {
        "commune": None,
        "arrondissement": None,
        "quartier": None,
        "adresse": None,
    }
    # « Com.sPARAKOU » / « Com. : PARAKOU » — collage « S » corrigé via _corriger_commune
    m_com = re.search(
        r"COM\.?\s*[:.\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-]{1,40})",
        texte,
    )
    m_arr = re.search(
        r"ARR\.?\s*[:.\-]?\s*([A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9\s\-]{0,40})",
        texte,
    )
    m_quart = re.search(
        r"QUART\.?\s*[:.\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-]{1,40})",
        texte,
    )
    m_lieu = re.search(
        r"LIEU\s*[:.\-]?\s*([A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9\s\-/,]{1,80})",
        texte,
    )

    if m_com:
        resultat["commune"] = _corriger_commune(m_com.group(1))
    if m_arr:
        arr = m_arr.group(1).strip()
        arr = re.split(r"\b(?:QUART|LIEU|TITULAIRE)\b", arr, maxsplit=1)[0].strip(" .-:")
        resultat["arrondissement"] = arr or None
    if m_quart:
        q = m_quart.group(1).strip()
        q = re.split(r"\b(?:LIEU|TITULAIRE|FILIATION|PERE)\b", q, maxsplit=1)[0]
        q = re.sub(r"\s+", " ", q).strip(" .-:\n")
        resultat["quartier"] = q or None

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


def _sanitizer_qr_contenu(qr_contenu: Optional[str]) -> Optional[str]:
    """Évite les payloads binaires / NUL qui font échouer l'INSERT PostgreSQL."""
    if not qr_contenu:
        return None
    nettoye = "".join(
        c for c in qr_contenu
        if c.isprintable() and c != "\x00"
    ).strip()
    if not nettoye:
        return None
    # QR CIP illisible / binaire mal décodé → ne pas polluer la BDD
    ratio_hors_latin = sum(
        1 for c in nettoye if ord(c) > 0x24F
    ) / max(len(nettoye), 1)
    if ratio_hors_latin > 0.35:
        return None
    return nettoye[:1000]


def extraire_donnees_cip(
    texte_brut: str,
    confiance: float = 0.0,
    *,
    qr_detecte: bool = False,
    qr_contenu: Optional[str] = None,
    embedding_present: bool = False,
) -> DonneesCIPExtraites:
    """Extraction robuste des champs d'un CIP ANIP."""
    qr_contenu = _sanitizer_qr_contenu(qr_contenu)

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
    numero_serie = _extraire_numero_serie(texte, npi=npi)

    nom_famille = _extraire_apres(
        texte, [r"\bNOM\b", r"NOME", r"\bNOM\s*E\b"], 40
    )
    prenoms = _extraire_apres(
        texte, [r"PRENOM\s*\(?S?\)?", r"PRENOMS", r"PRENOMT"], 50
    )
    lieu_naissance = _extraire_apres(
        texte, [r"LIEU\s*DE\s*NAISSANCE", r"NE\s*A", r"LIEUDENAISSANCE"], 50
    )
    if lieu_naissance:
        lieu_naissance = _corriger_commune(lieu_naissance) or lieu_naissance
    # Repli structure CIP : « Lieu de naissance : Com. : PARAKOU »
    if not lieu_naissance:
        m_ln = re.search(
            r"(?:LIEU\s*DE\s*NAISSANCE|HEUDENAISSANCE|LIEUDENAISSANCE)"
            r".{0,30}?COM\.?\s*[:.\-]?\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s\-]{2,40})",
            texte,
        )
        if m_ln:
            lieu_naissance = _corriger_commune(m_ln.group(1))

    nationalite = _extraire_apres(texte, [r"NATIONALITE"], 30) or (
        "BÉNIN" if "BENIN" in texte else None
    )
    telephone = _extraire_telephone(texte)
    adresse_parts = _extraire_adresse_composee(texte)

    nom_pere = _extraire_apres(texte, [r"\bPERE\b"], 50)
    nom_mere = _extraire_apres(texte, [r"\bMERE\b"], 50)

    date_naissance = _extraire_date(
        texte,
        [
            r"DATE\s*DE\s*NAISSANCE",
            r"DATEDENAISSANCE",
            r"NE\s*E?\s*LE",
            r"NAISSANCE",
        ],
    )
    if not date_naissance:
        date_naissance = _normaliser_date_fr(texte)

    # « Expire le » — OCR fréquent : EPLELES / EXPIRELE / Epleles20/11/2024
    date_expiration = _extraire_date(
        texte,
        [
            r"EXPIRE\s*LE",
            r"EXPIRELE",
            r"EPLELE?S?",
            r"EXPIRATION",
            r"VALABLE\s*JUSQU",
        ],
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
