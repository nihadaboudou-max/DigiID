# -*- coding: utf-8 -*-
"""
Réponses locales de l'assistant DigiID — le « guide » qui répond toujours.

Pourquoi ce module existe : le chatbot interroge un LLM (Ollama en local, Groq
en ligne). Quand ce service est éteint, mal configuré ou injoignable, le citoyen
au guichet n'a pas le droit de tomber sur une erreur : il obtient ici une
réponse courte, exacte et **conforme à ce que l'application fait réellement**.

C'est aussi la base de connaissances du pivot : colis, passagers, cars, suivi,
QR dynamique. Les réponses sont volontairement courtes — deux phrases, un geste
à faire — pour rester compréhensibles par un client qui découvre DigiID.

Utilisation :

    reponse, trouve = repondre_localement("Mon QR est refusé", role="receveur")
"""
from __future__ import annotations

import unicodedata

# ─── Base de connaissances ───────────────────────────────────────────
# Chaque entrée : mots-clés reconnus, réponse courte, écran à ouvrir,
# et éventuellement les profils pour lesquels la réponse est prioritaire.

BASE: list[dict] = [
    # ── Colis & passagers (pivot) ────────────────────────────────────
    {
        "mots_cles": ["envoyer un colis", "expedier", "enregistrer un colis", "colis nouveau"],
        "reponse": (
            "Un colis s'enregistre au guichet (ou par le chauffeur, en route) : "
            "nom et téléphone de l'expéditeur, nom et téléphone du destinataire, "
            "gares de départ et d'arrivée, contenu. Un ticket avec code de suivi "
            "est remis à l'expéditeur."
        ),
        "lien": "/receveur/colis/nouveau",
    },
    {
        "mots_cles": ["suivre", "suivi", "ou est mon colis", "trace", "code du ticket"],
        "reponse": (
            "Avec le code du ticket (ex. DKR-2025-000123), sur la page de suivi : "
            "enregistré → en route → arrivé. Aucun compte n'est nécessaire et "
            "aucune donnée personnelle n'est affichée."
        ),
        "lien": "/suivi",
    },
    {
        "mots_cles": ["enfant", "voyage seul", "mineur", "prevenir le parent", "suivi familial"],
        "reponse": (
            "Pour un enfant qui voyage seul, le guichet (ou le chauffeur) "
            "enregistre un proche de confiance. Ce proche reçoit un SMS au départ, "
            "un SMS d'approche et un SMS à l'arrivée."
        ),
        "lien": "/receveur/suivi-familial/nouveau",
    },
    {
        "mots_cles": ["sans compte", "pas de compte", "client sans digiid", "nom et telephone"],
        "reponse": (
            "Aucun compte n'est obligatoire : le nom et le téléphone saisis à la "
            "main suffisent. Le compte DigiID sert seulement à remplir la fiche "
            "sans faute de frappe, pour que les SMS partent au bon numéro."
        ),
    },
    {
        "mots_cles": ["pourquoi scanner", "scanner plutot", "plutot que taper", "interet du scan", "scan du client"],
        "reponse": (
            "Le scan est plus rapide et plus sûr que la saisie : le client affiche "
            "un QR dynamique valable 30 secondes, à usage unique. Une fois scanné, "
            "son nom et son téléphone se remplissent tout seuls."
        ),
        "lien": "/guichet/carte",
    },
    {
        "mots_cles": ["qr refuse", "qr invalide", "qr expire", "code refuse", "deja scanne", "deja utilise", "qr ne marche pas", "expire"],
        "reponse": (
            "Un QR refusé est un QR expiré (plus de 30 secondes) ou déjà scanné : "
            "demandez à la personne de rafraîchir son écran pour obtenir un nouveau "
            "code. En dernier recours, saisissez son DigiID public (12 caractères) : "
            "c'est plus lent, mais accepté."
        ),
    },
    {
        "mots_cles": ["livre", "livraison", "remettre le colis", "marquer livre"],
        "reponse": (
            "À la remise, scannez le code du ticket : le colis passe en « livré ». "
            "Si le même ticket est scanné deux fois, l'application indique "
            "« déjà livré » — la remise n'est pas comptée deux fois."
        ),
        "lien": "/receveur/scan",
    },
    {
        "mots_cles": ["sms pas recu", "destinataire pas prevenu", "numero faux", "pas de sms"],
        "reponse": (
            "Le plus souvent, le numéro a été mal recopié. Remplissez la fiche en "
            "scannant le QR du destinataire (ou de son proche) : le numéro est alors "
            "exact et les SMS de départ et d'arrivée partent au bon endroit."
        ),
    },

    # ── Chauffeur & cars ────────────────────────────────────────────
    {
        "mots_cles": ["mon car", "recuperer un car", "affecter un car", "plaque", "vehicule du chauffeur"],
        "reponse": (
            "Votre car vous est affecté par le guichet ou le gérant de gare. Si sa "
            "plaque est au référentiel sans chauffeur, vous pouvez aussi le déclarer "
            "vous-même depuis « Mes cars » : il devient le vôtre."
        ),
        "lien": "/chauffeur/voyages",
        "profils": ["chauffeur"],
    },
    {
        "mots_cles": ["car d'un autre", "car deja affecte", "autre chauffeur", "collegue", "prendre le car"],
        "reponse": (
            "Un car appartient à un seul chauffeur : l'application refuse de "
            "planifier un départ avec le car d'un collègue. Demandez au guichet (ou "
            "au gérant de gare) de le réaffecter — l'opération est tracée."
        ),
    },
    {
        "mots_cles": ["planifier", "creer un depart", "programmer un voyage", "heure de depart"],
        "reponse": (
            "Depuis « Planifier mes trajets » : choisissez la ligne, votre car et "
            "l'heure de départ. Le départ apparaît aussitôt côté guichet et côté "
            "clients sur la page des horaires."
        ),
        "lien": "/chauffeur/voyages",
        "profils": ["chauffeur", "gerant_gare"],
    },
    {
        "mots_cles": ["valider le depart", "marquer arrivee", "arrivee du car", "depart du car", "annoncer le depart"],
        "reponse": (
            "Sur la fiche du voyage, « Valider le départ » fait passer d'un coup tous "
            "les passagers et colis à bord en route, et « Marquer arrivés » à la fin. "
            "Les SMS partent automatiquement aux destinataires et aux proches."
        ),
        "lien": "/chauffeur/dashboard",
    },
    {
        "mots_cles": ["en route", "enregistrer un passager", "monter en route", "client au bord de la route", "enregistrer en route"],
        "reponse": (
            "Depuis le car, vous pouvez enregistrer un passager ou un colis confié en "
            "cours de trajet, avec le scan du code du client. Il apparaît aussitôt sur "
            "le manifeste du voyage."
        ),
        "lien": "/chauffeur/colis/nouveau",
        "profils": ["chauffeur"],
    },
    {
        "mots_cles": ["manifeste", "ce qui est a bord", "liste des passagers", "ma liste"],
        "reponse": (
            "Le manifeste de votre voyage montre tout ce que vous transportez : "
            "colis et passagers, avec les codes et les gares. Il se met à jour à "
            "chaque enregistrement."
        ),
        "lien": "/chauffeur/colis",
        "profils": ["chauffeur"],
    },
    {
        "mots_cles": ["cagnotte", "combien j'ai encaisse", "recette du jour", "mon argent"],
        "reponse": (
            "La cagnotte du jour regroupe vos encaissements colis et passagers. Elle "
            "se consulte à tout moment sur l'écran « Ma cagnotte »."
        ),
        "lien": "/receveur/cagnotte",
    },
    {
        "mots_cles": ["inscrire un car", "ajouter un vehicule", "referentiel roulant", "cars et chauffeurs"],
        "reponse": (
            "Écran « Cars & chauffeurs » : plaque, marque, capacité, gare et le "
            "chauffeur à qui le car appartient — en une seule fois. On peut aussi "
            "ajouter ou retirer le chauffeur d'un car déjà inscrit."
        ),
        "lien": "/receveur/vehicules",
        "profils": ["receveur", "gerant_gare"],
    },
    {
        "mots_cles": ["chauffeur absent", "pas dans la liste", "acteur logistique", "fiche chauffeur"],
        "reponse": (
            "Un chauffeur n'apparaît dans les listes d'affectation que s'il a une "
            "fiche d'acteur logistique (n° de permis, gare). Le super-administrateur "
            "la crée depuis Super-admin → Logistique → Acteurs."
        ),
        "lien": "/super-admin/logistique",
    },

    # ── Compte, carte, QR ───────────────────────────────────────────
    {
        "mots_cles": ["creer un compte", "inscription", "s'inscrire", "ouvrir un compte"],
        "reponse": (
            "Sur « Créer un compte » : prénom, nom, email et un mot de passe d'au "
            "moins 12 caractères. Le DigiID est attribué immédiatement."
        ),
        "lien": "/inscription",
    },
    {
        "mots_cles": ["pas de smartphone", "ussd", "sans internet", "telephone simple"],
        "reponse": (
            "DigiID fonctionne aussi en USSD, sans internet : *346# depuis n'importe "
            "quel téléphone. L'inscription prend environ deux minutes."
        ),
    },
    {
        "mots_cles": ["mot de passe oublie", "reinitialiser", "changer le mot de passe"],
        "reponse": (
            "Sur l'écran de connexion, choisissez « Mot de passe oublié » : vous "
            "recevez un lien de réinitialisation par email."
        ),
        "lien": "/mot-de-passe-oublie",
    },
    {
        "mots_cles": ["qr dynamique", "mon qr", "mon digiid", "code de 30 secondes", "montrer mon qr"],
        "reponse": (
            "Votre QR dynamique s'affiche sur « Mon DigiID » et se renouvelle tout "
            "seul : il ne vaut que 30 secondes et qu'une seule fois. C'est ce code "
            "qu'on scanne au guichet ou dans le car — un code photographié ne sert à rien."
        ),
        "lien": "/citoyen/qr-code",
    },
    {
        "mots_cles": ["ma carte", "carte digiid", "carte citoyenne", "qr de la carte"],
        "reponse": (
            "Votre carte DigiID (avec son QR durable) est sur « Ma carte ». Elle sert "
            "d'identité visuelle ; pour une vérification, préférez le QR dynamique, "
            "qui est à usage unique."
        ),
        "lien": "/identite/carte",
    },
    {
        "mots_cles": ["2fa", "double authentification", "code de securite"],
        "reponse": (
            "La double authentification s'active dans Paramètres → 2FA, en scannant "
            "le QR avec une application d'authentification. Elle est obligatoire pour "
            "les administrateurs."
        ),
        "lien": "/parametres/2fa",
    },
    {
        "mots_cles": ["documents", "cni", "permis", "assurance", "pieces"],
        "reponse": (
            "Vos pièces (CNI, permis, assurance) se rangent dans « Documents ». Elles "
            "permettent de préparer un contrôle ou une démarche sans les chercher "
            "chaque fois."
        ),
        "lien": "/documents",
    },

    # ── Score ───────────────────────────────────────────────────────
    {
        "mots_cles": ["mon score", "comment est calcule", "calcul du score", "score eleve"],
        "reponse": (
            "Le score combine quatre familles de signaux : ancienneté de la ligne, "
            "régularité des transactions mobile money, stabilité de la ville, réseau "
            "de contacts. Aucune lecture de vos messages."
        ),
        "lien": "/score",
    },
    {
        "mots_cles": ["score bas", "ameliorer mon score", "monter mon score", "score faible"],
        "reponse": (
            "Un score bas veut dire « peu d'historique », pas « mauvaise personne ». "
            "Il monte avec une utilisation régulière et honnête de vos services "
            "habituels : les pistes concrètes sont sur « Améliorer mon score »."
        ),
        "lien": "/score/amelioration",
    },
    {
        "mots_cles": ["score mis a jour", "recalcul", "frequence du score"],
        "reponse": (
            "Le score se recalcule automatiquement, et vous pouvez demander un "
            "recalcul manuel depuis « Mon score »."
        ),
        "lien": "/score",
    },

    # ── Données & sécurité ──────────────────────────────────────────
    {
        "mots_cles": ["lire mes sms", "lis", "sms", "ecouter mes appels", "appels", "espionner", "collectez", "contenu des messages"],
        "reponse": (
            "Non : DigiID ne lit ni vos SMS ni vos appels. Seules des métadonnées "
            "agrégées sont utilisées (ancienneté de la ligne, régularité des "
            "transactions, ville), jamais le contenu."
        ),
    },
    {
        "mots_cles": ["donnees vendues", "publicite", "partager mes donnees", "revendre"],
        "reponse": (
            "Vos données ne sont jamais vendues. DigiID se finance par les "
            "vérifications d'identité demandées par les institutions, et rien n'est "
            "partagé sans votre accord explicite."
        ),
    },
    {
        "mots_cles": ["supprimer mon compte", "effacer mes donnees", "fermer mon compte"],
        "reponse": (
            "Paramètres → Zone sensible → Supprimer mon compte. Les données sont "
            "effacées sous 30 jours, conformément à la loi 2008-12."
        ),
        "lien": "/parametres",
    },
    {
        "mots_cles": ["mot de passe stocke", "securite du mot de passe", "hachage", "argon"],
        "reponse": (
            "Votre mot de passe n'est jamais stocké en clair : il est protégé par "
            "Argon2id, la recommandation OWASP. Personne ne peut le lire, pas même "
            "nos équipes."
        ),
    },
    {
        "mots_cles": ["phishing", "hameconnage", "faux sms", "code par sms"],
        "reponse": (
            "DigiID ne demande jamais votre mot de passe ni votre code par SMS ou "
            "par téléphone. Si quelqu'un le fait, c'est une tentative de fraude : "
            "ne répondez pas et signalez-le."
        ),
    },
]


