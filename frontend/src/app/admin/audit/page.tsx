"use client";

/**
 * Page administrateur — journal d'audit complet, immuable, avec pagination.
 * Même contenu que le super admin, accessible au rôle administrateur.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface EvenementAudit {
  id: string;
  date_evenement: string;
  type_evenement: string;
  description: string;
  utilisateur_id: string | null;
  role_acteur: string | null;
  adresse_ip: string | null;
  donnees_supplementaires: Record<string, unknown> | null;
}

interface DonneesAdmin {
  donnees: EvenementAudit[];
  total: number;
  page: number;
}

const ELEMENTS_PAR_PAGE = 50;

export default function PageAuditAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [allEvenements, setAllEvenements] = useState<EvenementAudit[]>([]);
  const [evenementsFiltres, setEvenementsFiltres] = useState<EvenementAudit[]>([]);

  // État des filtres
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<string>("");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [page, setPage] = useState(1);
  const [typesUniques, setTypesUniques] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  // Charger les données au montage
  useEffect(() => {
    const charger = async () => {
      try {
        const d = await clientAPI.get<DonneesAdmin>(
          "/api/v1/admin/audit?page=1&limite=200",
          { authentifie: true }
        );
        const tous = d.donnees || [];
        setAllEvenements(tous);
        setEvenementsFiltres(tous);

        // Extraire les types uniques et trier
        const types = [...new Set(tous.map((e) => e.type_evenement))].sort();
        setTypesUniques(types);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, []);

  // Appliquer les filtres
  const appliquerFiltres = (
    donnees: EvenementAudit[],
    rech: string,
    filt: string,
    debut: string,
    fin: string
  ) => {
    let resultat = donnees;

    if (filt) {
      resultat = resultat.filter((e) => e.type_evenement === filt);
    }

    if (debut) {
      const timestampDebut = new Date(debut).getTime();
      resultat = resultat.filter((e) => new Date(e.date_evenement).getTime() >= timestampDebut);
    }
    if (fin) {
      const timestampFin = new Date(fin).getTime() + 86400000;
      resultat = resultat.filter((e) => new Date(e.date_evenement).getTime() <= timestampFin);
    }

    if (rech) {
      const r = rech.toLowerCase();
      resultat = resultat.filter(
        (e) =>
          e.type_evenement.toLowerCase().includes(r) ||
          e.description.toLowerCase().includes(r) ||
          (e.utilisateur_id && e.utilisateur_id.toLowerCase().includes(r)) ||
          (e.adresse_ip && e.adresse_ip.toLowerCase().includes(r))
      );
    }

    setEvenementsFiltres(resultat);
    setPage(1);
  };

  // Gestionnaires de changement de filtre
  const gererRecherche = (value: string) => {
    setRecherche(value);
    appliquerFiltres(allEvenements, value, filtre, dateDebut, dateFin);
  };

  const gererFiltre = (value: string) => {
    setFiltre(value);
    appliquerFiltres(allEvenements, recherche, value, dateDebut, dateFin);
  };

  const gererDateDebut = (value: string) => {
    setDateDebut(value);
    appliquerFiltres(allEvenements, recherche, filtre, value, dateFin);
  };

  const gererDateFin = (value: string) => {
    setDateFin(value);
    appliquerFiltres(allEvenements, recherche, filtre, dateDebut, value);
  };

  const reinitialiserFiltres = () => {
    setRecherche("");
    setFiltre("");
    setDateDebut("");
    setDateFin("");
    setPage(1);
    setEvenementsFiltres(allEvenements);
  };

  // Pagination
  const totalPages = Math.ceil(evenementsFiltres.length / ELEMENTS_PAR_PAGE);
  const debut = (page - 1) * ELEMENTS_PAR_PAGE;
  const fin = debut + ELEMENTS_PAR_PAGE;
  const evenementsPagines = evenementsFiltres.slice(debut, fin);

  const avezFiltres = recherche || filtre || dateDebut || dateFin;

  // Export CSV
  const gererExportCSV = async () => {
    const donneesAExporter = evenementsFiltres;

    const enTetes = ["ID", "Date", "Type", "Description", "Utilisateur", "IP", "Rôle"];
    const lignes = donneesAExporter.map((e) => [
      e.id,
      e.date_evenement,
      e.type_evenement,
      `"${e.description.replace(/"/g, '""')}"`,
      e.utilisateur_id || "",
      e.adresse_ip || "",
      e.role_acteur || "",
    ]);

    const csv = [
      enTetes.join(","),
      ...lignes.map((l) => l.join(",")),
    ].join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `digiid-audit-admin-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <header>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Espace administrateur
          </p>
          <h1 className="mt-1">Journal d'audit</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Toutes les actions sensibles du système. Conservation 1 an minimum.
            Journal immuable : aucune suppression ni modification autorisée.
          </p>
        </header>
        <div className="flex gap-2 flex-wrap">
          <Bouton variante="ghost" taille="petit" onClick={gererExportCSV}>
            Exporter en CSV
          </Bouton>
        </div>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      <Carte titre="Filtrage avancé">
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase text-ardoise-clair mb-2 font-semibold">
              Recherche textuelle
            </label>
            <ChampRecherche
              placeholder="Type d'événement, description, utilisateur, IP..."
              value={recherche}
              onChange={(e) => gererRecherche(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair mb-2 font-semibold">
                Type d'événement
              </label>
              <select
                value={filtre}
                onChange={(e) => gererFiltre(e.target.value)}
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
              <label className="block text-xs uppercase text-ardoise-clair mb-2 font-semibold">
                Du
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => gererDateDebut(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm bg-blanc focus:outline-none focus:border-lagune"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ardoise-clair mb-2 font-semibold">
                Au
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => gererDateFin(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm bg-blanc focus:outline-none focus:border-lagune"
              />
            </div>
          </div>

          {avezFiltres && (
            <div className="pt-2 text-right">
              <Bouton variante="ghost" taille="petit" onClick={reinitialiserFiltres}>
                ↻ Réinitialiser tous les filtres
              </Bouton>
            </div>
          )}
        </div>
      </Carte>

      <Carte>
        <div className="mb-6 pb-6 border-b border-ardoise-clair/10">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-sm text-ardoise-clair">
                <strong className="text-lagune">{evenementsFiltres.length}</strong> événement
                {evenementsFiltres.length > 1 ? "s" : ""} trouvé
                {evenementsFiltres.length > ELEMENTS_PAR_PAGE && (
                  <span className="ml-2 italic text-xs">
                    — Affichage {debut + 1} à {Math.min(fin, evenementsFiltres.length)} (Page {page}/{totalPages})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-12">
            Chargement des événements...
          </p>
        ) : evenementsPagines.length === 0 ? (
          <p className="text-center text-ardoise-clair italic py-12">
            {avezFiltres
              ? "Aucun événement ne correspond à tes critères de recherche."
              : "Aucun événement enregistré pour l'instant."}
          </p>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {evenementsPagines.map((e) => (
                <LigneEvenement key={e.id} evenement={e} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-ardoise-clair/10">
                <Bouton
                  variante="ghost"
                  taille="petit"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Précédent
                </Bouton>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum =
                    totalPages <= 5
                      ? i + 1
                      : page <= 3
                      ? i + 1
                      : page >= totalPages - 2
                      ? totalPages - 4 + i
                      : page - 2 + i;
                  return (
                    <Bouton
                      key={pageNum}
                      variante={page === pageNum ? "primaire" : "ghost"}
                      taille="petit"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Bouton>
                  );
                })}

                {totalPages > 5 && page < totalPages - 2 && (
                  <span className="text-ardoise-clair">...</span>
                )}

                <Bouton
                  variante="ghost"
                  taille="petit"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant →
                </Bouton>
              </div>
            )}
          </>
        )}
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
    evenement.donnees_supplementaires ||
    evenement.role_acteur;

  return (
    <div
      className={`border-l-4 border-ocre rounded-r-md pl-4 pr-3 py-3 transition-colors cursor-pointer ${
        deplie ? "bg-sable" : "bg-sable-clair hover:bg-sable"
      }`}
      onClick={() => setDeplie(!deplie)}
    >
      <div className="flex justify-between gap-4 items-start mb-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variante={variant} taille="petit">
            {typeNet}
          </Badge>
          <span className="text-xs text-ardoise-clair font-mono bg-blanc px-2 py-1 rounded border border-ardoise-clair/20">
            {evenement.id.substring(0, 8)}
          </span>
        </div>
        <time className="text-xs text-ardoise-clair whitespace-nowrap font-mono">
          {dateFormatee}
        </time>
      </div>

      <p className="text-sm text-ardoise mb-2 leading-relaxed">
        {evenement.description}
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        {evenement.utilisateur_id && (
          <span className="font-mono bg-blanc border border-ardoise-clair/20 px-2 py-1 rounded text-ardoise-clair flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-ardoise-clair">{evenement.utilisateur_id.substring(0, 8)}...</span>
          </span>
        )}
        {evenement.adresse_ip && (
          <span className="font-mono bg-blanc border border-ardoise-clair/20 px-2 py-1 rounded text-ardoise-clair">
            <strong>IP :</strong> {evenement.adresse_ip}
          </span>
        )}
        {evenement.role_acteur && (
          <span className="bg-blanc border border-ardoise-clair/20 px-2 py-1 rounded text-ardoise-clair">
            <strong>Rôle :</strong> {evenement.role_acteur}
          </span>
        )}
        {aDetails && (
          <span className="text-ocre text-xs ml-auto">
            {deplie ? "▲ Réduire" : "▼ Détails"}
          </span>
        )}
      </div>

      {deplie && aDetails && (
        <div className="mt-3 pt-3 border-t border-ardoise-clair/10 space-y-3">
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
