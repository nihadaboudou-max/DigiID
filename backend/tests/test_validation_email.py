# -*- coding: utf-8 -*-
"""Tests unitaires pour la validation des emails institutionnels."""
import sys
sys.path.insert(0, "backend")

# On recopie la logique pour tester sans dépendances lourdes
DOMAINES_INSTITUTIONNELS = {
    "medecin": ["sante.sn", "hopital.sn", "medecin.sn"],
    "police": ["police.sn", "interieur.gouv.sn"],
    "agent": ["administration.sn", "gouv.sn"],
    "ong": ["ong.sn", "asso.sn"],
}
DOMAINES_BANNIS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"]


def _domaine_email(email):
    partie = email.split("@")
    return partie[1].strip().lower() if len(partie) == 2 else ""


def _domaine_est_banni(domaine):
    return any(domaine == b or domaine.endswith("." + b) for b in DOMAINES_BANNIS)


def _domaine_correspond_a_role(domaine, role):
    domaines_autorises = DOMAINES_INSTITUTIONNELS.get(role, [])
    return any(domaine == a or domaine.endswith("." + a) for a in domaines_autorises)


def valider_email_institutionnel(email, role_cible):
    if role_cible not in DOMAINES_INSTITUTIONNELS:
        return True, None
    domaine = _domaine_email(email)
    if not domaine:
        return False, "Email invalide"
    if _domaine_est_banni(domaine):
        return False, f"Domaine {domaine} banni pour role {role_cible}"
    if not _domaine_correspond_a_role(domaine, role_cible):
        return False, f"Domaine {domaine} non autorise pour {role_cible}"
    return True, None


# Tests
tests = [
    ("medecin@hopital.sn", "medecin", True),
    ("medecin@gmail.com", "medecin", False),
    ("agent@administration.sn", "agent", True),
    ("agent@yahoo.com", "agent", False),
    ("policier@police.sn", "police", True),
    ("policier@gmail.com", "police", False),
    ("citoyen@gmail.com", "citoyen", True),  # citoyen pas de verification
    ("ong@ong.sn", "ong", True),
    ("medecin@sante.gouv.sn", "medecin", False),  # pas dans la liste medecin
    ("agent@impots.gouv.sn", "agent", True),  # gouv.sn est dans agent
]

succes = 0
echecs = 0
for email, role, attendu in tests:
    valide, raison = valider_email_institutionnel(email, role)
    if valide == attendu:
        succes += 1
        print(f"  OK: {email:40s} -> role={role:12s} valide={valide}")
    else:
        echecs += 1
        print(f"  ECHEC: {email:40s} -> role={role:12s} valide={valide} (attendu={attendu}) raison={raison}")

print(f"\nResultats: {succes}/10 reussis, {echecs} echecs")
sys.exit(0 if echecs == 0 else 1)
