# -*- coding: utf-8 -*-
"""
Synchronisation automatique du schéma de base de données.
Détecte et crée les tables/colonnes manquantes au démarrage.
"""
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.base_donnees.base import Base
from src.noyau import journal


async def synchroniser_schema(session: AsyncSession) -> None:
    """
    Synchronise le schéma de la base de données avec les modèles SQLAlchemy.
    Crée les tables manquantes et ajoute les colonnes manquantes.
    """
    try:
        # Obtenir l'inspecteur de la base de données
        def get_tables(conn):
            inspector = inspect(conn)
            return inspector.get_table_names()
        
        tables_existantes = await session.run_sync(get_tables)
        
        # Obtenir les tables définies dans les modèles
        tables_modeles = Base.metadata.tables.keys()
        
        # Créer les tables manquantes
        for table_name in tables_modeles:
            if table_name not in tables_existantes:
                journal.info(f"📦 Création de la table manquante: {table_name}")
                table = Base.metadata.tables[table_name]
                await session.run_sync(lambda conn: table.create(conn))
        
        # Vérifier les colonnes manquantes pour chaque table existante
        def get_columns(conn, table_name):
            inspector = inspect(conn)
            columns = inspector.get_columns(table_name)
            return [col['name'] for col in columns]
        
        for table_name in tables_modeles:
            if table_name in tables_existantes:
                colonnes_existantes = await session.run_sync(get_columns, table_name)
                table = Base.metadata.tables[table_name]
                
                for column in table.columns:
                    if column.name not in colonnes_existantes:
                        journal.info(f"📊 Ajout de la colonne manquante: {table_name}.{column.name}")
                        # Construire la commande ALTER TABLE
                        col_type = column.type.compile(dialect=session.bind.dialect)
                        nullable = "NULL" if column.nullable else "NOT NULL"
                        default = f"DEFAULT {column.default.arg}" if column.default else ""
                        
                        sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type} {nullable} {default}"
                        await session.execute(text(sql))
        
        await session.commit()
        journal.info("✅ Synchronisation du schéma terminée")
        
    except Exception as e:
        journal.error(f"❌ Erreur lors de la synchronisation du schéma: {e}")
        await session.rollback()