# -*- coding: utf-8 -*-
"""
Photo du titulaire portée par un document d'identité.

Pourquoi ce module ?
--------------------
La vérification visuelle (selfie) ne doit plus se contenter de comparer la
photo de l'utilisateur à la seule **CNI**. Beaucoup de citoyens ne possèdent
pas de CNI mais présentent un **passeport**, un **permis de conduire**, une
**carte de séjour** ou une **carte consulaire** — tous ces documents portent la
photo de leur titulaire.

Ce module fournit donc :
  - la liste des types de documents qui contiennent une photo (et, à l'inverse,
    ceux qui n'en contiennent pas forcément : attestation d'assurance, carte
    grise) ;
  - l'extraction best-effort de l'empreinte faciale au moment de l'extraction
    du document (étape d'OCR) ;
  - l'enregistrement de cette empreinte + de l'image sur le document ;
  - le chargement de TOUTES les empreintes disponibles pour un utilisateur,
    utilisées ensuite par `service.traiter_upload_photo`.

⚠️ Les empreintes produites ici proviennent du MÊME modèle que celles des
selfies et des CNI (`verification_visuelle.embedding_facial`) : sans cela, la
similarité cosinus n'aurait aucun sens.
"""
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.noyau import journal

# =============================================================================
# Types de documents
# =============================================================================
# Documents qui portent la photo de leur titulaire : leur empreinte faciale est
# extraite à l'upload et réutilisée par la vérification visuelle.
TYPES_DOCUMENT_AVEC_PHOTO: frozenset[str] = frozenset({
    # CNI (module OCR dédié — embedding_photo_cni)
    "cni",
    "cni_biometrique",
    "cni_papier",
    # Autres titres d'identité (tables spécialisées — embedding_photo_document)
    "passeport",
    "permis",
    "permis_conduire",
    "carte_sejour",
    "carte_consulaire",
})

# Documents qui NE contiennent pas forcément de photo : ils sont explicitement
# exclus de la comparaison faciale.
TYPES_DOCUMENT_SANS_PHOTO: frozenset[str] = frozenset({
    "assurance",
    "assurance_auto",
    "carte_assurance",
    "carte_grise",
})

# Libellés lisibles (messages utilisateur + journalisation).
LIBELLES_DOCUMENT: dict[str, str] = {
    "cni": "Carte Nationale d'Identité",
    "cni_biometrique": "Carte Nationale d'Identité",
    "cni_papier": "Carte Nationale d'Identité",
    "passeport": "Passeport",
    "permis": "Permis de conduire",
    "permis_conduire": "Permis de conduire",
    "carte_sejour": "Carte de séjour",
    "carte_consulaire": "Carte consulaire",
}


def libelle_document(type_document: Optional[str]) -> str:
    """Libellé lisible du type de document (à défaut, la valeur brute)."""
    if not type_document:
        return "Document"
    return LIBELLES_DOCUMENT.get(str(type_document).strip().lower(), str(type_document))


def contient_photo_titulaire(type_document: Optional[str]) -> bool:
    """
    Indique si ce type de document porte la photo de son titulaire.

    → `True`  : l'empreinte faciale peut (et doit) être extraite.
    → `False` : document sans photo (assurance, carte grise) → ignoré par la
      comparaison faciale, qui ne peut pas s'y appuyer.
    """
    if not type_document:
        return False
    return str(type_document).strip().lower() in TYPES_DOCUMENT_AVEC_PHOTO


# =============================================================================
# Extraction best-effort de l'empreinte faciale
# =============================================================================
def _zones_photo_candidates(image_bytes: bytes) -> list[bytes]:
    """
    Découpe la zone où se trouve habituellement la photo d'identité.

    Sur une carte d'identité (format TD1) comme sur la page d'identité d'un
    passeport (TD3), la photo du titulaire occupe la bande **gauche** du
    document. On renvoie donc un crop gauche, puis un crop gauche resserré,
    encodés en JPEG — utilisés uniquement en repli si la détection directe sur
    l'image complète n'a rien trouvé.
    """
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - Pillow est une dépendance du projet
        return []

    try:
        import io

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        journal.warning(f"PhotoDocument : image illisible pour le découpage ({e})")
        return []

    largeur, hauteur = image.size
    if largeur < 40 or hauteur < 40:
        return []

    zones = [
        (0, 0, int(largeur * 0.45), hauteur),                    # bande gauche complète
        (0, int(hauteur * 0.15), int(largeur * 0.40), int(hauteur * 0.85)),  # gauche centrée
    ]

    crops: list[bytes] = []
    for gauche, haut, droite, bas in zones:
        try:
            crop = image.crop((gauche, haut, droite, bas))
            # Agrandissement x2 : les détecteurs de visage sont plus fiables
            # sur une photo de carte (≈ 3 cm) que sur la vignette brute.
            crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
            buffer = io.BytesIO()
            crop.save(buffer, format="JPEG", quality=95)
            crops.append(buffer.getvalue())
        except Exception as e:  # pragma: no cover - jamais bloquant
            journal.warning(f"PhotoDocument : échec du découpage ({e})")
    return crops


