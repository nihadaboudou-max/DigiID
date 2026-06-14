"use client";

/**
 * Page Admin — Monitoring en temps réel des utilisateurs connectés.
 *
 * Permet à l'administrateur de :
 *   - Voir le nombre d'utilisateurs connectés en temps réel
 *   - Lister les utilisateurs actuellement connectés (emails masqués)
 *   - Consulter le flux d'activités récentes
 *   - Visualiser les alertes de sécurité
 *
 * Sécurité :
 *   - Emails masqués (première lettre + *** @ domaine)
 *   - Lecture seule (pas de bouton forcer déconnexion pour admin simple)
 *   - Rafraîchissement automatique toutes les 15 secondes
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import {
  IconeUtilisateur, IconeBouclier, IconeAlerte, IconeStatistique,
} from "@/composants/commun/Icones";
import {
  obtenirMonitoringComplet,
  type ResumeMonitoringComplet,
} from "@/services/admin";
import { ErreurAPI } from "@/services/client_api";

export default function PageMonitoringAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [donnees, setDonnees] = useState<ResumeMonitoringComplet | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actif, setActif] = useState(true);

  const charger = useCallback(async () => {
    try {
      const d = await obtenirMonitoringComplet();
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
    const intervalle = setInterval(charger, 15000);
    return () => {
      setActif(false);
      clearInterval(intervalle);
    };
  }, [charger]);

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
        <Link href="/admin/tableau-de-bord" className="hover:text-lagune">Tableau de bord</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Monitoring temps réel</span>
      </nav>

      <EnTetePage />
      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {donnees && (
        <>
          {/* KPIs Temps réel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CarteKPI libelle="Connectés" valeur={donnees.resume.utilisateurs_connectes} icone="🟢" couleur="succes" />
            <CarteKPI libelle="Sessions actives" valeur={donnees.resume.sessions_actives} icone="🔵" couleur="lagune" />
            <CarteKPI libelle="Admins connectés" valeur={donnees.resume.administrateurs_connectes} icone="🛡️" couleur="ocre" />
            <CarteKPI libelle="Connexions ajd" valeur={donnees.resume.connexions_aujourd_hui} icone="📈" couleur="lagune" />
          </div>

          {/* Détection d'anomalies */}
          {(donnees.resume.utilisateurs_avec_sessions_multiples > 0 || donnees.resume.alerts_recents > 0) && (
            <div className="bg-terre/5 border border-terre/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <IconeAlerte className="w-5 h-5 text-terre" />
                <div>
                  <p className="font-semibold text-terre text-sm">Points d'attention</p>
                  <p className="text-xs text-terre/80 mt-1">
                    {donnees.resume.utilisateurs_avec_sessions_multiples > 0 && (
                      <>{donnees.resume.utilisateurs_avec_sessions_multiples} utilisateur(s) avec {">"}5 sessions simultanées. </>
                    )}
                    {donnees.resume.alerts_recents > 0 && (
                      <>{donnees.resume.alerts_recents} alerte(s) récente(s). </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Utilisateurs connectés */}
            <Carte titre="Utilisateurs connectés" description="Personnes actuellement en ligne">
              {donnees.utilisateurs_connectes.length === 0 ? (
                <p className="text-sm text-ardoise-clair italic py-4 text-center">
                  Aucun utilisateur connecté
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {donnees.utilisateurs_connectes.slice(0, 15).map((u) => {
                    const badgeVariant = u.role === "super_administrateur" ? "terre" 
                      : u.role === "administrateur" ? "ocre" 
                      : "lagune";
                    return (
                      <div key={u.session_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-sable transition-colors text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.est_active ? "bg-green-500" : "bg-ardoise-clair/30"}`} />
                          <span className="text-ardoise truncate">{u.email}</span>
                          <Badge variante={badgeVariant as any} taille="petit">{u.role}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-ardoise-clair flex-shrink-0">
                          <span className="font-mono">{u.adresse_ip}</span>
                          {u.nb_sessions_actives > 1 && (
                            <span className="bg-ocre/10 text-ocre rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              {u.nb_sessions_actives} sessions
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {donnees.utilisateurs_connectes.length > 15 && (
                    <p className="text-xs text-ardoise-clair text-center pt-2">
                      +{donnees.utilisateurs_connectes.length - 15} autre(s)
                    </p>
                  )}
                </div>
              )}
            </Carte>

            {/* Activités récentes */}
            <Carte titre="Activités récentes" description="Dernières actions sur le système">
              {donnees.activites_recentes.length === 0 ? (
                <p className="text-sm text-ardoise-clair italic py-4 text-center">
                  Aucune activité récente
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {donnees.activites_recentes.slice(0, 10).map((a) => {
                    const type = a.type_evenement.toLowerCase();
                    const variant = type.includes("echou") || type.includes("err") ? "terre"
                      : type.includes("connexion") || type.includes("creation") ? "succes"
                      : "lagune";
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-sable transition-colors">
                        <Badge variante={variant as any} taille="petit" className="flex-shrink-0 mt-0.5">
                          {a.type_evenement.replace(/_/g, " ")}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-ardoise truncate">{a.description}</p>
                          <div className="flex gap-3 text-[10px] text-ardoise-clair mt-1">
                            {a.email && <span>{a.email}</span>}
                            {a.adresse_ip && <span className="font-mono">{a.adresse_ip}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Carte>
          </div>

          {/* Alertes sécurité */}
          {donnees.alertes.length > 0 && (
            <Carte titre="Alertes de sécurité" description="Incidents détectés">
              <div className="space-y-2">
                {donnees.alertes.slice(0, 5).map((a) => {
                  const niveauColor = a.niveau === "critique" ? "terre" : a.niveau === "elevee" ? "ocre" : "lagune";
                  return (
                    <div key={a.id} className={`border-l-4 border-${niveauColor} bg-sable-clair rounded-r-lg p-3`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variante={niveauColor as any} taille="petit">{a.type_incident}</Badge>
                        <span className={`text-xs font-semibold ${
                          a.niveau === "critique" ? "text-terre" : a.niveau === "elevee" ? "text-ocre" : "text-lagune"
                        }`}>{a.niveau}</span>
                        <span className="text-[10px] text-ardoise-clair ml-auto">
                          Score: {a.score_risque}
                        </span>
                      </div>
                      <p className="text-xs text-ardoise">{a.description}</p>
                      {a.email && <p className="text-[10px] text-ardoise-clair mt-1">{a.email}</p>}
                    </div>
                  );
                })}
              </div>
            </Carte>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Tableau de bord</Bouton>
        </Link>
        <Link href="/admin/utilisateurs">
          <Bouton variante="secondaire" taille="petit"><IconeUtilisateur className="w-3.5 h-3.5 mr-1" /> Utilisateurs</Bouton>
        </Link>
        <Link href="/admin/alertes">
          <Bouton variante="ghost" taille="petit"><IconeAlerte className="w-3.5 h-3.5 mr-1" /> Alertes</Bouton>
        </Link>
        <Link href="/admin/statistiques">
          <Bouton variante="ghost" taille="petit"><IconeStatistique className="w-3.5 h-3.5 mr-1" /> Statistiques</Bouton>
        </Link>
      </div>
    </div>
  );
}

function EnTetePage() {
  return (
    <div className="section-header">
      <p className="text-terre">Administration</p>
      <h1>Monitoring en temps réel</h1>
      <p className="text-ardoise-clair/70 text-sm mt-1">
        Supervise les utilisateurs connectés, les activités récentes
        et les alertes de sécurité en direct. Mise à jour automatique toutes les 15 secondes.
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
