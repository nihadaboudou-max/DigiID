# -*- coding: utf-8 -*-
"""Adaptateurs de l'interface unique d'extraction de documents.

Chaque adaptateur est une simple fonction `async` qui prend les 6 documents
hétérogènes et renvoie TOUJOURS le même dictionnaire (réponse unifiée).
"""
from src.modules.inspection_documents.adaptateurs.assurance import adapter_assurance
from src.modules.inspection_documents.adaptateurs.carte_grise import adapter_carte_grise
from src.modules.inspection_documents.adaptateurs.carte_sejour import adapter_carte_sejour
from src.modules.inspection_documents.adaptateurs.cni import adapter_cni
from src.modules.inspection_documents.adaptateurs.consulaire import adapter_consulaire
from src.modules.inspection_documents.adaptateurs.passeport import adapter_passeport
from src.modules.inspection_documents.adaptateurs.permis import adapter_permis

__all__ = [
    "adapter_cni",
    "adapter_permis",
    "adapter_assurance",
    "adapter_carte_grise",
    "adapter_carte_sejour",
    "adapter_consulaire",
    "adapter_passeport",
]
