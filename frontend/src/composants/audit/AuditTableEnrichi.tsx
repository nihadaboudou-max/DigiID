"use client";

/**
 * Composant d'audit enrichi pour les chefs de département.
 * Affiche qui a fait quoi, à quelle heure précise, avec appareil, localisation, etc.
 */
import { useState, useMemo } from "react";
import clsx from "clsx";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";

// ─── Types enrichis ──────────────────────────────────────────────

export interface AuditLogEnrichi {
  id: string;
  date_evenement: string;
  /** Temps relatif affiché (ex: "il y a 12 min") */
  temps_relatif: string;
  /** Date formatée avec secondes */
  date_formatee: string;
  agent_nom: string;
  agent_role: string;
  /** Statut du compte agent au moment (actif / suspendu) */
  agent_statut: "actif" | "suspendu" | "inactif";
  type_evenement: string;
  type_libelle: string;
  description: string;
  adresse_ip: string | null;
  /** User-Agent (navigateur / appareil) */
  agent_utilisateur: string | null;
  /** Ville approximative déduite de l'IP */
  localisation: string | null;
  /** ID de session si connexion */
  session_id: string | null;
  /** Niveau de criticité */
  criticite: "info" | "avertissement" | "critique";
  /** Durée estimée de l'action (secondes) */
  duree_action: number | null;
  donnees_supplementaires: Record<string, unknown> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Types d'événements avec leur libellé, catégorie et criticité */
const CATALOGUE_EVENEMENTS: Record<string, { libelle: string; categorie: string; criticite: "info" | "avertissement" | "critique" }> = {
  // Authentification
  "connexion_reussie": { libelle: "Connexion réussie", categorie: "authentification", criticite: "info" },
  "connexion_echouee": { libelle: "Échec de connexion", categorie: "authentification", criticite: "avertissement" },
  "deconnexion": { libelle: "Déconnexion", categorie: "authentification", criticite: "info" },
  
  // Profil & Données
  "consultation_profil": { libelle: "Consultation de profil", categorie: "donnees", criticite: "info" },
  "modification_profil": { libelle: "Modification de profil", categorie: "donnees", criticite: "avertissement" },
  "export_donnees": { libelle: "Export de données", categorie: "donnees", criticite: "critique" },
  
  // Actions Police
  "police_verification_identite": { libelle: "Vérification d'identité", categorie: "police", criticite: "info" },
  "police_recherche_personne": { libelle: "Recherche de personne", categorie: "police", criticite: "info" },
  "police_signalement_fraude": { libelle: "Signalement de fraude", categorie: "police", criticite: "critique" },
  "police_comparaison_photo": { libelle: "Comparaison photo", categorie: "police", criticite: "info" },
  "police_scan_qr": { libelle: "Scan QR Code", categorie: "police", criticite: "info" },

  // Actions Médicales
  "consultation_dossier": { libelle: "Consultation dossier patient", categorie: "medical", criticite: "avertissement" },
  "creation_ordonnance": { libelle: "Création d'ordonnance", categorie: "medical", criticite: "info" },
  "medical_recherche_patient": { libelle: "Recherche patient", categorie: "medical", criticite: "info" },
  "modification_dossier": { libelle: "Modification dossier", categorie: "medical", criticite: "critique" },
  "creation_dossier": { libelle: "Création dossier patient", categorie: "medical", criticite: "avertissement" },

  // Actions ONG
  "ong_beneficiaire_creation": { libelle: "Création bénéficiaire", categorie: "ong", criticite: "info" },
  "ong_programme_creation": { libelle: "Création programme", categorie: "ong", criticite: "avertissement" },
  "ong_mission_creation": { libelle: "Création mission", categorie: "ong", criticite: "info" },
  "ong_attestation_creation": { libelle: "Création attestation", categorie: "ong", criticite: "info" },
  
  // Actions Enrôlement
  "enrolement_creation": { libelle: "Création enrôlement", categorie: "enrolement", criticite: "info" },
  "enrolement_scan_cni": { libelle: "Scan CNI", categorie: "enrolement", criticite: "info" },
  "enrolement_capture_biometrique": { libelle: "Capture biométrique", categorie: "enrolement", criticite: "avertissement" },
  
  // Gestion agents
  "suspension_agent": { libelle: "Suspension d'agent", categorie: "gestion", criticite: "critique" },
  "reactivation_agent": { libelle: "Réactivation d'agent", categorie: "gestion", criticite: "avertissement" },
  "suppression_agent": { libelle: "Suppression d'agent", categorie: "gestion", criticite: "critique" },
  "creation_agent": { libelle: "Création d'agent", categorie: "gestion", criticite: "avertissement" },
  
  // Invitations
  "invitation_envoyee": { libelle: "Invitation envoyée", categorie: "invitation", criticite: "info" },
  "invitation_acceptee": { libelle: "Invitation acceptée", categorie: "invitation", criticite: "info" },
  "invitation_annulee": { libelle: "Invitation annulée", categorie: "invitation", criticite: "avertissement" },
};

/**
 * Calcule le temps relatif (il y a X minutes/heures)
 */
function calculerTempsRelatif(dateISO: string): string {
  if (!dateISO) return "";
  const maintenant = Date.now();
  const date = new Date(dateISO).getTime();
  const diffMs = maintenant - date;
  if (diffMs < 0) return "à l'instant";
  
  const secondes = Math.floor(diffMs / 1000);
  if (secondes < 60) return `il y a ${secondes} s`;
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 30) return `il y a ${jours} j`;
  const mois = Math.floor(jours / 30);
  return `il y a ${mois} mois`;
}

