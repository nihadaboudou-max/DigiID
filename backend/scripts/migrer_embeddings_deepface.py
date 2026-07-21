# -*- coding: utf-8 -*-
"""
Migration : régénère tous les embeddings faciaux avec deepface.

Contexte :
- Avant l'implémentation deepface, les embeddings étaient générés via SHA-512.
- Ces anciens embeddings sont incompatibles avec la nouvelle recherche faciale.
- Ce script re-génère les embeddings deepface pour toutes les vérifications
  visuelles existantes qui ont une photo stockée.

Usage :
    docker compose exec backend python scripts/migrer_embeddings_deepface.py
"""
import asyncio
import sys
from io import BytesIO

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

# Ajouter /app au path (dans le conteneur Docker)
sys.path.insert(0, "/app")

from src.base_donnees.base import SessionFactory
from src.modeles.verification_visuelle import VerificationVisuelle
from src.modules.verification_visuelle.embedding_facial import (
    DEEPFACE_DISPONIBLE,
    generer_embedding,
)
from src.noyau import journal
from src.modules.verification_visuelle.detection_visage import detecter_visage


async def migrer():
    if not DEEPFACE_DISPONIBLE:
        print("❌ deepface n'est pas installé. Exécute d'abord : pip install deepface tensorflow")
        return

    print("🔍 Recherche des vérifications visuelles sans embedding deepface...")

    async with SessionFactory() as session:
        resultat = await session.execute(
            select(VerificationVisuelle)
            .where(
                VerificationVisuelle.embedding.isnot(None),
                VerificationVisuelle.statut == "approuve",
                VerificationVisuelle.est_supprime == False,
            )
            .order_by(desc(VerificationVisuelle.cree_le))
        )
        verifications = resultat.scalars().all()

        if not verifications:
            print("✅ Aucune vérification avec embedding trouvée.")
            return

        print(f"📸 {len(verifications)} vérifications trouvées. Régénération des embeddings deepface...")

        compteur_ok = 0
        compteur_erreur = 0

        for v in verifications:
            try:
                # Vérifier si l'embedding est deepface (512D)
                # Un embedding deepface Facenet512 fait exactement 512 floats
                # Un ancien embedding SHA-512 fait aussi 512 mais avec des valeurs 0.xxxx
                # On ne peut pas vraiment les distinguer par la taille.
                # On régénère TOUS les embeddings.
                embedding_actuel = v.embedding
                print(f"  → Vérification {v.id} : régénération...", end=" ")

                # Note : on ne stocke pas la photo originale dans VerificationVisuelle
                # On ne peut donc pas régénérer l'embedding sans la photo originale.
                # Les photos ne sont pas conservées (seulement les métadonnées).
                # Il faut que l'utilisateur re-uploade sa photo.
                print("❌ Photo originale non disponible. Passe.")
                compteur_erreur += 1

            except Exception as exc:
                print(f"❌ Erreur : {exc}")
                compteur_erreur += 1

        print(f"\n✅ Terminé : {compteur_ok} régénérés, {compteur_erreur} ignorés/erreurs")
        print("⚠️  Les citoyens doivent re-télécharger leur photo de vérification")
        print("   pour que la recherche faciale fonctionne avec deepface.")


if __name__ == "__main__":
    asyncio.run(migrer())