def _normaliser(texte: str) -> str:
    """Minuscules sans accents : « Où est mon colis ? » → « ou est mon colis ? »."""
    sans_accents = "".join(
        c for c in unicodedata.normalize("NFD", texte.lower())
        if unicodedata.category(c) != "Mn"
    )
    # Apostrophes et tirets deviennent des espaces : « d'un » → « d un ».
    return " ".join(sans_accents.replace("'", " ").replace("-", " ").split())


def _equivalent(a: str, b: str) -> bool:
    """Deux mots du même radical ? (« refus » / « refusé », « scanne » / « scanner »)

    Règle prudente : un mot court (3 lettres ou moins) ne vaut que lui-même, pour
    que « mon » n'absorbe pas « montrer ».
    """
    if a == b:
        return True
    court, long = (a, b) if len(a) <= len(b) else (b, a)
    if len(court) < 4:
        return False
    return long.startswith(court) and len(long) - len(court) <= 3


def _mot_cle_present(tokens_question: list[str], motif: str) -> bool:
    """Le motif est reconnu si tous ses mots sont présents (peu importe l'ordre)."""
    tokens_motif = _normaliser(motif).split()
    if not tokens_motif:
        return False
    return all(
        any(_equivalent(tm, tq) for tq in tokens_question)
        for tm in tokens_motif
    )


