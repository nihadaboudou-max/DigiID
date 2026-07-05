"use client";
/**
Page super-admin — gestion complète des administrateurs et chefs.
Création, consultation, édition, suspension, réactivation.
Gère TOUS les rôles : admin_domaine, chef_*, agent_*
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

// NOUVEAU : Liste complète des rôles gérables par le super admin
const ROLES_GERABLES = [
  { value: "admin_domaine", label: "Admin Domaine", couleur: "ocre" },
  { value: "chef_police", label: "Chef Police", couleur: "terre" },
  { value: "chef_medical", label: "Chef Médical", couleur: "lagune" },
  { value: "chef_ong", label: "Chef ONG", couleur: "ocre" },
  { value: "chef_agent", label: "Chef Enrôlement", couleur: "lagune" },
  { value: "agent_police", label: "Agent Police", couleur: "terre" },
  { value: "agent_medical", label: "Agent Médical", couleur: "lagune" },
  { value: "agent_ong", label: "Agent ONG", couleur: "ocre" },
  { value: "agent_terrain", label: "Agent Terrain", couleur: "lagune" },
];

export default function PageAdministrateurs() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur", "super_admin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [admins, setAdmins] = useState<AdminApercu[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<string>("tous"); // NOUVEAU
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [formCreation, setFormCreation] = useState({
    email: "", mot_de_passe: "", prenom: "", nom: "", ville: "Dakar",
    role: "admin_domaine", // NOUVEAU : rôle sélectionnable
  });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  async function rechargerListe(avecChargement: boolean = true) {
    if (avecChargement) setChargement(true);
    try {
      const reponse = await listerAdmins();
      setAdmins(reponse.administrateurs);
    } catch (e) {
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
    const intervalle = setInterval(() => rechargerListe(false), 10000);
    return () => clearInterval(intervalle);
  }, []);

  function modifierChamp(champ: keyof typeof formCreation) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFormCreation((f) => ({ ...f, [champ]: e.target.value }));
  }

  async function gererCreation(evt: React.FormEvent) {
    evt.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      const nouveau = await creerAdmin(formCreation);
      notifier(
        `Administrateur créé : ${nouveau.prenom} ${nouveau.nom} (${nouveau.role}). Communique-lui ses identifiants par un canal sécurisé.`,
        "succes",
      );
      setAdmins((liste) => [nouveau, ...liste]);
      setFormCreation({ email: "", mot_de_passe: "", prenom: "", nom: "", ville: "Dakar", role: "admin_domaine" });
      setModaleOuverte(false);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création";
      setErreurCreation(msg);
    } finally {
      setCreationEnCours(false);
    }
  }

  async function gererBascule(admin: AdminApercu) {
    const verbe = admin.est_actif ? "suspendre" : "réactiver";
    if (!confirm(`Veux-tu vraiment ${verbe} ${admin.prenom} ${admin.nom} ?`)) return;
    try {
      const maj = admin.est_actif
        ? await suspendreAdmin(admin.id)
        : await reactiverAdmin(admin.id);
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

  // Filtrage par recherche ET par rôle
  const adminsFiltres = admins.filter((a) => {
    const r = recherche.toLowerCase();
    const correspondRecherche = !r || 
      a.email.toLowerCase().includes(r) ||
      (a.prenom?.toLowerCase().includes(r) ?? false) ||
      (a.nom?.toLowerCase().includes(r) ?? false);
    const correspondRole = filtreRole === "tous" || a.role === filtreRole;
    return correspondRecherche && correspondRole;
  });

  const gererExportCSV = () => {
    if (adminsFiltres.length === 0) {
      notifier("Aucun administrateur à exporter.", "avertissement");
      return;
    }
    const enTetes = ["Email", "Prénom", "Nom", "Rôle", "Statut", "2FA", "Date création", "Dernière connexion"];
    const lignes = adminsFiltres.map((a) => [
      a.email, a.prenom || "", a.nom || "", a.role,
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

  // NOUVEAU : Fonction pour obtenir la couleur du badge selon le rôle
  const obtenirCouleurRole = (role: string): string => {
    const roleInfo = ROLES_GERABLES.find(r => r.value === role);
    return roleInfo?.couleur || "lagune";
  };

  const colonnes: Colonne<AdminApercu>[] = [
    {
      cle: "identite",
      libelle: "Administrateur",
      rendu: (a) => (
        <Link href={`/super-admin/administrateurs/${a.id}`} className="hover:text-lagune transition-colors">
          <div>
            <p className="font-medium text-ardoise">{a.prenom} {a.nom}</p>
            <p className="text-xs text-ardoise-clair">{a.email}</p>
          </div>
        </Link>
      ),
    },
    {
      cle: "role",
      libelle: "Rôle",
      alignement: "centre",
      rendu: (a) => {
        const couleur = obtenirCouleurRole(a.role);
        const label = ROLES_GERABLES.find(r => r.value === a.role)?.label || a.role;
        return <Badge variante={couleur as any}>{label}</Badge>;
      },
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
        if (a.role === "super_administrateur" || a.role === "super_admin") {
          return <span className="text-xs italic text-ardoise-clair">—</span>;
        }
        return (
          <div className="flex gap-2">
            <Link href={`/super-admin/administrateurs/${a.id}`}>
              <Bouton variante="ghost" taille="petit">Voir</Bouton>
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
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
          Super administration
        </p>
        <h1 className="mt-1 text-2xl">Administrateurs & Chefs</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Crée, suspends ou réactive les comptes administrateurs, chefs de département et agents.
          Toute action est tracée dans le journal d'audit avec ton identité.
        </p>
      </header>

      <Alerte variante="avertissement" titre="Action sensible">
        La création d'un administrateur ou chef est une action critique. Communique le mot
        de passe par un canal sécurisé (téléphone, en main propre) — jamais par email.
      </Alerte>

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{adminsFiltres.length}</strong> compte
            {adminsFiltres.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            {/* NOUVEAU : Filtre par rôle */}
            <select
              value={filtreRole}
              onChange={(e) => setFiltreRole(e.target.value)}
              className="px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="tous">Tous les rôles</option>
              {ROLES_GERABLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
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
              + Nouvel utilisateur
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
            vide="Aucun utilisateur correspondant à ta recherche."
          />
        )}
      </Carte>

      {/* Modale de création */}
      <Modal
        ouvert={modaleOuverte}
        surFermeture={() => !creationEnCours && setModaleOuverte(false)}
        titre="Créer un nouvel utilisateur"
        description="Ce compte aura les droits associés au rôle sélectionné."
        taille="grand"
      >
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && (
            <Alerte variante="erreur">{erreurCreation}</Alerte>
          )}
          {/* NOUVEAU : Sélection du rôle */}
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Rôle
            </label>
            <select
              value={formCreation.role}
              onChange={modifierChamp("role")}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              {ROLES_GERABLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
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
            placeholder="user@digiid.africa"
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
              Créer l'utilisateur
            </Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}