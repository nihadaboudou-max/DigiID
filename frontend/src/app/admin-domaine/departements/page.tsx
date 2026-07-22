"use client";

/**
 * Page Admin Domaine — Consultation des départements.
 * L'admin de domaine voit uniquement les départements de son domaine.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { Bouton } from "@/composants/commun/Bouton";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import type { BadgeVariante } from "@/composants/commun/Badge";

interface Departement {
  id: string;
  nom: string;
  type_departement: string;
  description: string | null;
  capacite_max: number;
  domaine_id: string;
  domaine_nom: string | null;
  chef_id: string | null;
  chef_nom: string | null;
  est_actif: boolean;
  date_creation: string;
}

const TYPES_DEPARTEMENT: Record<string, { label: string; couleur: BadgeVariante }> = {
  police: { label: "Police", couleur: "terre" },
  medical: { label: "Médical", couleur: "lagune" },
  ong: { label: "ONG", couleur: "ocre" },
  agent: { label: "Enrôlement", couleur: "lagune" },
};

export default function PageDepartementsDomaine() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modaleDetails, setModaleDetails] = useState<Departement | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (utilisateur?.domaine_id) {
        params.append("domaine_id", utilisateur.domaine_id);
      }
      const data = await clientAPI.get<{ departements: Departement[] }>(
        `/api/v1/departements?${params.toString()}`,
        { authentifie: true }
      );
      setDepartements(data.departements || []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [utilisateur?.domaine_id]);

  useEffect(() => { charger(); }, [charger]);

  const departementsFiltres = departements.filter((d) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      d.nom.toLowerCase().includes(q) ||
      d.type_departement.toLowerCase().includes(q) ||
      (d.chef_nom && d.chef_nom.toLowerCase().includes(q))
    );
  });

  const obtenirConfig = (type: string) =>
    TYPES_DEPARTEMENT[type] || { label: type, couleur: "lagune" as BadgeVariante };

  return (
    <div className="apparition space-y-6">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin-domaine/tableau-de-bord" className="hover:text-lagune">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Départements</span>
      </nav>

      <div className="section-header">
        <p className="text-ocre">Admin de Domaine</p>
        <h1>Départements</h1>
        <p className="text-ardoise-clair/70 text-sm mt-1">
          Consulte les départements de ton domaine et leurs responsables.
        </p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ardoise-clair/70">
          <strong className="text-lagune">{departementsFiltres.length}</strong> département
          {departementsFiltres.length > 1 ? "s" : ""}
        </p>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un département..."
          className="w-full sm:w-72 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
        />
      </div>

      {chargement ? (
        <Carte>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-sable-clair/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </Carte>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {departementsFiltres.map((dep) => {
            const config = obtenirConfig(dep.type_departement);
            return (
              <div
                key={dep.id}
                className="carte cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setModaleDetails(dep)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-ardoise">{dep.nom}</h3>
                    <Badge variante={config.couleur} taille="petit">
                      {config.label}
                    </Badge>
                  </div>
                  {dep.est_actif ? (
                    <Badge variante="succes" taille="petit">Actif</Badge>
                  ) : (
                    <Badge variante="neutre" taille="petit">Inactif</Badge>
                  )}
                </div>
                <div className="text-sm text-ardoise-clair space-y-1">
                  {dep.chef_nom && (
                    <p><strong>Chef :</strong> {dep.chef_nom}</p>
                  )}
                  {dep.description && (
                    <p className="text-xs line-clamp-2">{dep.description}</p>
                  )}
                </div>
              </div>
            );
          })}
          {!chargement && departementsFiltres.length === 0 && (
            <div className="col-span-2 text-center py-12 text-ardoise-clair italic">
              Aucun département trouvé dans ton domaine.
            </div>
          )}
        </div>
      )}

      {/* Modale détails */}
      {modaleDetails && (
        <Modal
          ouvert={true}
          surFermeture={() => setModaleDetails(null)}
          titre={modaleDetails.nom}
          description={`Département ${obtenirConfig(modaleDetails.type_departement).label}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-ardoise-clair">Type</p>
                <Badge variante={obtenirConfig(modaleDetails.type_departement).couleur}>
                  {obtenirConfig(modaleDetails.type_departement).label}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Statut</p>
                {modaleDetails.est_actif ? (
                  <Badge variante="succes">Actif</Badge>
                ) : (
                  <Badge variante="neutre">Inactif</Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Chef</p>
                <p className="font-medium">{modaleDetails.chef_nom || "Non assigné"}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Capacité</p>
                <p>{modaleDetails.capacite_max} personnes</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-ardoise-clair">Description</p>
                <p>{modaleDetails.description || "Aucune description"}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Créé le</p>
                <p>{new Date(modaleDetails.date_creation).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
            <div className="flex justify-end pt-3 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModaleDetails(null)}>
                Fermer
              </Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
