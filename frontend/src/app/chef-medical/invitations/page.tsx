"use client";

import { useState, useEffect } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import {
  listerInvitations,
  annulerInvitation,
  renvoyerInvitation,
  type InvitationResponse, // ✅ On utilise le type du service, PAS d'interface locale
} from "@/services/chefs";

export default function ChefMedicalInvitationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  // ✅ State typé avec InvitationResponse du service
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    chargerInvitations();
  }, []);

  async function chargerInvitations() {
    setChargement(true);
    setErreur("");
    try {
      const data = await listerInvitations({ par_page: 100 });
      // ✅ Plus de conflit de type ici car on utilise InvitationResponse
      setInvitations(data.invitations || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des invitations");
    } finally {
      setChargement(false);
    }
  }

  async function handleAnnuler(invitationId: string) {
    if (!confirm("Annuler cette invitation ?")) return;
    try {
      await annulerInvitation(invitationId);
      await chargerInvitations();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de l'annulation");
    }
  }

  async function handleRenvoyer(invitationId: string) {
    try {
      await renvoyerInvitation(invitationId);
      await chargerInvitations();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors du renvoi");
    }
  }

  const getBadgeStatut = (statut: string) => {
    const config: Record<string, { couleur: any; label: string }> = {
      en_attente: { couleur: "ocre", label: "En attente" },
      acceptee: { couleur: "succes", label: "Acceptée" },
      expiree: { couleur: "terre", label: "Expirée" },
      annulee: { couleur: "lagune", label: "Annulée" },
    };
    const cfg = config[statut] || { couleur: "lagune", label: statut };
    return <Badge variante={cfg.couleur} taille="petit">{cfg.label}</Badge>;
  };

  const invitationsFiltrees = invitations.filter((inv) => {
    const matchStatut = filtreStatut === "tous" || inv.statut === filtreStatut;
    const matchRecherche = inv.email.toLowerCase().includes(recherche.toLowerCase());
    return matchStatut && matchRecherche;
  });

  const stats = {
    total: invitations.length,
    en_attente: invitations.filter((i) => i.statut === "en_attente").length,
    acceptees: invitations.filter((i) => i.statut === "acceptee").length,
    expirees: invitations.filter((i) => i.statut === "expiree").length,
  };

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      <div>
        <p className="text-lagune font-semibold text-sm uppercase tracking-wider">✉️ Invitations</p>
        <h1 className="text-3xl font-bold text-ardoise mt-1">Invitations Médicales</h1>
        <p className="text-ardoise-clair mt-2">Suivez les invitations envoyées à vos futurs médecins et agents médicaux</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-lagune">{stats.total}</p>
          <p className="text-xs text-ardoise-clair">Total</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-ocre">{stats.en_attente}</p>
          <p className="text-xs text-ardoise-clair">En attente</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-succes">{stats.acceptees}</p>
          <p className="text-xs text-ardoise-clair">Acceptées</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-terre">{stats.expirees}</p>
          <p className="text-xs text-ardoise-clair">Expirées</p>
        </Carte>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par email..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="acceptee">Acceptées</option>
          <option value="expiree">Expirées</option>
          <option value="annulee">Annulées</option>
        </select>
      </div>

      <Carte titre={`${invitationsFiltrees.length} invitation(s)`}>
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair italic">Chargement...</p>
          </div>
        ) : invitationsFiltrees.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">✉️</p>
            <p className="text-ardoise-clair italic">
              {recherche ? "Aucune invitation trouvée." : "Aucune invitation envoyée."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitationsFiltrees.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✉️</span>
                  <div>
                    <p className="font-semibold text-ardoise">{invitation.email}</p>
                    <p className="text-xs text-ardoise-clair">
                      Envoyée le {new Date(invitation.date_creation).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getBadgeStatut(invitation.statut)}
                  {invitation.statut === "en_attente" && (
                    <>
                      <button
                        onClick={() => handleRenvoyer(invitation.id)}
                        className="px-3 py-1 text-xs bg-lagune text-white rounded hover:bg-lagune/90 transition-colors"
                      >
                        Renvoyer
                      </button>
                      <button
                        onClick={() => handleAnnuler(invitation.id)}
                        className="px-3 py-1 text-xs bg-terre text-white rounded hover:bg-terre/90 transition-colors"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>
    </div>
  );
}