def extraire_embedding_photo(image_bytes: bytes) -> Optional[list[float]]:
    """
    Empreinte faciale de la photo du titulaire, ou `None`.

    Best-effort : on tente d'abord une détection sur l'image complète (le
    détecteur de visage isole lui-même la photo d'identité), puis, en repli,
    sur les zones photo découpées. Ne lève jamais d'exception — un document
    sans empreinte exploitable reste parfaitement enregistrable.
    """
    try:
        from src.modules.verification_visuelle import embedding_facial

        embedding = embedding_facial.generer_embedding(image_bytes)
        if embedding:
            return [float(v) for v in embedding]
    except Exception as e:
        journal.warning(f"PhotoDocument : échec de l'extraction sur l'image complète ({e})")

    for index, crop in enumerate(_zones_photo_candidates(image_bytes), start=1):
        try:
            from src.modules.verification_visuelle import embedding_facial

            embedding = embedding_facial.generer_embedding(crop)
            if embedding:
                journal.info(f"PhotoDocument : empreinte extraite depuis le crop #{index}.")
                return [float(v) for v in embedding]
        except Exception as e:  # pragma: no cover - dépend du modèle biométrique
            journal.warning(f"PhotoDocument : échec de l'extraction sur le crop #{index} ({e})")

    journal.warning("PhotoDocument : aucune empreinte faciale exploitable détectée.")
    return None


# =============================================================================
# Persistance sur le document
# =============================================================================
async def enregistrer_photo_document(
    session: AsyncSession,
    document: Any,
    image_bytes: bytes,
    type_document: Optional[str],
    type_mime: Optional[str] = None,
    prefixe: Optional[str] = None,
) -> bool:
    """
    Extrait et persiste la photo du titulaire d'un document **déjà enregistré**.

    Renseigne `photo_titulaire_chemin` et `embedding_photo_document` sur le
    document. Retourne `True` si une empreinte exploitable a été stockée.

    ⚠️ Ne lève jamais : l'extraction du document ne doit pas échouer parce que
    la biométrie n'a pas pu être calculée (photo floue, visage non détecté…).
    """
    if not contient_photo_titulaire(type_document):
        journal.info(
            f"PhotoDocument : {type_document} ne porte pas de photo de titulaire "
            "→ aucune empreinte extraite."
        )
        return False

    try:
        embedding = extraire_embedding_photo(image_bytes)

        # L'image du document est conservée même si l'empreinte a échoué : elle
        # sert au contrôle visuel humain par les agents.
        try:
            from src.noyau.stockage_photos import stocker_photo

            document.photo_titulaire_chemin = stocker_photo(
                image_bytes,
                prefixe=prefixe or str(type_document),
                type_mime=type_mime,
            )
        except Exception as e:
            journal.warning(f"PhotoDocument : échec du stockage de l'image ({e})")

        if embedding:
            document.embedding_photo_document = embedding

        await session.commit()
        await session.refresh(document)

        journal.info(
            f"PhotoDocument : {type_document} | embedding={'oui' if embedding else 'non'} "
            f"| chemin={getattr(document, 'photo_titulaire_chemin', None)}"
        )
        return bool(embedding)

    except Exception as e:  # pragma: no cover - garde-fou absolu
        journal.warning(f"PhotoDocument : enregistrement impossible pour {type_document} ({e})")
        try:
            await session.rollback()
        except Exception:
            pass
        return False


