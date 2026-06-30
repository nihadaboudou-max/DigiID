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
import { IconeAlerte } from "@/composants/commun/Icones";
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
      charger();
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
      <div className="space-y-4">
        <header>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1 text-2xl">Monitoring en temps réel</h1>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-sable-clair/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Monitoring en temps réel</h1>
        <p className="text-ardoise-clair/70 text-sm mt-1 max-w-3xl">
          Supervisez tous les utilisateurs connectés en temps réel.
          <span className="block mt-0.5 text-xs text-ocre font-semibold">
            🔒 Toutes les actions sont tracées dans le journal d'audit.
          </span>
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {donnees && (
        <>
          {/* KPIs Temps réel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <CarteKPI libelle="Utilisateurs connectés" valeur={donnees.resume.utilisateurs_connectes} icone="🟢" couleur="succes" />
            <CarteKPI libelle="Sessions actives" valeur={donnees.resume.sessions_actives} icone="🔵" couleur="lagune" />
            <CarteKPI libelle="Admins connectés" valeur={donnees.resume.administrateurs_connectes} icone="🛡️" couleur="ocre" />
            <CarteKPI libelle="Connexions aujourd'hui" valeur={donnees.resume.connexions_aujourd_hui} icone="📈" couleur="lagune" />
          </div>

          {/* Alertes d'anomalies */}
          {(donnees.resume.utilisateurs_avec_sessions_multiples > 0 || donnees.resume.alerts_recents > 0) && (
            <div className="bg-terre/10 border border-terre/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <IconeAlerte className="w-4 h-4 text-terre flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-terre text-sm">⚠️ Actions recommandées</p>
                  <p className="text-xs text-terre/80 mt-0.5">
                    {donnees.resume.utilisateurs_avec_sessions_multiples > 0 && (
                      <>{donnees.resume.utilisateurs_avec_sessions_multiples} utilisateur(s) avec +5 sessions simultanées. </>
                    )}
                    {donnees.resume.alerts_recents > 0 && (
                      <>{donnees.resume.alerts_recents} alerte(s) de sécurité non résolue(s). </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase text-ardoise-clair font-semibold tracking-wider">
              Filtrer par rôle :
            </span>
            {["", "citoyen", "administrateur", "super_administrateur", "agent", "medecin", "police"].map(
              (role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFiltreRole(role)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Utilisateurs connectés avec contrôle */}
            <Carte
              titre="Utilisateurs connectés"
              description={`${utilisateursFiltres.length} en ligne`}
            >
              {utilisateursFiltres.length === 0 ? (
                <p className="text-sm text-ardoise-clair italic py-4 text-center">
                  Aucun utilisateur connecté
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                  {utilisateursFiltres.slice(0, 30).map((u) => {
                    const badgeVariant = u.role === "super_administrateur" ? "terre"
                      : u.role === "administrateur" ? "ocre"
                      : "lagune";
                    return (
                      <div
                        key={u.session_id}
                        className={`p-2.5 rounded-lg transition-colors ${
                          u.nb_sessions_actives > 5 ? "bg-terre/5 border border-terre/20" : "hover:bg-sable"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              u.est_active ? "bg-green-500 animate-pulse" : "bg-ardoise-clair/30"
                            }`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ardoise truncate">
                                {[u.prenom, u.nom].filter(Boolean).join(" ") || u.email}
                              </p>
                              <p className="text-[10px] text-ardoise-clair truncate">{u.email}</p>
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
                        <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-ardoise-clair/70 ml-5">
                          <span className="font-mono">{u.adresse_ip}</span>
                          {u.ville_estimee && <span>📍 {u.ville_estimee}</span>}
                          {u.agent_utilisateur && (
                            <span className="truncate max-w-[200px]">
                              💻 {u.agent_utilisateur.substring(0, 50)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {utilisateursFiltres.length > 30 && (
                    <p className="text-[10px] text-ardoise-clair text-center pt-1">
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
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                  {donnees.activites_recentes.map((a) => {
                    const type = a.type_evenement.toLowerCase();
                    const variant = type.includes("echou") || type.includes("err") ? "terre"
                      : type.includes("connexion") || type.includes("creation") ? "succes"
                      : "lagune";
                    return (
                      <div key={a.id} className="p-2 rounded-lg hover:bg-sable transition-colors border-l-4 border-lagune/30">
                        <div className="flex items-start gap-2">
                          <Badge variante={variant as any} taille="petit" className="flex-shrink-0 mt-0.5">
                            {a.type_evenement.replace(/_/g, " ")}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-ardoise leading-relaxed">{a.description}</p>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-ardoise-clair mt-0.5">
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
              <div className="space-y-2">
                {donnees.alertes.map((a) => {
                  const niveauColor = a.niveau === "critique" ? "terre"
                    : a.niveau === "elevee" ? "ocre"
                    : "lagune";
                  return (
                    <div key={a.id} className={`border-l-4 border-${niveauColor} bg-sable-clair rounded-r-lg p-3`}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variante={niveauColor as any} taille="petit">{a.type_incident}</Badge>
                        <span className={`text-[10px] font-bold ${
                          a.niveau === "critique" ? "text-terre" : a.niveau === "elevee" ? "text-ocre" : "text-lagune"
                        }`}>
                          {a.niveau.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-ardoise-clair ml-auto">
                          Risque: {a.score_risque}/100
                        </span>
                      </div>
                      <p className="text-sm text-ardoise">{a.description}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-ardoise-clair">
                        {a.email && <span>👤 {a.email}</span>}
                        {a.adresse_ip && <span className="font-mono">🌐 {a.adresse_ip}</span>}
                      </div>
                      {a.utilisateur_id && (
                        <div className="mt-2">
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Carte>
          )}

          {/* Horodatage */}
          <p className="text-[10px] text-ardoise-clair/50 text-right">
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
          <div className="space-y-3">
            <div className="bg-terre/10 border-l-4 border-terre p-2.5 rounded">
              <p className="text-sm text-terre font-semibold">Action sensible</p>
              <p className="text-xs text-terre/80 mt-0.5">
                L'utilisateur sera immédiatement déconnecté de tous ses appareils.
                Cette action est tracée dans le journal d'audit.
              </p>
            </div>
            <div className="space-y-1.5 bg-sable rounded-lg p-2.5">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <span className="text-ardoise-clair">Utilisateur:</span>
                <span className="text-ardoise font-medium">
                  {[deconnexionModal.utilisateur.prenom, deconnexionModal.utilisateur.nom].filter(Boolean).join(" ") || deconnexionModal.utilisateur.email}
                </span>
                <span className="text-ardoise-clair">Email:</span>
                <span className="text-ardoise truncate">{deconnexionModal.utilisateur.email}</span>
                <span className="text-ardoise-clair">Rôle:</span>
                <span className="text-ardoise">{deconnexionModal.utilisateur.role}</span>
                <span className="text-ardoise-clair">Sessions actives:</span>
                <span className="text-ardoise">{deconnexionModal.utilisateur.nb_sessions_actives}</span>
                <span className="text-ardoise-clair">IP:</span>
                <span className="text-ardoise font-mono text-[10px]">{deconnexionModal.utilisateur.adresse_ip}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-ardoise-clair/10">
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
      <div className="flex gap-2 flex-wrap pt-3 border-t border-ardoise-clair/10">
        <Link href="/super-admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Dashboard</Bouton>
        </Link>
        <Link href="/super-admin/audit">
          <Bouton variante="secondaire" taille="petit">📋 Journal d'audit</Bouton>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

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
  const couleursBordure: Record<string, string> = {
    lagune: "border-lagune/30",
    ocre: "border-ocre/30",
    terre: "border-terre/30",
    succes: "border-green-400/30",
  };
  return (
    <div className={`carte border-l-4 ${couleursBordure[couleur]} p-3 hover:shadow-doux transition-shadow`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] uppercase text-ardoise-clair/60 font-semibold tracking-wider">
          {libelle}
        </p>
        <span className="text-base">{icone}</span>
      </div>
      <p className={`text-xl md:text-2xl font-bold ${couleursTexte[couleur]}`}>{valeur}</p>
    </div>
  );
}