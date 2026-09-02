# -*- coding: utf-8 -*-
"""
Patterns de détection pour tous les types de documents.
Organisés par type de document, avec des regex robustes
pour tolérer les erreurs OCR.
"""

# =============================================================================
# PATTERNS DE CLASSIFICATION (Détection du type de document)
# =============================================================================
PATTERNS_CLASSIFICATION = {
    "passeport": [
        r"PASSEPORT",
        r"PASSPORT",
        r"P<",  # MRZ passeport
        r"R[ÉE]PUBLIQUE.*PASSEPORT",
    ],
    "cni_biometrique": [
        r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[ÉE]",
        r"CNI",
        r"I<",  # MRZ carte d'identité
        r"ID[A-Z]",  # MRZ
        r"CARTE\s*D[''`]IDENTIT[ÉE]\s*BIOM[ÉE]TRIQUE",
    ],
    "cni_papier": [
        r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[ÉE]",
        r"CNI",
        r"CARTE\s*D[''`]IDENTIT[ÉE]",
    ],
    "permis_conduire": [
        r"PERMIS\s*DE\s*CONDUIRE",
        r"DRIVING\s*LICENCE",
        r"CAT[ÉE]GORIE",
        r"PERMIS\s*N[°O]",
    ],
    "carte_assurance": [
        r"CARTE\s*VERTE",
        r"ATTESTATION\s*D[''`]ASSURANCE",
        r"POLICE\s*N[°O]",
        r"CONTRAT\s*D[''`]ASSURANCE",
        r"ASSURANCE\s*(?:AUTO|V[ÉE]HICULE|RESPONSABILIT[ÉE])",
    ],
    "carte_sejour": [
        r"CARTE\s*DE\s*S[ÉE]JOUR",
        r"TITRE\s*DE\s*S[ÉE]JOUR",
        r"RESIDENCE\s*PERMIT",
        r"A<",  # MRZ carte de séjour
    ],
    "carte_vote": [
        r"CARTE\s*D[''`][ÉE]LECTEUR",
        r"CARTE\s*DE\s*VOTE",
        r"VOTER\s*CARD",
    ],
}

# =============================================================================
# PATTERNS D'EXTRACTION PAR TYPE (Pour documents sans MRZ)
# =============================================================================
PATTERNS_EXTRACTION = {
    "permis_conduire": {
        "numero_document": [
            r"(?:N[°O]|NUM[ÉE]RO|PERMIS)\s*[:\-]?\s*([A-Z0-9\-]{8,20})",
            r"PERMIS\s*N[°O]\s*[:\-]?\s*([A-Z0-9\-]{8,20})",
        ],
        "categories_permis": [
            r"CATEGORIE(?:S)?\s*[:\-]?\s*([A-E, ]+)",
            r"CLASSE(?:S)?\s*[:\-]?\s*([A-E, ]+)",
        ],
        "date_delivrance": [
            r"(?:D[ÉE]LIVR[ÉE]|DATE)\s*(?:LE|DE)?\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
            r"D[ÉE]LIVR[ÉE]\s*LE?\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
        ],
        "date_expiration": [
            r"(?:EXPIRATION|VALIDIT[ÉE])\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
            r"VALABLE\s*(?:JUSQU|AU)?\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
        ],
    },
    "carte_assurance": {
        "numero_police": [
            r"(?:N[°O]\s*(?:DE\s*)?POLICE|CONTRAT|N[°O]\s*CLIENT)\s*[:\-]?\s*([A-Z0-9\-]{6,20})",
            r"POLICE\s*N[°O]\s*[:\-]?\s*([A-Z0-9\-]{6,20})",
        ],
        "compagnie_assurance": [
            r"^(.{3,50})$",  # Première ligne (souvent le nom de la compagnie)
        ],
        "date_expiration": [
            r"(?:VALABLE\s*(?:JUSQU|AU)|EXPIRATION|FIN\s*DE\s*VALIDIT[ÉE])\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})",
            r"DU\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\s*AU",
        ],
    },
}

# =============================================================================
# PATTERNS GÉNÉRIQUES (Fallback pour tous les documents)
# =============================================================================
PATTERNS_GENERIQUES = {
    "nom_famille": [
        r"NOM\s*[:\-]?\s*",
        r"SURNAME\s*[:\-]?\s*",
        r"LAST\s*NAME\s*[:\-]?\s*",
    ],
    "prenoms": [
        r"PR[ÉE]NOM(?:S)?\s*[:\-]?\s*",
        r"GIVEN\s*NAMES?\s*[:\-]?\s*",
        r"FIRST\s*NAME(?:S)?\s*[:\-]?\s*",
    ],
    "date_naissance": [
        r"N[ÉE]\s*LE?\s*[:\-]?\s*",
        r"DATE\s*(?:DE)?\s*NAISSANCE\s*[:\-]?\s*",
        r"DATE\s*OF\s*BIRTH\s*[:\-]?\s*",
    ],
    "sexe": [
        r"SEXE\s*[:\-]?\s*",
        r"SEX\s*[:\-]?\s*",
        r"GENDER\s*[:\-]?\s*",
    ],
    "lieu_naissance": [
        r"LIEU\s*(?:DE)?\s*NAISSANCE\s*[:\-]?\s*",
        r"PLACE\s*OF\s*BIRTH\s*[:\-]?\s*",
    ],
}