# =============================================================================
# Chargement des empreintes de référence pour la vérification visuelle
# =============================================================================
async def charger_references_faciales(
    session: AsyncSession,
    utilisateur_id: Any,
) -> list[tuple[str, list[float]]]:
    """
    Retourne TOUTES les empreintes faciales de documents disponibles pour un
    utilisateur, sous la forme `[(type_document, embedding), …]`.

    Sont inclus :
      - la CNI (empreinte extraite de la photo du recto validé) ;
      - le passeport, le permis de conduire, la carte de séjour et la carte
        consulaire, **à condition** qu'ils portent une photo de titulaire.

    Sont exclus : l'attestation d'assurance et la carte grise, qui ne
    contiennent pas forcément d'image de la personne.
    """
    from src.modeles import CarteConsulaire, CarteSejour, Passeport, PermisConduire
    from src.modeles.verification_cni import VerificationCNI

    references: list[tuple[str, list[float]]] = []

    # 1. CNI — empreinte stockée sur la vérification (face recto validée).
    try:
        resultat = await session.execute(
            select(VerificationCNI)
            .where(
                VerificationCNI.utilisateur_id == utilisateur_id,
                VerificationCNI.face == "recto",
                VerificationCNI.est_valide == True,  # noqa: E712 — filtre SQLAlchemy
                VerificationCNI.embedding_photo_cni.isnot(None),
                VerificationCNI.est_supprime == False,  # noqa: E712
            )
            .order_by(desc(VerificationCNI.cree_le))
        )
        for verification in resultat.scalars().all():
            if verification.embedding_photo_cni:
                references.append(("cni", [float(v) for v in verification.embedding_photo_cni]))
    except Exception as e:
        journal.warning(f"PhotoDocument : chargement des empreintes CNI impossible ({e})")

    # 2. Autres titres d'identité (tables spécialisées).
    modeles = (
        ("passeport", Passeport),
        ("permis_conduire", PermisConduire),
        ("carte_sejour", CarteSejour),
        ("carte_consulaire", CarteConsulaire),
    )
    for type_document, modele in modeles:
        try:
            resultat = await session.execute(
                select(modele)
                .where(
                    modele.utilisateur_id == utilisateur_id,
                    modele.embedding_photo_document.isnot(None),
                    modele.est_supprime.is_(False),
                )
                .order_by(desc(modele.cree_le))
            )
            for document in resultat.scalars().all():
                if document.embedding_photo_document:
                    references.append(
                        (type_document, [float(v) for v in document.embedding_photo_document])
                    )
        except Exception as e:
            journal.warning(
                f"PhotoDocument : chargement des empreintes {type_document} impossible ({e})"
            )

    journal.info(
        f"PhotoDocument : {len(references)} empreinte(s) de document disponible(s) "
        f"pour l'utilisateur {utilisateur_id}"
    )
    return references


async def charger_embedding_par_document_id(
    session: AsyncSession,
    utilisateur_id: Any,
    document_id: Any,
) -> Optional[tuple[str, list[float]]]:
    """
    Retrouve l'empreinte faciale d'UN document précis, quel que soit son type.

    `document_id` peut être :
      - l'ID d'une ligne `document_identite` (CNI) → résolu vers sa vérification ;
      - l'ID d'une `VerificationCNI` (recto validé) ;
      - l'ID d'un passeport / permis / carte de séjour / carte consulaire.

    Retourne `(type_document, embedding)` ou `None` si le document n'existe pas,
    n'appartient pas à l'utilisateur, ou ne porte pas d'empreinte exploitable.
    """
    from uuid import UUID as _UUID

    from src.modeles import (
        CarteConsulaire,
        CarteSejour,
        DocumentIdentite,
        Passeport,
        PermisConduire,
    )
    from src.modeles.verification_cni import VerificationCNI

    try:
        identifiant = document_id if isinstance(document_id, _UUID) else _UUID(str(document_id))
    except (ValueError, TypeError, AttributeError):
        return None

    # 1. Une ligne `document_identite` pointe vers sa vérification CNI.
    verification_id = identifiant
    try:
        resultat = await session.execute(
            select(DocumentIdentite).where(
                DocumentIdentite.id == identifiant,
                DocumentIdentite.utilisateur_id == utilisateur_id,
            )
        )
        document_identite = resultat.scalar_one_or_none()
        if document_identite and document_identite.verification_id:
            verification_id = document_identite.verification_id
    except Exception as e:  # pragma: no cover - id non-UUID / table absente
        journal.warning(f"PhotoDocument : résolution document_identite impossible ({e})")

    # 2. CNI (empreinte portée par la vérification du recto).
    try:
        resultat = await session.execute(
            select(VerificationCNI).where(
                VerificationCNI.id == verification_id,
                VerificationCNI.utilisateur_id == utilisateur_id,
                VerificationCNI.face == "recto",
                VerificationCNI.est_valide == True,  # noqa: E712
                VerificationCNI.embedding_photo_cni.isnot(None),
                VerificationCNI.est_supprime == False,  # noqa: E712
            )
        )
        verification_cni = resultat.scalar_one_or_none()
        if verification_cni and verification_cni.embedding_photo_cni:
            return ("cni", [float(v) for v in verification_cni.embedding_photo_cni])
    except Exception as e:  # pragma: no cover
        journal.warning(f"PhotoDocument : résolution empreinte CNI impossible ({e})")

    # 3. Titres d'identité spécialisés (empreinte stockée sur le document).
    for type_document, modele in (
        ("passeport", Passeport),
        ("permis_conduire", PermisConduire),
        ("carte_sejour", CarteSejour),
        ("carte_consulaire", CarteConsulaire),
    ):
        try:
            resultat = await session.execute(
                select(modele).where(
                    modele.id == identifiant,
                    modele.utilisateur_id == utilisateur_id,
                )
            )
            document = resultat.scalar_one_or_none()
            if document and document.embedding_photo_document:
                return (type_document, [float(v) for v in document.embedding_photo_document])
        except Exception as e:  # pragma: no cover
            journal.warning(f"PhotoDocument : résolution empreinte {type_document} impossible ({e})")

    return None
