"use client";

/**
 * Page super-admin — journal d'audit complet, immuable, avec pagination.
 * VERSION AMÉLIORÉE : filtrage avancé, pagination, dates.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Alerte } from "@/composants/commun/Alerte";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import {
  exporterAuditCSV,
  listerAudit,
  type FiltresAudit,
} from "@/services/super_admin_v2";

interface EvenementAudit {
  id: string;
  date_evenement: string;
  type_evenement: string;
  description: string;
  utilisateur_id: string | null;
  nom_utilisateur: string | null;
  role_acteur: string | null;
  adresse_ip: string | null;
  agent_utilisateur: string | null;
  donnees_supplementaires: Record<string, unknown> | null;
  score_risque: number | null;
}

const ELEMENTS_PAR_PAGE = 5;

const dateDebutISO = (date: string) =>
  date ? `${date}T00:00:00+00:00` : undefined;

const dateFinISO = (date: string) =>
  date ? `${date}T23:59:59.999000+00:00` : undefined;

export default function PageAuditSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [evenements, setEvenements] = useState<EvenementAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  // État des filtres
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<string>("");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [page, setPage] = useState(1);
  const [typesUniques, setTypesUniques] = useState<string[]>([]);
  const [erreurchargement, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    const timer = window.setTimeout(async () => {
      setChargement(true);
      setErreur(null);
      try {
        const filtres: FiltresAudit = {
          page,
          limite: ELEMENTS_PAR_PAGE,
          type_evenement: filtre || undefined,
          date_debut: dateDebutISO(dateDebut),
          date_fin: dateFinISO(dateFin),
          recherche: recherche.trim() || undefined,
        };
        const resultat = await listerAudit(filtres);
        if (annule) return;
        setEvenements(resultat.donnees);
        setTotal(resultat.total);
        setPages(resultat.pages);
        setTypesUniques(resultat.types_evenements);
      } catch (e) {
        if (!annule) {
          setErreur(e instanceof Error ? e.message : "Erreur de chargement");
        }
      } finally {
        if (!annule) setChargement(false);
      }
    }, recherche.trim() ? 250 : 0);

    return () => {
      annule = true;
      window.clearTimeout(timer);
    };
  }, [page, filtre, dateDebut, dateFin, recherche]);

  const reinitialiserFiltres = () => {
    setRecherche("");
    setFiltre("");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  };

  const avezFiltres = Boolean(recherche || filtre || dateDebut || dateFin);
  const debut = total > 0 ? (page - 1) * ELEMENTS_PAR_PAGE + 1 : 0;
  const fin = Math.min(page * ELEMENTS_PAR_PAGE, total);

  const gererExportCSV = async () => {
    setExportEnCours(true);
    setErreur(null);
    try {
      const blob = await exporterAuditCSV({
        type_evenement: filtre || undefined,
        date_debut: dateDebutISO(dateDebut),
        date_fin: dateFinISO(dateFin),
        recherche: recherche.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `digiid-audit-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(lien);
      lien.click();
      document.body.removeChild(lien);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible d'exporter le journal.");
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <header>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1 text-2xl">Journal d'audit immuable</h1>
          <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
            Toutes les actions sensibles du système. Conservation selon les exigences applicables de l'APDP.
            Immuable : aucune suppression ni modification autorisée.
          </p>
        </header>
        <div className="flex gap-2 flex-wrap">
          <Bouton
            variante="ghost"
            taille="petit"
            chargement={exportEnCours}
            onClick={gererExportCSV}
          >
            Exporter CSV
          </Bouton>
        </div>
      </div>

      {erreurchargement && (
        <Alerte variante="erreur" titre="Erreur">
          {erreurchargement}
        </Alerte>
      )}

      <Carte titre="Filtrage avancé">
        <div className="space-y-3">
          {/* Ligne 1 : Recherche */}
          <div>
            <label className="block text-xs uppercase text-ardoise-clair mb-1 font-semibold">
              Recherche textuelle
            </label>
            <ChampRecherche
              placeholder="Type, description, identifiant utilisateur, adresse IP..."
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Ligne 2 : Type et dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair mb-1 font-semibold">
                Type d'événement
              </label>
              <select
                value={filtre}
                onChange={(e) => {
                  setFiltre(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm bg-blanc focus:outline-none focus:border-lagune"
              >
                <option value="">Tous les types</option>
                {typesUniques.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase text-ardoise-clair mb-1 font-semibold">
                Du
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => {
                  setDateDebut(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm bg-blanc focus:outline-none focus:border-lagune"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ardoise-clair mb-1 font-semibold">
                Au
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => {
                  setDateFin(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm bg-blanc focus:outline-none focus:border-lagune"
              />
            </div>
          </div>

          {/* Réinitialiser */}
          {avezFiltres && (
            <div className="pt-1 text-right">
              <Bouton variante="ghost" taille="petit" onClick={reinitialiserFiltres}>
                ↻ Réinitialiser tous les filtres
              </Bouton>
            </div>
          )}
        </div>
      </Carte>

      <Carte>
        {/* Statistiques */}
        <div className="mb-4 pb-4 border-b border-ardoise-clair/10">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="text-sm text-ardoise-clair">
                <strong className="text-lagune">{total}</strong> événement
                {total > 1 ? "s" : ""} correspondant
                {total > 1 ? "s" : ""} aux filtres
                {total > 0 && (
                  <span className="ml-2 italic text-xs">
                    — Affichage {debut} à {fin}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Résultats */}
        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">
            Chargement des événements...
          </p>
        ) : evenements.length === 0 ? (
          <p className="text-center text-ardoise-clair italic py-6">
            {avezFiltres
              ? "Aucun événement ne correspond à vos critères de recherche."
              : "Aucun événement enregistré pour l'instant."}
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {evenements.map((e) => (
              <LigneEvenement key={e.id} evenement={e} />
            ))}
          </div>
        )}
        <PaginationListe
          page={page}
          total={total}
          parPage={ELEMENTS_PAR_PAGE}
          chargement={chargement}
          surChangement={setPage}
        />
      </Carte>
    </div>
  );
}

function LigneEvenement({ evenement }: { evenement: EvenementAudit }) {
  const [deplie, setDeplie] = useState(false);

  const typeNet = evenement.type_evenement.replace(/_/g, " ");
  const variant: "lagune" | "ocre" | "terre" | "succes" =
    typeNet.toLowerCase().includes("echouee") ||
    typeNet.toLowerCase().includes("intrusion") ||
    typeNet.toLowerCase().includes("fraude")
      ? "terre"
      : typeNet.toLowerCase().includes("connexion") ||
        typeNet.toLowerCase().includes("deconnexion")
      ? "lagune"
      : typeNet.toLowerCase().includes("création") ||
        typeNet.toLowerCase().includes("creation")
      ? "succes"
      : "ocre";

  const dateFormatee = new Date(evenement.date_evenement).toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const aDetails =
    evenement.agent_utilisateur ||
    evenement.donnees_supplementaires ||
    evenement.role_acteur;

  return (
    <div
      className={`border-l-4 border-ocre rounded-r-md pl-4 pr-3 py-2 transition-colors cursor-pointer ${
        deplie ? "bg-sable" : "bg-sable-clair hover:bg-sable"
      }`}
      onClick={() => setDeplie(!deplie)}
    >
      <div className="flex justify-between gap-3 items-start mb-1 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variante={variant} taille="petit">
            {typeNet}
          </Badge>
          <span className="text-xs text-ardoise-clair font-mono bg-blanc px-2 py-0.5 rounded border border-ardoise-clair/20">
            {evenement.id.substring(0, 8)}
          </span>
          {evenement.score_risque !== null && evenement.score_risque !== undefined && evenement.score_risque > 50 && (
            <span className="text-xs font-semibold text-terre bg-terre/10 px-2 py-0.5 rounded">
              Risque {evenement.score_risque}/100
            </span>
          )}
        </div>
        <time className="text-xs text-ardoise-clair whitespace-nowrap font-mono">
          {dateFormatee}
        </time>
      </div>

      <p className="text-sm text-ardoise mb-1 leading-relaxed">
        {evenement.description}
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        {evenement.utilisateur_id && (
          <span className="font-mono bg-blanc border border-ardoise-clair/20 px-2 py-0.5 rounded text-ardoise-clair flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium text-ardoise">{evenement.nom_utilisateur || "Inconnu"}</span>
            <span className="text-ardoise-clair ml-1">({evenement.utilisateur_id.substring(0, 8)}...)</span>
          </span>
        )}
        {evenement.adresse_ip && (
          <span className="font-mono bg-blanc border border-ardoise-clair/20 px-2 py-0.5 rounded text-ardoise-clair">
            <strong>IP :</strong> {evenement.adresse_ip}
          </span>
        )}
        {evenement.role_acteur && (
          <span className="bg-blanc border border-ardoise-clair/20 px-2 py-0.5 rounded text-ardoise-clair">
            <strong>Rôle :</strong> {evenement.role_acteur}
          </span>
        )}
        {aDetails && (
          <span className="text-ocre text-xs ml-auto">
            {deplie ? "▲ Réduire" : "▼ Détails"}
          </span>
        )}
      </div>

      {/* Section dépliée : détails complets */}
      {deplie && aDetails && (
        <div className="mt-2 pt-2 border-t border-ardoise-clair/10 space-y-2">
          {evenement.agent_utilisateur && (
            <div className="text-xs">
              <span className="font-semibold text-ardoise-clair">User-Agent :</span>
              <p className="font-mono mt-1 text-ardoise-clair bg-blanc/50 p-2 rounded text-[11px] break-all">
                {evenement.agent_utilisateur}
              </p>
            </div>
          )}

          {evenement.donnees_supplementaires && (
            <div className="text-xs">
              <span className="font-semibold text-ardoise-clair">Données contextuelles :</span>
              <pre className="font-mono mt-1 text-ardoise-clair bg-blanc/50 p-2 rounded text-[11px] overflow-x-auto">
                {JSON.stringify(evenement.donnees_supplementaires, null, 2)}
              </pre>
            </div>
          )}

          <div className="text-xs text-ardoise-clair pt-1">
            <strong>ID événement :</strong> <span className="font-mono">{evenement.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}