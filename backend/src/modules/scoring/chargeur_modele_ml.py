# -*- coding: utf-8 -*-
"""
Chargeur du modèle ML entraîné dans le notebook.

Le notebook `notebooks/01_entrainement_modele_scoring.ipynb` génère un
fichier `modeles_entraines/scoring_v1.joblib` qui contient :
  - Le modèle XGBoost (ou Random Forest) entraîné sur 10 000 profils synthétiques
  - La liste ordonnée des features attendues
  - Les métriques de performance (MAE, R²)
  - Métadonnées : version, seed aléatoire, taille du dataset

Ce module charge le bundle au démarrage du backend, et expose une fonction
`predire_score_ml(...)` pour faire des prédictions sur de nouveaux profils.

Stratégie : si le fichier .joblib n'existe pas (notebook pas encore exécuté),
on retombe gracieusement sur le modèle pondéré documenté dans le Cahier des
Charges. Le backend continue de fonctionner sans interruption.
"""
from pathlib import Path
from typing import Optional

from src.modules.scoring.generateur_donnees import DonneesComportementales
from src.noyau import journal


# Chemin du modèle entraîné (relatif à la racine du backend)
CHEMIN_MODELE = Path(__file__).resolve().parents[3] / "modeles_entraines" / "scoring_v1.joblib"


# Cache du bundle chargé en mémoire (pour ne pas le relire à chaque prédiction)
_bundle_cache: Optional[dict] = None
_chargement_tente: bool = False


def _charger_bundle() -> Optional[dict]:
    """
    Charge le bundle .joblib en mémoire. Retourne None si :
      - Le fichier n'existe pas (notebook pas encore exécuté)
      - joblib n'est pas installé (dépendances incomplètes)
      - Le fichier est corrompu ou d'une version incompatible

    Le chargement n'est tenté qu'une seule fois — si ça échoue, on log
    et on retombe sur le modèle pondéré pour toujours.
    """
    global _bundle_cache, _chargement_tente

    if _chargement_tente:
        return _bundle_cache

    _chargement_tente = True

    # Vérifier si le fichier existe
    if not CHEMIN_MODELE.exists():
        journal.info(
            f"Modèle ML non trouvé à {CHEMIN_MODELE}. "
            f"Le scoring utilise le modèle pondéré (Cahier des Charges). "
            f"Pour utiliser un modèle ML, exécute le notebook "
            f"backend/notebooks/01_entrainement_modele_scoring.ipynb."
        )
        return None

    # Tenter le chargement
    try:
        import joblib  # Import différé pour éviter une erreur si pas installé
        bundle = joblib.load(CHEMIN_MODELE)
        journal.info(
            f"Modèle ML chargé : {bundle.get('nom_modele', 'inconnu')} "
            f"v{bundle.get('version', '?')} "
            f"(R²={bundle.get('metriques', {}).get('r2_test', '?')})"
        )
        _bundle_cache = bundle
        return bundle
    except ImportError:
        journal.warning(
            "joblib n'est pas installé — le modèle ML ne peut pas être chargé. "
            "Lancer : docker compose exec backend pip install joblib xgboost scikit-learn"
        )
        return None
    except Exception as erreur:
        journal.error(f"Échec du chargement du modèle ML : {erreur}")
        return None


def est_modele_disponible() -> bool:
    """Indique si le modèle ML est disponible pour faire des prédictions."""
    return _charger_bundle() is not None


def predire_score_ml(donnees: DonneesComportementales) -> Optional[float]:
    """
    Fait une prédiction de score avec le modèle ML entraîné.

    Arguments :
        donnees : les données comportementales d'un utilisateur

    Retour :
        Score prédit entre 0 et 100, ou None si le modèle n'est pas disponible.

    Note : la fonction s'attend à ce que les features soient dans le MÊME ORDRE
    que celui utilisé pendant l'entraînement (voir le notebook).
    """
    bundle = _charger_bundle()
    if bundle is None:
        return None

    # Construire le vecteur de features dans l'ordre attendu par le modèle
    features_ordre = bundle.get("features_attendues", [])
    valeurs_par_feature = {
        "anciennete_sim_mois": donnees.anciennete_sim_mois,
        "nombre_changements_sim": donnees.nombre_changements_sim,
        "operateur_stable": int(donnees.operateur_stable),
        "transactions_par_mois": donnees.transactions_par_mois,
        "montant_moyen_fcfa": donnees.montant_moyen_transaction_fcfa,
        "regularite_temporelle": donnees.regularite_temporelle,
        "diversite_partenaires": donnees.diversite_partenaires,
        "nombre_mois_meme_ville": donnees.nombre_mois_meme_ville,
        "nombre_changements_quartier": donnees.nombre_changements_quartier,
        "taille_repertoire": donnees.taille_repertoire,
        "contacts_anciens": donnees.contacts_anciens,
        "contacts_communs_digiid": donnees.contacts_communs_digiid,
    }

    # Reconstruire le vecteur dans le bon ordre
    try:
        vecteur = [[valeurs_par_feature[nom] for nom in features_ordre]]
    except KeyError as erreur:
        journal.error(f"Feature manquante pour la prédiction ML : {erreur}")
        return None

    # Prédire
    try:
        prediction = bundle["modele"].predict(vecteur)[0]
        # Clipper entre 0 et 100 par sécurité
        return max(0.0, min(100.0, float(prediction)))
    except Exception as erreur:
        journal.error(f"Échec de la prédiction ML : {erreur}")
        return None
