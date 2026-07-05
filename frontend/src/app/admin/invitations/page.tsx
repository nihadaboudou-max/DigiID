"use client";
/**
Page admin — Gestion des invitations pour les chefs de département.
L'admin de domaine peut uniquement inviter des chefs (police, médical, ONG, agent).
*/
import { useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { Tableau, type Colonne } from "@/composants/commun/Tableau";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";
// ✅ CORRECTION : Utiliser le service
import {
  listerInvitations,
  creerInvitation,
  annulerInvitation,
  renvoyerInvitation,
  type Invitation,
} from "@/services/invitations";

// Rôles de chefs que l'admin peut inviter
const ROLES_CHEF_INVITABLES = [
  { value: "chef_police", label: "Chef Police", couleur: "terre", icone: "👮" },
  { value: "chef_medical", label: "Chef Médical", couleur: "lagune", icone: "🏥" },
  { value: "chef_ong", label: "Chef ONG", couleur: "ocre", icone: "🤝" },
  { value: "chef_agent", label: "Chef Enrôlement", couleur: "lagune", icone: "📋" },
];

export default function PageInvitationsAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<string>("tous");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [formCreation, setFormCreation] = useState({
    email: "",
    role: "chef_police",
    message: "",
  });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      // ✅ CORRECTION : Utiliser le service avec filtrage par domaine
      const data = await listerInvitations({
        domaine_id: utilisateur?.domaine_id || undefined,
      });
      setInvitations(data.invitations || []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const invitationsFiltrees = invitations.filter((i) => {
    if (!recherche && filtreRole === "tous") return true;
    const q = recherche.toLowerCase();
    const correspondRecherche =
      !recherche ||
      i.email.toLowerCase().includes(q) ||
      i.role.toLowerCase().includes(q) ||
      i.statut.toLowerCase().includes(q);
    const correspondRole = filtreRole === "tous" || i.role === filtreRole;
    return correspondRecherche && correspondRole;
  });

  const gererCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      // ✅ CORRECTION : Utiliser le service
      await creerInvitation({
        email: formCreation.email,
        role: formCreation.role,
        domaine_id: utilisateur?.domaine_id || undefined,
        message: formCreation.message || undefined,
      });
      notifier("Invitation envoyée au chef avec succès !", "succes");
      setModaleOuverte(false);
      setFormCreation({ email: "", role: "chef_police", message: "" });
      charger();
    } catch (e) {
      setErreurCreation(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création");
    } finally {
      setCreationEnCours(false);
    }
  };

  const gererRenvoi = async (id: string) => {
    if (!confirm("Renvoyer cette invitation ?")) return;
    try {
      await renvoyerInvitation(id);
      notifier("Invitation renvoyée", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    }
  };

  const gererAnnulation = async (id: string) => {
    if (!confirm("Annuler cette invitation ?")) return;
    try {
      await annulerInvitation(id);
      notifier("Invitation annulée", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    }
  };

  const obtenirCouleurRole = (role: string): string => {
    const roleInfo = ROLES_CHEF_INVITABLES.find((r) => r.value === role);
    return roleInfo?.couleur || "lagune";
  };

  const obtenirLabelRole = (role: string): string => {
    const roleInfo = ROLES_CHEF_INVITABLES.find((r) => r.value === role);
    return roleInfo?.label || role;
  };

  const obtenirIconeRole = (role: string): string => {
    const roleInfo = ROLES_CHEF_INVITABLES.find((r) => r.value === role);
    return roleInfo?.icone || "👤";
  };

  const colonnes: Colonne<Invitation>[] = [
    {
      cle: "email",
      libelle: "Email",
      rendu: (i) => <p className="font-medium text-ardoise">{i.email}</p>,
    },
    {
      cle: "role",
      libelle: "Rôle",
      rendu: (i) => {
        const couleur = obtenirCouleurRole(i.role);
        const label = obtenirLabelRole(i.role);
        const icone = obtenirIconeRole(i.role);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{icone}</span>
            <Badge variante={couleur as any} taille="petit">
              {label}
            </Badge>
          </div>
        );
      },
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (i) => {
        if (i.statut === "acceptee") return <Badge variante="succes">Acceptée</Badge>;
        if (i.statut === "expiree") return <Badge variante="terre">Expirée</Badge>;
        return <Badge variante="ocre">En attente</Badge>;
      },
    },
    {
      cle: "date_creation",
      libelle: "Créée le",
      rendu: (i) => (
        <span className="text-xs text-ardoise-clair">
          {new Date(i.date_creation).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (i) => (
        <div className="flex gap-1">
          {i.statut === "en_attente" && (
            <Bouton variante="ghost" taille="petit" onClick={() => gererRenvoi(i.id)}>
              Renvoyer
            </Bouton>
          )}
          {i.statut === "en_attente" && (
            <Bouton variante="danger" taille="petit" onClick={() => gererAnnulation(i.id)}>
              Annuler
            </Bouton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-terre font-semibold text-xs uppercase tracking-wider">Administration de domaine</p>
        <h1 className="mt-1 text-2xl">Invitations aux chefs</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Invitez des chefs de département (Police, Médical, ONG, Enrôlement) pour votre domaine.
          Chaque chef pourra ensuite créer ses propres agents.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{invitationsFiltrees.length}</strong> invitation
            {invitationsFiltrees.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <select
              value={filtreRole}
              onChange={(e) => setFiltreRole(e.target.value)}
              className="px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="tous">Tous les chefs</option>
              {ROLES_CHEF_INVITABLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.icone} {r.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher..."
              className="flex-grow sm:w-64 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            />
            <Bouton variante="primaire" taille="petit" onClick={() => setModaleOuverte(true)}>
              + Inviter un chef
            </Bouton>
          </div>
        </div>
        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau
            colonnes={colonnes}
            donnees={invitationsFiltrees}
            cleLigne={(i) => i.id}
            vide="Aucune invitation trouvée."
          />
        )}
      </Carte>

      {/* Modale Création */}
      <Modal
        ouvert={modaleOuverte}
        surFermeture={() => setModaleOuverte(false)}
        titre="Inviter un chef de département"
        taille="moyen"
      >
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && <Alerte variante="erreur">{erreurCreation}</Alerte>}
          
          <Alerte variante="info" titre="Information importante">
            L'invitation sera liée à votre domaine <strong>{utilisateur?.domaine_id || "inconnu"}</strong>.
            Le chef invité pourra gérer les départements de ce domaine.
          </Alerte>

          <ChampSaisie
            libelle="Email du chef"
            type="email"
            value={formCreation.email}
            onChange={(e) => setFormCreation({ ...formCreation, email: e.target.value })}
            placeholder="chef@digiid.africa"
            required
          />

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
              Type de chef à inviter
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES_CHEF_INVITABLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setFormCreation({ ...formCreation, role: r.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    formCreation.role === r.value
                      ? `border-${r.couleur} bg-${r.couleur}/5 ring-2 ring-${r.couleur}/20`
                      : "border-ardoise-clair/10 hover:border-lagune/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{r.icone}</span>
                    <div>
                      <p className="font-semibold text-sm text-ardoise">{r.label}</p>
                      <p className="text-xs text-ardoise-clair">Chef de département</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Message personnalisé (optionnel)
            </label>
            <textarea
              value={formCreation.message}
              onChange={(e) => setFormCreation({ ...formCreation, message: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              rows={3}
              placeholder="Ajoutez un message pour expliquer le rôle et les responsabilités..."
            />
          </div>

          <div className="bg-ocre/5 border border-ocre/20 rounded-lg p-3">
            <p className="text-xs text-ocre font-semibold">⚠️ Action importante</p>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Cette invitation donnera accès à la gestion des départements de votre domaine.
              Le chef pourra créer et gérer ses propres agents.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleOuverte(false)}>
              Annuler
            </Bouton>
            <Bouton type="submit" variante="primaire" chargement={creationEnCours}>
              Envoyer l'invitation
            </Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}