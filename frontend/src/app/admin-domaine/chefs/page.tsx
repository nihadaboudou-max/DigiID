"use client";

/**
 * Page Admin Domaine — Gestion des chefs de département.
 * Version simplifiée : l'admin de domaine consulte uniquement
 * les chefs de son propre domaine.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Tableau, type Colonne } from "@/composants/commun/Tableau";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Badge } from "@/composants/commun/Badge";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { useNotifications } from "@/contextes/notifications";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";

interface ChefApercu {
  id: string;
  prenom_initiale: string | null;
  nom_initiale: string | null;
  email_masque: string;
  ville: string | null;
  role: string;
  departement_nom: string | null;
  departement_id: string | null;
  est_verrouille: boolean;
  date_inscription: string | null;
}

interface ChefDetail {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  ville: string | null;
  role: string;
  est_actif: boolean;
  est_verrouille: boolean;
  domaine_id: string | null;
  departement_id: string | null;
  departement_nom: string | null;
  date_creation: string;
  date_derniere_connexion: string | null;
  motif_suspension: string | null;
}

export default function PageGestionChefsDomaine() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();
  const [chefs, setChefs] = useState<ChefApercu[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modalDetail, setModalDetail] = useState<ChefDetail | null>(null);
  const [detailChargement, setDetailChargement] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (utilisateur?.domaine_id) {
        params.append("domaine_id", utilisateur.domaine_id);
      }
      params.append("role", "chef");

      const data = await clientAPI.get<ChefApercu[]>(
        `/api/v1/admin/chefs?${params.toString()}`,
        { authentifie: true }
      );
      setChefs(Array.isArray(data) ? data : []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Impossible de charger la liste.");
    } finally {
      setChargement(false);
    }
  }, [utilisateur?.domaine_id]);

  useEffect(() => { charger(); }, [charger]);

  const chargerDetail = async (id: string) => {
    setDetailChargement(true);
    try {
      const data = await clientAPI.get<ChefDetail>(
        `/api/v1/admin/chefs/${id}/detail`,
        { authentifie: true }
      );
      setModalDetail(data);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : String(e);
      notifier(`Impossible de charger le détail: ${msg}`, "erreur");
    } finally {
      setDetailChargement(false);
    }
  };

  const donneesFiltrees = chefs.filter((u) => {
    const r = recherche.toLowerCase();
    if (!r) return true;
    return (
      u.email_masque.toLowerCase().includes(r) ||
      (u.prenom_initiale || "").toLowerCase().includes(r) ||
      (u.nom_initiale || "").toLowerCase().includes(r) ||
      (u.ville || "").toLowerCase().includes(r) ||
      (u.departement_nom || "").toLowerCase().includes(r)
    );
  });

  const obtenirLabelRole = (role: string): string => {
    const mapping: Record<string, string> = {
      chef_police: "Chef Police",
      chef_medical: "Chef Médical",
      chef_ong: "Chef ONG",
      chef_agent: "Chef Enrôlement",
    };
    return mapping[role] || role;
  };

  const obtenirCouleurRole = (role: string): string => {
    const mapping: Record<string, string> = {
      chef_police: "terre",
      chef_medical: "lagune",
      chef_ong: "ocre",
      chef_agent: "lagune",
    };
    return mapping[role] || "lagune";
  };

  const colonnes: Colonne<ChefApercu>[] = [
    {
      cle: "identite",
      libelle: "Identité",
      rendu: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sable flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-lagune" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-ardoise text-sm">
              {[u.prenom_initiale, u.nom_initiale].filter(Boolean).join("  ") || "Sans nom"}
            </p>
            <p className="text-xs text-ardoise-clair/70">{u.email_masque}</p>
            {u.departement_nom && (
              <p className="text-[10px] text-ardoise-clair">{u.departement_nom}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      cle: "role",
      libelle: "Rôle",
      rendu: (u) => (
        <Badge variante={obtenirCouleurRole(u.role) as any} taille="petit">
          {obtenirLabelRole(u.role)}
        </Badge>
      ),
    },
    {
      cle: "ville",
      libelle: "Ville",
      rendu: (u) => <span className="text-sm text-ardoise-clair">{u.ville || "—"}</span>,
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (u) =>
        u.est_verrouille ? (
          <Badge variante="terre">Verrouillé</Badge>
        ) : (
          <Badge variante="succes">Actif</Badge>
        ),
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (u) => (
        <Bouton variante="ghost" taille="petit" onClick={() => chargerDetail(u.id)} title="Voir détails">
          👁️
        </Bouton>
      ),
    },
  ];

  return (
    <div className="apparition space-y-6">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin-domaine/tableau-de-bord" className="hover:text-lagune">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Chefs de département</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="section-header">
          <p className="text-ocre">Admin de Domaine</p>
          <h1>Chefs de département</h1>
          <p className="text-ardoise-clair/70 text-sm mt-1">
            Consulte les profils des chefs de ton domaine, leurs départements et statuts.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href="/admin-domaine/invitations">
            <Bouton variante="primaire" taille="petit">
              + Inviter un chef
            </Bouton>
          </Link>
        </div>
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ardoise-clair/70">
          <strong className="text-lagune font-semibold">{donneesFiltrees.length}</strong> chef
          {donneesFiltrees.length > 1 ? "s" : ""}
          {recherche && (
            <> · filtre : <code className="text-xs bg-sable px-1.5 py-0.5 rounded">{recherche}</code></>
          )}
        </p>
        <div className="w-full sm:w-72">
          <ChampRecherche
            placeholder="Email masqué, initiales, ville, département..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
      </div>

      {chargement ? (
        <Carte>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-sable-clair/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </Carte>
      ) : (
        <Carte>
          <Tableau
            colonnes={colonnes}
            donnees={donneesFiltrees}
            cleLigne={(u) => u.id}
            vide={<div className="text-center py-8"><p className="text-ardoise-clair/70">Aucun chef trouvé dans ton domaine</p></div>}
          />
        </Carte>
      )}

      {/* Modale de détail */}
      {modalDetail && (
        <Modal
          ouvert={true}
          surFermeture={() => setModalDetail(null)}
          titre={modalDetail.prenom || modalDetail.email}
          description={`Rôle: ${obtenirLabelRole(modalDetail.role)}`}
        >
          {detailChargement ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-sable-clair/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-ardoise-clair">Email</p>
                  <p className="font-medium">{modalDetail.email}</p>
                </div>
                <div>
                  <p className="text-xs text-ardoise-clair">Téléphone</p>
                  <p>{modalDetail.telephone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-ardoise-clair">Ville</p>
                  <p>{modalDetail.ville || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-ardoise-clair">Département</p>
                  <p>{modalDetail.departement_nom || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-ardoise-clair">Créé le</p>
                  <p>{new Date(modalDetail.date_creation).toLocaleDateString("fr-FR")}</p>
                </div>
                <div>
                  <p className="text-xs text-ardoise-clair">Dernière connexion</p>
                  <p>
                    {modalDetail.date_derniere_connexion
                      ? new Date(modalDetail.date_derniere_connexion).toLocaleDateString("fr-FR")
                      : "—"}
                  </p>
                </div>
              </div>
              {modalDetail.motif_suspension && (
                <div className="p-3 bg-terre/5 rounded-lg border border-terre/10">
                  <p className="text-xs font-semibold text-terre">Motif suspension</p>
                  <p className="text-sm">{modalDetail.motif_suspension}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-ardoise-clair/10">
                <Bouton variante="ghost" onClick={() => setModalDetail(null)}>
                  Fermer
                </Bouton>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
