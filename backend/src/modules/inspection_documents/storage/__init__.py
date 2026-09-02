# -*- coding: utf-8 -*-
"""Sous-module de stockage des documents et biométrie."""
from src.modules.inspection_documents.storage.document_storage import stocker_document
from src.modules.inspection_documents.storage.embedding_facial import generer_embedding_facial

__all__ = ["stocker_document", "generer_embedding_facial"]