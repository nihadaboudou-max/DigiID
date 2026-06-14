"use client";

/**
 * Page Super Admin — Monitoring en temps réel avec contrôle utilisateur.
 *
 * Permet au super admin de :
 *   - Voir le tableau de bord temps réel complet
 *   - Lister tous les utilisateurs connectés (emails en clair)
 *   - Forcer la déconnexion d'un utilisateur en temps réel
 *   - Consulter le flux d'activités avec tous les détails
 *   - Gérer les alertes de sécurité
 *   - Filtrer par rôle (admin, citoyen, etc.)
 *
 * Sécurité :
 *   - Actions tracées dans l'audit
 *   - Confirmation avant déconnexion forcée
 *   - Rafraîchissement automatique toutes les 10 secondes
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { useNotifications } from "@/contextes/notifications";
import {
  IconeUtilisateur, IconeBouclier, IconeAlerte, IconeStatistique,
} from "@/composants/commun/Icones";
import { clientAPI, ErreurAPI } from "@/services/client_api";

// ============================================================================
// TYPES
// ============================================================================

interface ResumeMonitoring {
  utilisateurs_connectes: number;
  sessions_actives: number;
  connexions_aujourd_hui: number;
  administrateurs_connectes: number;
  utilisateurs_avec_sessions_multiples: number;
  alerts_recents: number;
  timestamp: string;
}

interface UtilisateurConnecte {
  utilisateur_id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  role: string;
  session_id: string;
  adresse_ip: string;
  agent_utilisateur: string | null;
  ville_estimee: string | null;
  pays_estime: string | null;
  connexion_le: string;
  derniere_activite: string;
  expire_le: string;
  est_active: boolean;
  nb_sessions_actives: number;
}

interface ActiviteRecente {
  id: string;
  type_evenement: string;
  description: string;
  utilisateur_id: string | null;
  email: string | null;
  role: string | null;
  adresse_ip: string | null;
  date_evenement: string;
}

interface AlerteSecuriteItem {
  id: string;
  type_incident: string;
  niveau: string;
  description: string;
  utilisateur_id: string | null;
  email: string | null;
  adresse_ip: string | null;
  score_risque: number;
  date_detection: string;
  resolue: boolean;
}

interface MonitoringComplet {
  resume: ResumeMonitoring;
  utilisateurs_connectes: UtilisateurConnecte[];
  activites_recentes: ActiviteRecente[];
  alertes: AlerteSecuriteItem[];
}

// ============================================================================
// PAGE PRINCIPALE
// ============================================================================

export default function PageMonitoringSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [donnees, setDonnees] = useState<MonitoringComplet | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreRole, setFiltreRole] = useState<string>("");
  const [deconnexionModal, setDeconnexionModal] = useState<{
    utilisateur: UtilisateurConnecte;
  } | null>(null);
  const [actionChargement, setActionChargement] = useState(false);
  const [actif, setActif] = useState(true);

  const charger = useCallback(async () => {
    try {
      const d = await clientAPI.get<MonitoringComplet>(
        "/api/v1/super-admin/monitoring/complet",
        { authentifie: true }
      );
      if (actif) {
        setDonnees(d);
        setErreur(null);
      }
    } catch (e) {
      if (actif) {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
      }
    } finally {
      if (actif) setChargement(false);
    }
  }, [actif]);

  useEffect(() => {
    charger();
    const intervalle = setInterval(charger, 10000);
    return () => {
      setActif(false);
      clearInterval(intervalle);
    };
  }, [charger]);

  // Filtrer les utilisateurs connectés par rôle
  const utilisateursFiltres = donnees?.utilisateurs_connectes.filter((u) => {
    if (!filtreRole) return true;
    return u.role === filtreRole;
  }) || [];

  // Forcer la déconnexion
  const forcerDeconnexion = async (utilisateurId: string, raison: string) => {
    setActionChargement(true);
    try {
      const resultat = await clientAPI.post<{
        succes: boolean; message: string; sessions_revoquees: number;
      }>(
        `/api/v1/super-admin/monitoring/utilisateurs/${utilisateurId}/deconnecter?raison=${encodeURIComponent(raison)}`,
        undefined,
        { authentifie: true }
      );
      notifier(`✅ ${resultat.message}`, "succes");
      setDeconnexionModal(null);
      charger(); // Recharger immédiatement
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la déconnexion",
        "erreur"
      );
    } finally {
      setActionChargement(false);
    }
  };

  if (chargement) {
    return (
      <div className="space-y-6 apparition">
        <EnTetePage />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-sable-clair/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/super-admin" className="hover:text-lagune">Dashboard</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Monitoring temps réel</span>
      </nav>

      <EnTetePage />

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {donnees && (
        <>
          {/* KPIs Temps réel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CarteKPI libelle="Utilisateurs connectés" valeur={donnees.resume.utilisateurs_connectes} icone="🟢" couleur="succes" />
            <CarteKPI libelle="Sessions actives" valeur={donnees.resume.sessions_actives} icone="🔵" couleur="lagune" />
            <CarteKPI libelle="Admins connectés" valeur={donnees.resume.administrateurs_connectes} icone="🛡️" couleur="ocre" />
            <CarteKPI libelle="Connexions aujourd'hui" valeur={donnees.resume.connexions_aujourd_hui} icone="📈" couleur="lagune" />
          </div>

          {/* Alertes d'anomalies */}
          {(donnees.resume.utilisateurs_avec_sessions_multiples > 0 || donnees.resume.alerts_recents > 0) && (
            <div className="bg-terre/10 border border-terre/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <IconeAlerte className="w-5 h-5 text-terre" />
                <div>
                  <p className="font-semibold text-terre">⚠️ Actions recommandées</p>
                  <p className="text-sm text-terre/80 mt-1">
                    {donnees.resume.utilisateurs_avec_sessions_multiples > 0 && (
                      <>{donnees.resume.utilisateurs_avec_sessions_multiples} utilisateur(s) ont plus de 5 sessions simultanées (suspicion de partage de compte). </>
                    )}
                    {donnees.resume.alerts_recents > 0 && (
                      <>{donnees.resume.alerts_recents} alerte(s) de sécurité non résolue(s). </>
                    )}
                    Utilisez les actions ci-dessous pour investiguer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider">
              Filtrer par rôle :
            </span>
            {["", "citoyen", "administrateur", "super_administrateur", "agent", "medecin", "police"].map(
              (role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFiltreRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filtreRole === role
                      ? "bg-lagune text-white"
                      : "bg-white border border-ardoise-clair/20 text-ardoise hover:bg-sable"
                  }`}
                >
                  {role || "Tous"}
                </button>
              )
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Utilisateurs connectés avec contrôle */}
            <Carte
              titre="Utilisateurs connectés"
              description={`${utilisateursFiltres.length} en ligne — cliquez sur "Déconnecter" pour forcer la déconnexion`}
            >
              {utilisateursFiltres.length === 0 ? (
                <p className="text-sm text-ardoise-clair italic py-4 text-center">
                  Aucun utilisateur connecté
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {utilisateursFiltres.slice(0, 30).map((u) => {
                    const badgeVariant = u.role === "super_administrateur" ? "terre"
                      : u.role === "administrateur" ? "ocre"
                      : "lagune";
                    return (
                      <div
                        key={u.session_id}
                        className={`p-3 rounded-lg transition-colors ${
                          u.nb_sessions_actives > 5 ? "bg-terre/5 border border-terre/20" : "hover:bg-sable"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              u.est_active ? "bg-green-500 animate-pulse" : "bg-ardoise-clair/30"
                            }`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ardoise truncate">
                                {[u.prenom, u.nom].filter(Boolean).join(" ") || u.email}
                              </p>
                              <p className="text-[11px] text-ardoise-clair truncate">{u.email}</p>
                            </div>
                            <Badge variante={badgeVariant as any} taille="petit">{u.role}</Badge>
                            {u.nb_sessions_actives > 1 && (
                              <Badge variante="terre" taille="petit">{u.nb_sessions_actives} sessions</Badge>
                            )}
                          </div>
                          <Bouton
                            variante="danger"
                            taille="petit"
                            onClick={() => setDeconnexionModal({ utilisateur: u })}
                          >
                            Déconnecter
                          </Bouton>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-ardoise-clair/70 ml-6">
                          <span className="font-mono">{u.adresse_ip}</span>
                          {u.ville_estimee && <span>📍 {u.ville_estimee}</span>}
                          {u.agent_utilisateur && (
                            <span className="truncate max-w-[200px]">
                              💻 {u.agent_utilisateur.substring(0, 60)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {utilisateursFiltres.length > 30 && (
                    <p className="text-xs text-ardoise-clair text-center pt-2">
                      +{utilisateursFiltres.length - 30} autre(s) — utilisez le filtre pour réduire
                    </p>
                  )}
                </div>
              )}
            </Carte>

            {/* Activités récentes */}
            <Carte titre="Flux d'activités en direct" description="Toutes les actions récentes du système">
              {donnees.activites_recentes.length === 0 ? (
                <p className="text-sm text-ardoise-clair italic py-4 text-center">
                  Aucune activité récente
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {donnees.activites_recentes.map((a) => {
                    const type = a.type_evenement.toLowerCase();
                    const variant = type.includes("echou") || type.includes("err") ? "terre"
                      : type.includes("connexion") || type.includes("creation") ? "succes"
                      : "lagune";
                    return (
                      <div key={a.id} className="p-2.5 rounded-lg hover:bg-sable transition-colors border-l-4 border-lagune/30">
                        <div className="flex items-start gap-2">
                          <Badge variante={variant as any} taille="petit" className="flex-shrink-0 mt-0.5">
                            {a.type_evenement.replace(/_/g, " ")}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-ardoise leading-relaxed">{a.description}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ardoise-clair mt-1">
                              {a.email && <span>👤 {a.email}</span>}
                              {a.role && <Badge variante="neutre" taille="petit">{a.role}</Badge>}
                              {a.adresse_ip && <span className="font-mono">🌐 {a.adresse_ip}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Carte>
          </div>

          {/* Alertes de sécurité */}
          {donnees.alertes.length > 0 && (
            <Carte
              titre="Alertes de sécurité"
              description={`${donnees.alertes.length} incident(s) détecté(s)`}
            >
              <div className="space-y-3">
                {donnees.alertes.map((a) => {
                  const niveauColor = a.niveau === "critique" ? "terre"
                    : a.niveau === "elevee" ? "ocre"
                    : "lagune";
                  return (
                    <div key={a.id} className={`border-l-4 border-${niveauColor} bg-sable-clair rounded-r-lg p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variante={niveauColor as any}>{a.type_incident}</Badge>
                        <span className={`text-xs font-bold ${
                          a.niveau === "critique" ? "text-terre" : a.niveau === "elevee" ? "text-ocre" : "text-lagune"
                        }`}>
                          {a.niveau.toUpperCase()}
                        </span>
                        <span className="text-xs text-ardoise-clair ml-auto">
                          Risque: {a.score_risque}/100
                        </span>
                      </div>
                      <p className="text-sm text-ardoise">{a.description}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-ardoise-clair">
                        {a.email && <span>👤 {a.email}</span>}
                        {a.adresse_ip && <span className="font-mono">🌐 {a.adresse_ip}</span>}
                      </div>
                      <div className="flex gap-2 mt-3">
                        {a.utilisateur_id && (
                          <Bouton
                            variante="danger"
                            taille="petit"
                            onClick={async () => {
                              try {
                                await clientAPI.post(
                                  `/api/v1/super-admin/monitoring/utilisateurs/${a.utilisateur_id}/deconnecter?raison=Compte+compromis+alerte+securite`,
                                  undefined,
                                  { authentifie: true }
                                );
                                notifier("✅ Utilisateur déconnecté", "succes");
                                charger();
                              } catch (e) {
                                notifier("Erreur lors de la déconnexion", "erreur");
                              }
                            }}
                          >
                            🔒 Déconnecter cet utilisateur
                          </Bouton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Carte>
          )}

          {/* Horodatage */}
          <p className="text-xs text-ardoise-clair/50 text-right">
            Dernière mise à jour : {new Date(donnees.resume.timestamp).toLocaleTimeString("fr-FR")}
            — Rafraîchissement automatique toutes les 10 secondes
          </p>
        </>
      )}

      {/* Modal de déconnexion forcée */}
      {deconnexionModal && (
        <Modal
          ouvert={true}
          surFermeture={() => setDeconnexionModal(null)}
          titre="Forcer la déconnexion"
          description={`Déconnecter ${deconnexionModal.utilisateur.email} de toutes ses sessions`}
        >
          <div className="space-y-4">
            <div className="bg-terre/10 border-l-4 border-terre p-3 rounded">
              <p className="text-sm text-terre font-semibold">Action sensible</p>
              <p className="text-xs text-terre/80 mt-1">
                L'utilisateur sera immédiatement déconnecté de tous ses appareils.
                Cette action est tracée dans le journal d'audit.
              </p>
            </div>
            <div className="space-y-2 bg-sable rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-ardoise-clair">Utilisateur:</span>
                <span className="text-ardoise font-medium">
                  {[deconnexionModal.utilisateur.prenom, deconnexionModal.utilisateur.nom].filter(Boolean).join(" ") || deconnexionModal.utilisateur.email}
                </span>
                <span className="text-ardoise-clair">Email:</span>
                <span className="text-ardoise">{deconnexionModal.utilisateur.email}</span>
                <span className="text-ardoise-clair">Rôle:</span>
                <span className="text-ardoise">{deconnexionModal.utilisateur.role}</span>
                <span className="text-ardoise-clair">Sessions actives:</span>
                <span className="text-ardoise">{deconnexionModal.utilisateur.nb_sessions_actives}</span>
                <span className="text-ardoise-clair">IP:</span>
                <span className="text-ardoise font-mono text-xs">{deconnexionModal.utilisateur.adresse_ip}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setDeconnexionModal(null)}>
                Annuler
              </Bouton>
                            <Bouton
                variante="danger"
                chargement={actionChargement}
                onClick={() => forcerDeconnexion(
                  deconnexionModal.utilisateur.utilisateur_id,
                  "Déconnexion forcée par super admin via monitoring temps réel"
                )}
              >
                Confirmer la déconnexion
              </Bouton>
            </div>
          </div>
        </Modal>
      )}

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/super-admin">
          <Bouton variante="ghost" taille="petit">← Dashboard</Bouton>
        </Link>
        <Link href="/super-admin/audit">
          <Bouton variante="secondaire" taille="petit">📋 Journal d'audit</Bouton>
        </Link>
        <Link href="/admin/alertes">
          <Bouton variante="ghost" taille="petit"><IconeAlerte className="w-3.5 h-3.5 mr-1" /> Alertes</Bouton>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

function EnTetePage() {
  return (
    <div className="section-header">
      <p className="text-ocre">Super administration</p>
      <h1>Monitoring en temps réel</h1>
      <p className="text-ardoise-clair/70 text-sm mt-1">
        Supervisez et contrôlez tous les utilisateurs connectés en temps réel.
        Actions disponibles : forcer la déconnexion, filtrer par rôle,
        consulter les activités et alertes de sécurité.
        <span className="block mt-1 text-xs text-ocre font-semibold">
          🔒 Toutes les actions sont tracées dans le journal d'audit.
        </span>
      </p>
    </div>
  );
}

function CarteKPI({ libelle, valeur, icone, couleur }: {
  libelle: string; valeur: number; icone: string;
  couleur: "lagune" | "ocre" | "terre" | "succes";
}) {
  const couleursTexte: Record<string, string> = {
    lagune: "text-lagune",
    ocre: "text-ocre",
    terre: "text-terre",
    succes: "text-green-600",
  };
  return (
    <div className={`carte-${couleur} hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs uppercase text-ardoise-clair/60 font-semibold tracking-wider">
          {libelle}
        </p>
        <span className="text-lg">{icone}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${couleursTexte[couleur]}`}>{valeur}</p>
    </div>
  );
}