/**
 * Formate une date avec secondes
 */
function formaterDateAvecSecondes(dateISO: string): string {
  if (!dateISO) return "-";
  return new Date(dateISO).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Extrait l'appareil/navigateur depuis un user-agent
 */
function formaterAppareil(userAgent: string | null): { nom: string; icone: string } {
  if (!userAgent) return { nom: "Inconnu", icone: "❓" };
  
  if (userAgent.includes("Mobile") || userAgent.includes("Android")) {
    if (userAgent.includes("iPhone") || userAgent.includes("iOS")) return { nom: "iPhone", icone: "📱" };
    if (userAgent.includes("Samsung")) return { nom: "Samsung", icone: "📱" };
    return { nom: "Mobile", icone: "📱" };
  }
  if (userAgent.includes("Windows")) return { nom: "Windows", icone: "💻" };
  if (userAgent.includes("Mac OS")) return { nom: "Mac", icone: "💻" };
  if (userAgent.includes("Linux")) return { nom: "Linux", icone: "🐧" };
  if (userAgent.includes("Chrome")) return { nom: "Chrome", icone: "🌐" };
  if (userAgent.includes("Firefox")) return { nom: "Firefox", icone: "🦊" };
  if (userAgent.includes("Safari")) return { nom: "Safari", icone: "🧭" };
  
  return { nom: userAgent.substring(0, 30), icone: "🖥️" };
}

/**
 * Arrondit une durée en secondes en format lisible
 */
function formaterDuree(secondes: number | null): string {
  if (!secondes) return "-";
  if (secondes < 60) return `${secondes} s`;
  const min = Math.floor(secondes / 60);
  const sec = secondes % 60;
  return `${min} min ${sec} s`;
}

// ─── Composant principal ─────────────────────────────────────────

interface AuditTableEnrichiProps {
  logs: AuditLogEnrichi[];
  total: number;
  chargement: boolean;
  erreur: string | null;
  /** Couleur d'accent (lagune, terre, ocre) */
  accentCouleur?: string;
  /** Titre de la section */
  titre?: string;
  /** Sous-titre */
  sousTitre?: string;
  /** Filtres personnalisés (optionnel) */
  filtres?: React.ReactNode;
  /** Bouton de réinitialisation des filtres */
  onResetFiltres?: () => void;
  /** Pagination */
  page: number;
  totalPages: number;
  surPageSuivante: () => void;
  surPagePrecedente: () => void;
}

export function AuditTableEnrichi({
  logs,
  total,
  chargement,
  erreur,
  accentCouleur = "text-terre",
  titre = "Journal d'Audit de l'Équipe",
  sousTitre = "Historique complet : qui, quoi, quand, où, comment — en temps réel.",
  filtres,
  onResetFiltres,
  page,
  totalPages,
  surPageSuivante,
  surPagePrecedente,
}: AuditTableEnrichiProps) {
  const [agentEtendu, setAgentEtendu] = useState<string | null>(null);

  /** Vue détaillée d'une ligne */
  const toggleEtendre = (id: string) => {
    setAgentEtendu(agentEtendu === id ? null : id);
  };

  return (
    <div className="space-y-6 apparition pb-20">
      {/* En-tête */}
      <div>
        <p className={clsx("font-semibold text-sm uppercase tracking-wider", accentCouleur)}>
          🛡️ Supervision & Audite
        </p>
        <h1 className="text-2xl font-bold text-ardoise">{titre}</h1>
        <p className="text-ardoise-clair mt-1 text-sm">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Filtres */}
      {filtres && (
        <Carte titre="🔍 Filtrer les activités">
          {filtres}
          {onResetFiltres && (
            <div className="mt-3 flex justify-end">
              <Bouton variante="ghost" taille="petit" onClick={onResetFiltres}>
                🔄 Réinitialiser les filtres
              </Bouton>
            </div>
          )}
        </Carte>
      )}

      {/* Résumé statistiques */}
      {!chargement && logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border border-ardoise-clair/10 shadow-sm">
            <p className="text-2xl font-bold text-ardoise">{total}</p>
            <p className="text-xs text-ardoise-clair uppercase mt-1">Événements</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-ardoise-clair/10 shadow-sm">
            <p className="text-2xl font-bold text-lagune">
              {logs.filter(l => l.criticite === "critique").length}
            </p>
            <p className="text-xs text-ardoise-clair uppercase mt-1">Critiques</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-ardoise-clair/10 shadow-sm">
            <p className="text-2xl font-bold text-ocre">
              {logs.filter(l => l.criticite === "avertissement").length}
            </p>
            <p className="text-xs text-ardoise-clair uppercase mt-1">Avertissements</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-ardoise-clair/10 shadow-sm">
            <p className="text-2xl font-bold text-succes">
              {logs.filter(l => l.criticite === "info").length}
            </p>
            <p className="text-xs text-ardoise-clair uppercase mt-1">Informations</p>
          </div>
        </div>
      )}

      {/* Tableau */}
      <Carte titre={`📋 Activités récentes (${total} au total)`}>
        {chargement ? (
          <div className="text-center py-12">
            <div className={clsx("animate-spin w-10 h-10 border-4 border-t-transparent rounded-full mx-auto mb-4", accentCouleur.replace("text-", "border-"))}></div>
            <p className="text-ardoise-clair">Chargement du journal d'audit...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-ardoise-clair italic">Aucune activité trouvée pour ces critères.</p>
            {onResetFiltres && (
              <Bouton variante="ghost" taille="petit" onClick={onResetFiltres} className="mt-4">
                🔄 Réinitialiser
              </Bouton>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-sable text-ardoise-clair">
                <tr>
                  <th className="px-3 py-3 rounded-tl-lg w-24">Heure</th>
                  <th className="px-3 py-3">⏱️</th>
                  <th className="px-3 py-3">Agent</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3 hidden md:table-cell">Détails</th>
                  <th className="px-3 py-3 hidden lg:table-cell">Appareil</th>
                  <th className="px-3 py-3 hidden lg:table-cell">📍</th>
                  <th className="px-3 py-3 rounded-tr-lg">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const appareil = formaterAppareil(log.agent_utilisateur);
                  const estEtendu = agentEtendu === log.id;

                  return (
                    <tr
                      key={log.id}
                      className={clsx(
                        "border-b border-ardoise-clair/10 transition-all duration-150 cursor-pointer",
                        log.criticite === "critique" ? "bg-terre/5 hover:bg-terre/10" : "hover:bg-sable/50",
                      )}
                      onClick={() => toggleEtendre(log.id)}
                    >
                      {/* Heure précise */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-semibold text-ardoise">
                            {log.date_formatee.split(" ")[1] || log.date_formatee}
                          </span>
                          <span className="text-[10px] text-ardoise-clair/60 font-mono">
                            {log.date_formatee.split(" ")[0]}
                          </span>
                        </div>
                      </td>

                      {/* Temps relatif + Durée */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start">
                          <span className={clsx(
                            "text-xs font-semibold px-1.5 py-0.5 rounded",
                            log.temps_relatif.includes("min") || log.temps_relatif.includes("s")
                              ? "bg-lagune/10 text-lagune"
                              : log.temps_relatif.includes("h")
                                ? "bg-ocre/10 text-ocre"
                                : "bg-ardoise-clair/10 text-ardoise-clair"
                          )}>
                            {log.temps_relatif}
                          </span>
                          {log.duree_action !== null && (
                            <span className="text-[10px] text-ardoise-clair/60 mt-0.5 font-mono">
                              durée: {formaterDuree(log.duree_action)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Agent */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0",
                            log.agent_statut === "suspendu" ? "bg-terre" : accentCouleur.replace("text-", "bg-"),
                          )}>
                            {log.agent_nom.split(" ").map(m => m[0]).join("").substring(0, 2).toUpperCase() || "?"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-ardoise text-sm">{log.agent_nom}</span>
                              {log.agent_statut === "suspendu" && (
                                <span className="text-[10px] text-terre font-bold">🔴 SUSPENDU</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-ardoise-clair capitalize">
                                {log.agent_role.replace(/_/g, " ")}
                              </span>
                              {estEtendu && log.session_id && (
                                <span className="text-[10px] text-ardoise-clair/50 font-mono">
                                  session: {log.session_id.substring(0, 8)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3">
                        <Badge
                          variante={
                            log.criticite === "critique" ? "terre" :
                            log.criticite === "avertissement" ? "ocre" : "lagune"
                          }
                          taille="petit"
                        >
                          {log.type_libelle}
                        </Badge>
                        {estEtendu && log.description && (
                          <p className="text-xs text-ardoise-clair mt-2 max-w-xs leading-relaxed">
                            {log.description}
                          </p>
                        )}
                      </td>

                      {/* Détails (description) */}
                      <td className="px-3 py-3 max-w-[200px] hidden md:table-cell">
                        <p className="text-xs text-ardoise-clair truncate" title={log.description}>
                          {log.description || "-"}
                        </p>
                      </td>

                      {/* Appareil */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5" title={log.agent_utilisateur || ""}>
                          <span>{appareil.icone}</span>
                          <span className="text-xs text-ardoise-clair">{appareil.nom}</span>
                        </div>
                      </td>

                      {/* Localisation */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-ardoise-clair">
                          {log.localisation || "-"}
                        </span>
                      </td>

                      {/* IP */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-ardoise-clair bg-sable-clair px-1.5 py-0.5 rounded">
                          {log.adresse_ip || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!chargement && logs.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-ardoise-clair/10">
            <p className="text-xs text-ardoise-clair">
              Page {page} sur {totalPages || 1} · {total} événements
            </p>
            <div className="flex gap-2">
              <Bouton
                variante="ghost"
                taille="petit"
                disabled={page === 1}
                onClick={surPagePrecedente}
              >
                ← Précédent
              </Bouton>
              <Bouton
                variante="ghost"
                taille="petit"
                disabled={page >= totalPages}
                onClick={surPageSuivante}
              >
                Suivant →
              </Bouton>
            </div>
          </div>
        )}
      </Carte>

      {/* Indicateurs visuels */}
      {!chargement && logs.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-ardoise-clair/60 pt-2 border-t border-ardoise-clair/5">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-lagune"></span> Info
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-ocre"></span> Avertissement
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-terre"></span> Critique
          </span>
          <span className="flex items-center gap-1">
            💡 Cliquez sur une ligne pour voir les détails
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Fonction de transformation ──────────────────────────────────

/**
 * Transforme les logs bruts de l'API en logs enrichis pour l'affichage
 */
export function enrichirLogs(logs: any[]): AuditLogEnrichi[] {
  return logs.map((log) => {
    const infoEvenement = CATALOGUE_EVENEMENTS[log.type_evenement] || {
      libelle: log.type_evenement.replace(/_/g, " "),
      categorie: "autre",
      criticite: "info" as const,
    };

    // Extraire données supplémentaires
    const supp = log.donnees_supplementaires || {};

    return {
      id: log.id,
      date_evenement: log.date_evenement,
      temps_relatif: calculerTempsRelatif(log.date_evenement),
      date_formatee: formaterDateAvecSecondes(log.date_evenement),
      agent_nom: log.agent_nom || "Agent Inconnu",
      agent_role: log.agent_role || "inconnu",
      agent_statut: (supp as any).agent_statut || "actif",
      type_evenement: log.type_evenement,
      type_libelle: infoEvenement.libelle,
      description: log.description || "",
      adresse_ip: log.adresse_ip || null,
      agent_utilisateur: (supp as any).agent_utilisateur || (supp as any).user_agent || null,
      localisation: (supp as any).ville || (supp as any).localisation || null,
      session_id: (supp as any).session_id || null,
      criticite: infoEvenement.criticite,
      duree_action: (supp as any).duree_secondes || null,
      donnees_supplementaires: supp,
    };
  });
}

/**
 * Hook pour gérer l'état de l'audit enrichi
 */
export function useAuditEnrichi() {
  const [logs, setLogs] = useState<AuditLogEnrichi[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAR_PAGE = 50;

  const totalPages = Math.ceil(total / PAR_PAGE);

  async function chargerAudit(
    fetchFn: (params: any) => Promise<{ logs: any[]; total: number }>,
    params: Record<string, any> = {}
  ) {
    setChargement(true);
    setErreur(null);
    try {
      const data = await fetchFn({ ...params, page, par_page: PAR_PAGE });
      setLogs(enrichirLogs(data.logs));
      setTotal(data.total);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement de l'audit");
    } finally {
      setChargement(false);
    }
  }

  return {
    logs,
    total,
    chargement,
    erreur,
    page,
    totalPages,
    setPage,
    chargerAudit,
    PAR_PAGE,
  };
}