# Message quand rien ne correspond : on guide vers les questions qui marchent.
SUGGESTIONS_PAR_DEFAUT = [
    "Comment envoyer un colis ?",
    "Mon QR est refusé, que faire ?",
    "Comment suivre un envoi ?",
    "Combien j'ai encaissé aujourd'hui ?",
]


def _meilleure_entree(question: str, role: str | None) -> dict | None:
    tokens = _normaliser(question).split()
    meilleure: dict | None = None
    meilleur_score = 0.0
    for entree in BASE:
        score = 0.0
        for mot in entree["mots_cles"]:
            if _mot_cle_present(tokens, mot):
                # Un motif de plusieurs mots est plus précis qu'un mot seul.
                score += 1.0 + 0.3 * (len(_normaliser(mot).split()) - 1)
        if score and role and role in entree.get("profils", []):
            score += 0.5
        if score > meilleur_score:
            meilleure, meilleur_score = entree, score
    return meilleure


def repondre_localement(question: str, role: str | None = None) -> tuple[str, bool]:
    """Répond sans LLM. Retour : (réponse, question reconnue ?).

    Une question reconnue donne une réponse factuelle et un écran à ouvrir ;
    sinon on renvoie une réponse honnête qui propose les questions fréquentes
    plutôt qu'un message d'erreur.
    """
    entree = _meilleure_entree(question, role)
    if entree is not None:
        reponse = entree["reponse"]
        if entree.get("lien"):
            reponse += f"\n\nÉcran : {entree['lien']}"
        return reponse, True

    suggestions = "\n".join(f"- {s}" for s in SUGGESTIONS_PAR_DEFAUT)
    return (
        "Je n'ai pas encore de réponse toute prête à cette question.\n\n"
        "Voici celles que je traite le mieux :\n"
        f"{suggestions}\n\n"
        "Le centre d'aide rassemble le reste, avec un écran à ouvrir pour chaque "
        "réponse : /aide",
        False,
    )
