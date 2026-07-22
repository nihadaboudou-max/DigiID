"use client";

/**
 * Page Admin Domaine — Journal d'audit filtré par domaine.
 * Seuls les événements du domaine de l'admin sont visibles.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";

interface EvenementAudit {
  id: string;
  date_evenement: string;
  type_evenement: string;
  description: string;
  utilisateur_id: string | null;
  role_acteur: string | null;
  adresse_ip: string | null;
}

interface DonneesAudit {
  donnees: EvenementAudit[];
  total: number;
  page: number;
}

const ELEMENTS_PAR_PAGE = 30;

export default function PageAuditDomaine() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [evenements, setEvenements] = useState<EvenementAudit[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [typesUniques, setTypesUniques] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      try {
        const params = new URLSearchParams();
        if (utilisateur?.domaine_id) {
          params.append("domaine_id", utilisateur.domaine_id);
        }
        params.append("limite", "100");

        const data = await clientAPI.get<DonneesAudit>(
          `/api/v1/admin-domaine/audit?${params.toString()}`,
          { authentifie: true }
        );
        if (actif) {
          const tous = data.donnees || [];
          setEvenements(tous);
          const types = [...new Set(tous.map((e: EvenementAudit) => e.type_evenement))].sort();
          setTypesUniques(types);
        }
      } catch (e) {
        if (actif) setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
      } finally {
        if (actif) setChargement(false);
      }
    };
    charger();
    return () => { actif = false; };
  }, [utilisateur?.domaine_id]);

  const evenementsFiltres = evenements.filter((e) => {
    if (filtreType && e.type_evenement !== filtreType) return false;
    if (!recherche) return true;
    const r = recherche.toLowerCase();
    return (
      e.type_evenement.toLowerCase().includes(r) ||
      e.description.toLowerCase().includes(r) ||
      (e.utilisateur_id && e.utilisateur_id.toLowerCase().includes(r))
    );
  });

  const totalPages = Math.ceil(evenementsFiltres.length / ELEMENTS_PAR_PAGE);
  const debut = (page - 1) * ELEMENTS_PAR_PAGE;
  const fin = debut + ELEMENTS_PAR_PAGE;
  const evenementsPagines = evenementsFiltres.slice(debut, fin);

  const obtenirCouleurType = (type: string): "lagune" | "ocre" | "terre" | "succes" => {
    if (type.toLowerCase().includes("echouee") || type.toLowerCase().includes("fraude")) return "terre";
    if (type.toLowerCase().includes("connexion") || type.toLowerCase().includes("deconnexion")) return "lagune";
    if (type.toLowerCase().includes("creation") || type.toLowerCase().includes("création")) return "succes";
    return "ocre";
  };

  return (
    <div className="apparition space-y-6">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin-domaine/tableau-de-bord" className="hover:text-lagune">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Journal d'audit</span>
      </nav>

      <div className="section-header">
        <p className="text-ocre">Admin de Domaine</p>
        <h1>Journal d'audit</h1>
        <p className="text-ardoise-clair/70 text-sm mt-1">
          Événements récents dans ton domaine.
        </p>
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <Carte>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <ChampRecherche
                placeholder="Type, description, utilisateur..."
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <select
                value={filtreType}
                onChange={(e) => { setFiltreType(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm bg-blanc"
              >
                <option value="">Tous les types</option>
                {typesUniques.map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{evenementsFiltres.length}</strong> événement
            {evenementsFiltres.length > 1 ? "s" : ""}
          </p>
        </div>
      </Carte>

      {chargement ? (
        <Carte>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-sable-clair/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </Carte>
      ) : evenementsPagines.length === 0 ? (
        <Carte>
          <p className="text-center text-ardoise-clair italic py-8">
            Aucun événement trouvé.
          </p>
        </Carte>
      ) : (
        <Carte>
          <div className="space-y-3">
            {evenementsPagines.map((e) => {
              const typeNet = e.type_evenement.replace(/_/g, " ");
              const date = new Date(e.date_evenement).toLocaleString("fr-FR", {
                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={e.id} className="border-l-4 border-ocre rounded-r-md pl-4 pr-3 py-3 bg-sable-clair/30">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variante={obtenirCouleurType(e.type_evenement)} taille="petit">
                      {typeNet}
                    </Badge>
                    <time className="text-xs text-ardoise-clair font-mono">{date}</time>
                    {e.utilisateur_id && (
                      <span className="text-xs font-mono text-ardoise-clair/60">
                        #{e.utilisateur_id.substring(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ardoise">{e.description}</p>
                  {e.adresse_ip && (
                    <p className="text-xs text-ardoise-clair/60 mt-1">IP: {e.adresse_ip}</p>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4 mt-4 border-t border-ardoise-clair/10">
              <Bouton
                variante="ghost" taille="petit"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                ← Précédent
              </Bouton>
              <span className="text-sm text-ardoise-clair self-center">
                Page {page}/{totalPages}
              </span>
              <Bouton
                variante="ghost" taille="petit"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Suivant →
              </Bouton>
            </div>
          )}
        </Carte>
      )}
    </div>
  );
}
