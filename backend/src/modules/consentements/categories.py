# -*- coding: utf-8 -*-
"""
Catalogue des catégories de consentements DigiID.

Chaque catégorie porte :
  - un identifiant technique stable (utilisé en base et en API)
  - un titre lisible
  - une description courte affichée à l'utilisateur
  - un texte légal complet (preuve juridique en cas de litige)
  - un drapeau "obligatoire" : si True, l'utilisateur ne peut pas refuser
  - une version pour traçabilité des évolutions du texte

Quand on modifie un texte légal, on incrémente la version. Les anciens
consentements gardent leur version d'origine — c'est la preuve de ce que
l'utilisateur a effectivement accepté à l'époque.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Dict


class CategoriesConsentement(str, Enum):
    """Identifiants techniques stables des catégories de consentements."""
    CGU = "cgu"
    DONNEES_MOBILE_MONEY = "donnees_mobile_money"
    GEOLOCALISATION = "geolocalisation"
    ANCIENNETE_SIM = "anciennete_sim"
    VERIFICATION_PERSONNES_RECHERCHEES = "verification_personnes_recherchees"
    MARKETING = "marketing"


@dataclass(frozen=True)
class DefinitionConsentement:
    """Description complète d'une catégorie de consentement."""
    categorie: str
    titre: str
    description: str
    texte_legal: str
    obligatoire: bool
    version: str


CATALOGUE: Dict[str, DefinitionConsentement] = {
    CategoriesConsentement.CGU.value: DefinitionConsentement(
        categorie=CategoriesConsentement.CGU.value,
        titre="Conditions générales d'utilisation",
        description="Cadre juridique global de l'utilisation de DigiID.",
        texte_legal=(
            "En utilisant DigiID, l'Utilisateur accepte les conditions générales conformes "
            "à la loi 2008-12 du Sénégal sur la protection des données à caractère personnel "
            "et au Code numérique du Bénin (loi 2017-20). L'Utilisateur reconnaît avoir lu "
            "et compris l'intégralité des CGU disponibles à l'adresse /cgu."
        ),
        obligatoire=True,
        version="1.0",
    ),
    CategoriesConsentement.DONNEES_MOBILE_MONEY.value: DefinitionConsentement(
        categorie=CategoriesConsentement.DONNEES_MOBILE_MONEY.value,
        titre="Accès aux données mobile money",
        description="Autoriser DigiID à consulter l'historique anonymisé de tes transactions Wave, Orange Money, etc.",
        texte_legal=(
            "L'Utilisateur autorise DigiID à consulter, auprès des opérateurs partenaires "
            "(Wave, Orange Money, Free Money, etc.) les métadonnées agrégées de ses "
            "transactions des 6 derniers mois : volume, fréquence, régularité temporelle, "
            "diversité des partenaires. Aucun contenu de transaction individuelle, aucun "
            "détail de destinataire n'est conservé. Ces données servent uniquement au calcul "
            "du score de confiance DigiID."
        ),
        obligatoire=False,
        version="1.0",
    ),
    CategoriesConsentement.GEOLOCALISATION.value: DefinitionConsentement(
        categorie=CategoriesConsentement.GEOLOCALISATION.value,
        titre="Stabilité géographique",
        description="Permettre la collecte de ta ville et de ton quartier (jamais la position GPS précise).",
        texte_legal=(
            "L'Utilisateur autorise la collecte de sa ville et de son quartier d'habitation "
            "principale. La géolocalisation GPS précise n'est jamais collectée, transmise, "
            "ni stockée. Seul le niveau ville/quartier est utilisé pour évaluer la stabilité "
            "géographique dans le calcul du score."
        ),
        obligatoire=False,
        version="1.0",
    ),
    CategoriesConsentement.ANCIENNETE_SIM.value: DefinitionConsentement(
        categorie=CategoriesConsentement.ANCIENNETE_SIM.value,
        titre="Données de la carte SIM",
        description="Date d'activation, opérateur, stabilité du numéro.",
        texte_legal=(
            "L'Utilisateur autorise DigiID à consulter, auprès de son opérateur télécom, "
            "les métadonnées suivantes : date d'activation de la SIM courante, identité de "
            "l'opérateur, historique des changements de SIM associés au numéro. Aucun "
            "contenu de communication (SMS, appels, données mobiles) n'est consulté."
        ),
        obligatoire=False,
        version="1.0",
    ),
    CategoriesConsentement.VERIFICATION_PERSONNES_RECHERCHEES.value: DefinitionConsentement(
        categorie=CategoriesConsentement.VERIFICATION_PERSONNES_RECHERCHEES.value,
        titre="Vérification listes officielles",
        description="Comparaison de ta photo aux listes publiques OFAC, ONU, Interpol. Utilisé uniquement pour KYC bancaire.",
        texte_legal=(
            "L'Utilisateur autorise la comparaison de son empreinte faciale (vecteur "
            "mathématique de 512 dimensions, irréversible, jamais sa photographie brute) "
            "aux listes publiques officielles de personnes recherchées (OFAC SDN List, "
            "ONU Consolidated List, Interpol Public Notices) dans le cadre exclusif "
            "d'opérations KYC bancaire. Ce consentement est strictement opt-in et "
            "n'est jamais une condition d'usage de DigiID."
        ),
        obligatoire=False,
        version="1.0",
    ),
    CategoriesConsentement.MARKETING.value: DefinitionConsentement(
        categorie=CategoriesConsentement.MARKETING.value,
        titre="Communications marketing",
        description="Recevoir par email les nouveautés DigiID et conseils pour améliorer ton score.",
        texte_legal=(
            "L'Utilisateur consent à recevoir des emails non transactionnels de DigiID : "
            "lettre d'information, conseils pour améliorer son score, annonces de "
            "nouveautés produit. Désactivable à tout moment sans justification, sans "
            "conséquence sur l'usage du service."
        ),
        obligatoire=False,
        version="1.0",
    ),
}


def obtenir_definition(categorie: str) -> DefinitionConsentement:
    """Récupère une définition par son identifiant. Lève KeyError si inconnue."""
    if categorie not in CATALOGUE:
        raise KeyError(f"Catégorie de consentement inconnue : {categorie}")
    return CATALOGUE[categorie]


def lister_categories_obligatoires() -> list[str]:
    """Liste des catégories à demander obligatoirement à l'inscription."""
    return [c for c, d in CATALOGUE.items() if d.obligatoire]


def lister_toutes_categories() -> list[str]:
    """Liste de toutes les catégories disponibles."""
    return list(CATALOGUE.keys())
