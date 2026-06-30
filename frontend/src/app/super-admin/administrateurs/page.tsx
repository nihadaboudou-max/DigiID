"use client";
/**
 * Page super-admin — gestion complète des administrateurs.
 * Création, consultation, édition, suspension, réactivation.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { Tableau, type Colonne } from "@/composants/commun/Tableau";
import { useNotifications } from "@/contextes/notifications";
import {
  listerAdmins, creerAdmin, suspendreAdmin, reactiverAdmin,
  type AdminApercu,
} from "@/services/super_admin";
import { ErreurAPI } from "@/services/client_api";

export default function PageAdministrateurs() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();

  // Liste des admins récupérée du backend
  const [admins, setAdmins] = useState<AdminApercu[]>([]);
  const [chargement, setChargement] = useState(true);

  // État de la recherche locale
  const [recherche, setRecherche] = useState("");

  // État de la modale de création
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [formCreation, setFormCreation] = useState({
    email: "", mot_de_passe: "", prenom: "", nom: "", ville: "Dakar",
  });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  // --- Charger la liste au montage de la page ---
  async function rechargerListe(avecChargement: boolean = true) {
    if (avecChargement) setChargement(true);
    try {
      const reponse = await listerAdmins();
      setAdmins(reponse.administrateurs);
    } catch (e) {
      // Silencieux en rafraîchissement automatique
      if (avecChargement) {
        notifier(
          e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement",
          "erreur",
        );
      }
    } finally {
      if (avecChargement) setChargement(false);
    }
  }

  useEffect(() => {
    rechargerListe();

    // Rafraîchissement automatique toutes les 10 secondes (silencieux)
    const intervalle = setInterval(() => rechargerListe(false), 10000);

    return () => clearInterval(intervalle);
  }, []);

  // --- Création d'un nouvel admin ---
  function modifierChamp(champ: keyof typeof formCreation) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormCreation((f) => ({ ...f, [champ]: e.target.value }));
  }

  async function gererCreation(evt: React.FormEvent) {
    evt.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      const nouveau = await creerAdmin(formCreation);
      notifier(
        `Administrateur créé : ${nouveau.prenom} ${nouveau.nom}. Communique-lui ses identifiants par un canal sécurisé.`,
        "succes",
      );
      // Ajouter en tête de liste sans recharger
      setAdmins((liste) => [nouveau, ...liste]);
      // Réinitialiser le formulaire et fermer la modale
      setFormCreation({ email: "", mot_de_passe: "", prenom: "", nom: "", ville: "Dakar" });
      setModaleOuverte(false);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création";
      setErreurCreation(msg);
    } finally {
      setCreationEnCours(false);
    }
  }

  // --- Suspension / Réactivation ---
  async function gererBascule(admin: AdminApercu) {
    const verbe = admin.est_actif ? "suspendre" : "réactiver";
    if (!confirm(`Veux-tu vraiment ${verbe} ${admin.prenom} ${admin.nom} ?`)) return;
    try {
      const maj = admin.est_actif
        ? await suspendreAdmin(admin.id)
        : await reactiverAdmin(admin.id);
      // Mise à jour locale
      setAdmins((liste) => liste.map((a) => (a.id === admin.id ? maj : a)));
      notifier(
        `Administrateur ${maj.est_actif ? "réactivé" : "suspendu"}.`,
        maj.est_actif ? "succes" : "avertissement",
      );
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  }

  // Filtrage local par la recherche
  const adminsFiltres = admins.filter((a) => {
    const r = recherche.toLowerCase();
    if (!r) return true;
    return (
      a.email.toLowerCase().includes(r) ||
      (a.prenom?.toLowerCase().includes(r) ?? false) ||
      (a.nom?.toLowerCase().includes(r) ?? false)
    );
  });

  // Export CSV des administrateurs
  const gererExportCSV = () => {
    if (adminsFiltres.length === 0) {
      notifier("Aucun administrateur à exporter.", "avertissement");
      return;
    }
    const enTetes = ["Email", "Prénom", "Nom", "Rôle", "Statut", "2FA", "Date création", "Dernière connexion"];
    const lignes = adminsFiltres.map((a) => [
      a.email,
      a.prenom || "",
      a.nom || "",
      a.role,
      a.est_actif ? "Actif" : "Suspendu",
      a.deux_fa_active ? "Oui" : "Non",
      new Date(a.date_creation).toLocaleDateString("fr-FR"),
      a.date_derniere_connexion ? new Date(a.date_derniere_connexion).toLocaleDateString("fr-FR") : "",
    ]);

    const csv = [enTetes.join(","), ...lignes.map((l) => l.join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `digiid-administrateurs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notifier("Export CSV téléchargé.", "succes");
  };

  // Définition des colonnes du tableau
  const colonnes: Colonne<AdminApercu>[] = [
    {
      cle: "identite",
      libelle: "Administrateur",
      rendu: (a) => (
        <Link href={`/super-admin/administrateurs/${a.id}`} className="hover:text-lagune transition-colors">
          <div>
            <p className="font-medium text-ardoise">
              {a.prenom} {a.nom}
            </p>
            <p className="text-xs text-ardoise-clair">{a.email}</p>
          </div>
        </Link>
      ),
    },
    {
      cle: "role",
      libelle: "Rôle",
      alignement: "centre",
      rendu: (a) =>
        a.role === "super_administrateur" ? (
          <Badge variante="ocre">Super admin</Badge>
        ) : (
          <Badge variante="lagune">Admin</Badge>
        ),
    },
    {
      cle: "date_creation",
      libelle: "Créé le",
      rendu: (a) => (
        <span className="text-xs text-ardoise-clair">
          {new Date(a.date_creation).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
    {
      cle: "derniere_connexion",
      libelle: "Dernière connexion",
      rendu: (a) => (
        <span className="text-xs text-ardoise-clair">
          {a.date_derniere_connexion
            ? new Date(a.date_derniere_connexion).toLocaleDateString("fr-FR")
            : "—"}
        </span>
      ),
    },
    {
      cle: "2fa",
      libelle: "2FA",
      alignement: "centre",
      rendu: (a) =>
        a.deux_fa_active ? (
          <Badge variante="succes">✓ Active</Badge>
        ) : (
          <Badge variante="terre">✗ Désactivée</Badge>
        ),
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (a) =>
        a.est_actif ? (
          <Badge variante="succes">Actif</Badge>
        ) : (
          <Badge variante="neutre">Suspendu</Badge>
        ),
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (a) => {
        // On ne peut pas modifier le super admin lui-même
        if (a.role === "super_administrateur") {
          return <span className="text-xs italic text-ardoise-clair">—</span>;
        }
        return (
          <div className="flex gap-2">
            <Link href={`/super-admin/administrateurs/${a.id}`}>
              <Bouton variante="ghost" taille="petit">
                Voir
              </Bouton>
            </Link>
            <Bouton
              variante="ghost"
              taille="petit"
              onClick={() => gererBascule(a)}
              className={a.est_actif ? "!border-terre !text-terre" : ""}
            >
              {a.est_actif ? "Suspendre" : "Réactiver"}
            </Bouton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
          Super administration
        </p>
        <h1 className="mt-1 text-2xl">Administrateurs</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Crée, suspends ou réactive les comptes administrateurs.
          Toute action est tracée dans le journal d'audit avec ton identité.
        </p>
      </header>

      <Alerte variante="avertissement" titre="Action sensible">
        La création d'un administrateur est une action critique. Communique le mot
        de passe par un canal sécurisé (téléphone, en main propre) — jamais par email.
      </Alerte>

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{adminsFiltres.length}</strong> compte
            {adminsFiltres.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="flex-grow sm:w-64">
              <ChampRecherche
                placeholder="Rechercher email, prénom, nom..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            <Bouton variante="ghost" taille="petit" onClick={gererExportCSV} title="Exporter la liste en CSV">
              Exporter
            </Bouton>
            <Bouton
              variante="primaire"
              taille="petit"
              onClick={() => setModaleOuverte(true)}
            >
              + Nouvel administrateur
            </Bouton>
          </div>
        </div>

        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau
            colonnes={colonnes}
            donnees={adminsFiltres}
            cleLigne={(a) => a.id}
            vide="Aucun administrateur correspondant à ta recherche."
          />
        )}
      </Carte>

      {/* Modale de création d'admin */}
      <Modal
        ouvert={modaleOuverte}
        surFermeture={() => !creationEnCours && setModaleOuverte(false)}
        titre="Créer un nouvel administrateur"
        description="Ce compte aura les pleins droits d'administration."
        taille="grand"
      >
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && (
            <Alerte variante="erreur">{erreurCreation}</Alerte>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ChampSaisie
              libelle="Prénom"
              required
              minLength={2}
              value={formCreation.prenom}
              onChange={modifierChamp("prenom")}
            />
            <ChampSaisie
              libelle="Nom"
              required
              minLength={2}
              value={formCreation.nom}
              onChange={modifierChamp("nom")}
            />
          </div>

          <ChampSaisie
            libelle="Email"
            type="email"
            required
            value={formCreation.email}
            onChange={modifierChamp("email")}
            placeholder="admin@digiid.africa"
          />

          <ChampSaisie
            libelle="Mot de passe initial"
            type="password"
            required
            minLength={12}
            value={formCreation.mot_de_passe}
            onChange={modifierChamp("mot_de_passe")}
            aide="Minimum 12 caractères : majuscule, minuscule, chiffre, caractère spécial."
          />

          <ChampSaisie
            libelle="Ville"
            value={formCreation.ville}
            onChange={modifierChamp("ville")}
            placeholder="Dakar"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Bouton
              type="button"
              variante="ghost"
              onClick={() => setModaleOuverte(false)}
              disabled={creationEnCours}
            >
              Annuler
            </Bouton>
            <Bouton
              type="submit"
              variante="primaire"
              chargement={creationEnCours}
            >
              Créer l'administrateur
            </Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}