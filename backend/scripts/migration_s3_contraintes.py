# -*- coding: utf-8 -*-
"""
Migration S3 — contraintes d'unicité et de vérification (idempotente).

À exécuter UNE fois sur une base existante (PostgreSQL) :

    cd backend
    python -m scripts.migration_s3_contraintes

Ce que la migration apporte :

1. ``utilisateur.telephone_hash`` (SHA-256) + index UNIQUE
   → un numéro de téléphone = un seul compte, sans déchiffrer la base.
2. ``utilisateur.est_telephone_verifie`` / ``date_verification_telephone``
   → activation du compte conditionnée par l'OTP/SMS.
3. Index UNIQUE ``uq_document_numero_document``
   → un numéro de pièce d'identité (CNI, passeport, permis…) ne peut exister
     qu'une seule fois dans toute la base.
4. Colonne ``colis.id_local`` + index UNIQUE
   → idempotence du rejeu des colis saisis sans réseau.

⚠️ L'unicité des pièces peut échouer si des doublons existent déjà dans le
jeu de données. Le script les **signale** avant de créer l'index, sans
supprimer de données : à l'administrateur de trancher (le doublon le plus
récent est en général une tentative de fraude).
"""
import asyncio
import sys

from sqlalchemy import text

from src.base_donnees.session import moteur_async


INSTRUCTIONS = [
    "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS telephone_hash VARCHAR(64)",
    "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS est_telephone_verifie BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS date_verification_telephone TIMESTAMPTZ",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_utilisateur_telephone_hash "
    "ON utilisateur (telephone_hash)",
    # Unicité stricte du numéro de pièce (les NULL restent autorisés).
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_document_numero_document "
    "ON document_identite (numero_document)",
    # Idempotence des colis saisis hors-ligne (rejeu de la file du guichet).
    "ALTER TABLE colis ADD COLUMN IF NOT EXISTS id_local VARCHAR(64)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_colis_id_local ON colis (id_local)",
]

DOUBLONS_PIECES = """
SELECT numero_document, COUNT(*) AS occurrences, array_agg(utilisateur_id::text) AS comptes
FROM document_identite
WHERE numero_document IS NOT NULL
GROUP BY numero_document
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
"""

DOUBLONS_TELEPHONES = """
SELECT telephone_hash, COUNT(*) AS occurrences
FROM utilisateur
WHERE telephone_hash IS NOT NULL
GROUP BY telephone_hash
HAVING COUNT(*) > 1
"""


async def main() -> int:
    moteur = moteur_async
    async with moteur.begin() as connexion:
        doublons_pieces = (
            await connexion.execute(text(DOUBLONS_PIECES))
        ).mappings().all()
        if doublons_pieces:
            print("⛔ Doublons de numéros de pièce déjà présents :")
            for ligne in doublons_pieces:
                print(f"   {ligne['numero_document']} → {ligne['occurrences']} documents")
            print("   Corrigez-les avant de créer l'index unique (voir doc S3).")

        doublons_tel = (
            await connexion.execute(text(DOUBLONS_TELEPHONES))
        ).mappings().all()
        if doublons_tel:
            print("ℹ️  Doublons de téléphone existants (index unique non créé) :")
            for ligne in doublons_tel:
                print(f"   {ligne['telephone_hash'][:12]}… → {ligne['occurrences']}")

        for instruction in INSTRUCTIONS:
            try:
                await connexion.execute(text(instruction))
                print(f"✅ {instruction[:70]}…")
            except Exception as erreur:  # pragma: no cover - diagnostic
                print(f"⚠️  Échec : {instruction[:70]}… → {erreur}")

    await moteur.dispose()
    print("\nMigration S3 terminée.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
