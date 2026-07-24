"use client";

/**
 * Page admin — Gestion des utilisateurs.
 *
 * L'admin consulte les profils, voit les details complets via un endpoint dedie,
 * et peut modifier/suspendre/reactiver/supprimer les comptes.
 *
 * Palette DigiID : Lagune (principal), Ocre (accent), Sable (fond), Ardoise (texte).
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
import {
  IconeUtilisateur, IconeBouclier, IconeAlerte, IconeStatistique,
} from "@/composants/commun/Icones";

// ---- Types ----

interface UtilisateurApercu {
  id: string;
  prenom_initiale: string | null;
  nom_initiale: string | null;
  email_masque: string;
  ville: string | null;
  score_actuel: number | null;
  est_verrouille: boolean;
  date_inscription: string | null;
}

interface UtilisateurDetail {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  ville: string | null;
  role: string;
  est_actif: boolean;
  est_verrouille: boolean;
  est_supprime: boolean;
  est_email_verifie: boolean;
  deux_fa_active: boolean;
  score_actuel: number | null;
  digiid_public: string | null;
  date_creation: string;
  date_derniere_connexion: string | null;
  est_visage_verifie: boolean;
  date_verification_visage: string | null;
  score_liveness: number | null;
  est_cni_verifiee: boolean;
  date_verification_cni: string | null;
  niveau_verification: string;
  progres_verifications: number;
  motif_suspension: string | null;
}

// ---- Page ----

export default function PageUtilisateursAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurApercu[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  const [modalDetail, setModalDetail] = useState<UtilisateurDetail | null>(null);
  const [detailChargement, setDetailChargement] = useState(false);

  const [modalEdition, setModalEdition] = useState<UtilisateurApercu | null>(null);
  const [modalConfirmation, setModalConfirmation] = useState<{
    type: "suspendre" | "reactiver" | "supprimer";
    utilisateur: UtilisateurApercu;
  } | null>(null);

  const [actionChargement, setActionChargement] = useState(false);

  // ---- Chargement liste ----
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await clientAPI.get<UtilisateurApercu[]>("/api/v1/admin/utilisateurs", { authentifie: true });
      setUtilisateurs(Array.isArray(data) ? data : []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Impossible de charger la liste.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // ---- Chargement detail ----
  const chargerDetail = async (id: string) => {
    setDetailChargement(true);
    try {
      const data = await clientAPI.get<UtilisateurDetail>(`/api/v1/admin/utilisateurs/${id}/detail`, { authentifie: true });
      setModalDetail(data);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? `Erreur ${e.code_http} — ${e.message_utilisateur}` : String(e);
      notifier(`Impossible de charger le detail: ${msg}`, "erreur");
    } finally {
      setDetailChargement(false);
    }
  };

  // ---- Filtrage ----
  const donneesFiltrees = utilisateurs.filter((u) => {
    const r = recherche.toLowerCase();
    if (!r) return true;
    return (
      u.email_masque.toLowerCase().includes(r) ||
      (u.prenom_initiale || "").toLowerCase().includes(r) ||
      (u.nom_initiale || "").toLowerCase().includes(r) ||
      (u.ville || "").toLowerCase().includes(r)
    );
  });

  // ---- Actions API ----
  const gererModification = async (id: string, d: { prenom?: string; nom?: string; ville?: string }) => {
    setActionChargement(true);
    try {
      await clientAPI.patch<UtilisateurDetail>(`/api/v1/admin/utilisateurs/${id}`, d, { authentifie: true });
      notifier("Compte modifie avec succes", "succes");
      setModalEdition(null);
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererSuspension = async (id: string) => {
    setActionChargement(true);
    try {
      await clientAPI.patch<UtilisateurDetail>(`/api/v1/admin/utilisateurs/${id}/suspendre`, { motif: "Suspendu par administrateur" }, { authentifie: true });
      notifier("Compte suspendu", "succes");
      setModalConfirmation(null);
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererReactivation = async (id: string) => {
    setActionChargement(true);
    try {
      await clientAPI.patch<UtilisateurDetail>(`/api/v1/admin/utilisateurs/${id}/reactiver`, undefined, { authentifie: true });
      notifier("Compte reactive", "succes");
      setModalConfirmation(null);
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererSuppression = async (id: string) => {
    setActionChargement(true);
    try {
      await clientAPI.delete<{ succes: boolean }>(`/api/v1/admin/utilisateurs/${id}?raison=Suppression+admin&confirmation=true`, { authentifie: true });
      notifier("Compte supprime", "succes");
      setModalConfirmation(null);
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  // ---- Colonnes ----
  const MAP_ROLE: Record<string, string> = {
    citoyen: "Citoyen",
    chef_police: "Chef Police", chef_medical: "Chef Medical",
    chef_ong: "Chef ONG", chef_agent: "Chef Enrolement",
    agent_police: "Agent Police", agent_medical: "Agent Medical",
    agent_terrain: "Agent Terrain", agent_ong: "Agent ONG",
    admin_domaine: "Admin Domaine",
    administrateur: "Admin", super_administrateur: "Super admin",
  };

  const colonnes: Colonne<UtilisateurApercu>[] = [
    {
      cle: "identite",
      libelle: "Identite",
      rendu: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sable flex items-center justify-center flex-shrink-0">
            <IconeUtilisateur className="w-4 h-4 text-lagune" />
          </div>
          <div>
            <p className="font-medium text-ardoise text-sm">
              {[u.prenom_initiale, u.nom_initiale].filter(Boolean).join(" ") || "Sans nom"}
            </p>
            <p className="text-xs text-ardoise-clair/70">{u.email_masque}</p>
          </div>
        </div>
      ),
    },
    {
      cle: "ville",
      libelle: "Ville",
      rendu: (u) => <span className="text-sm text-ardoise-clair">{u.ville || "—"}</span>,
    },
    {
      cle: "score",
      libelle: "Score",
      alignement: "centre",
      rendu: (u) =>
        u.score_actuel !== null ? (
          <Badge variante={u.score_actuel >= 70 ? "succes" : u.score_actuel >= 40 ? "ocre" : "terre"}>
            {u.score_actuel}
          </Badge>
        ) : (
          <span className="text-ardoise-clair/40 text-xs">—</span>
        ),
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (u) =>
        u.est_verrouille ? <Badge variante="terre">Verrouille</Badge> : <Badge variante="succes">Actif</Badge>,
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (u) => (
        <div className="flex gap-1">
          <Bouton variante="ghost" taille="petit" onClick={() => chargerDetail(u.id)} title="Voir details">👁️</Bouton>
          <Bouton variante="ghost" taille="petit" onClick={() => setModalEdition(u)} title="Modifier">✏️</Bouton>
          <Bouton variante="ghost" taille="petit"
            onClick={() => setModalConfirmation({ type: u.est_verrouille ? "reactiver" : "suspendre", utilisateur: u })}
            title={u.est_verrouille ? "Reactiver" : "Suspendre"}>
            {u.est_verrouille ? "🔓" : "🔒"}
          </Bouton>
          <Bouton variante="ghost" taille="petit"
            onClick={() => setModalConfirmation({ type: "supprimer", utilisateur: u })}
            title="Supprimer">🗑️</Bouton>
        </div>
      ),
    },
  ];

  return (
    <div className="apparition space-y-6">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin/tableau-de-bord" className="hover:text-lagune">Tableau de bord</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Utilisateurs</span>
      </nav>

      {/* En-tete */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="section-header">
          <p className="text-terre">Administration</p>
          <h1>Gestion des utilisateurs</h1>
          <p className="text-ardoise-clair/70 text-sm mt-1">
            Consulte les profils, les verifications (faciale, CNI), les scores.
            Modifie ou suspend un compte.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href="/admin/droits"><Bouton variante="ghost" taille="petit"><IconeBouclier className="w-3.5 h-3.5 mr-1" /> Droits</Bouton></Link>
          <Link href="/admin/tableau-de-bord"><Bouton variante="ghost" taille="petit">← Retour</Bouton></Link>
        </div>
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* Barre recherche */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ardoise-clair/70">
          <strong className="text-lagune font-semibold">{donneesFiltrees.length}</strong> compte{donneesFiltrees.length > 1 ? "s" : ""}
          {recherche && <> · filtre : <code className="text-xs bg-sable px-1.5 py-0.5 rounded">{recherche}</code></>}
        </p>
        <div className="w-full sm:w-72">
          <ChampRecherche placeholder="Email masque, initiales, ville..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* Tableau */}
      {chargement ? (
        <Carte>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-sable-clair/50 rounded-lg animate-pulse" />)}
          </div>
        </Carte>
      ) : (
        <Carte>
          <Tableau colonnes={colonnes} donnees={donneesFiltrees} cleLigne={(u) => u.id}
            vide={<div className="text-center py-8"><IconeUtilisateur className="w-10 h-10 mx-auto text-ardoise-clair/20 mb-3" /><p className="text-ardoise-clair/70">Aucun utilisateur trouve</p></div>} />
        </Carte>
      )}

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/admin/alertes"><Bouton variante="ghost" taille="petit"><IconeAlerte className="w-3.5 h-3.5 mr-1" /> Alertes</Bouton></Link>
        <Link href="/admin/statistiques"><Bouton variante="ghost" taille="petit"><IconeStatistique className="w-3.5 h-3.5 mr-1" /> Statistiques</Bouton></Link>
        <Link href="/admin/droits"><Bouton variante="ghost" taille="petit"><IconeBouclier className="w-3.5 h-3.5 mr-1" /> Droits</Bouton></Link>
      </div>

      {/* ========== MODAL DETAIL ========== */}
      <Modal ouvert={modalDetail !== null} surFermeture={() => setModalDetail(null)}
        titre={modalDetail ? [modalDetail.prenom, modalDetail.nom].filter(Boolean).join(" ") || modalDetail.email : ""}
        description={modalDetail ? `Role: ${(modalDetail.role || "").replace(/_/g, " ")}` : undefined}>
        {detailChargement ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-sable-clair/50 rounded-lg animate-pulse" />)}
          </div>
        ) : modalDetail ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* Identite */}
            <Section titre="Identite">
              <Grille champs={[
                { label: "ID DigiID", valeur: modalDetail.digiid_public || "—", mono: true },
                { label: "Email", valeur: modalDetail.email },
                { label: "Prenom", valeur: modalDetail.prenom || "—" },
                { label: "Nom", valeur: modalDetail.nom || "—" },
                { label: "Telephone", valeur: modalDetail.telephone || "—" },
                { label: "Ville", valeur: modalDetail.ville || "—" },
              ]} />
            </Section>

            <Separateur />

            {/* Verifications */}
            <Section titre="Verifications d'identite">
              <div className="grid grid-cols-2 gap-4">
                <CarteVerif
                  icone="📸"
                  titre="Reconnaissance faciale"
                  verifie={modalDetail.est_visage_verifie}
                  details={
                    <>
                      {modalDetail.score_liveness !== null && (
                        <p>Score liveness: <strong>{Math.round(modalDetail.score_liveness * 100)}%</strong></p>
                      )}
                      {modalDetail.date_verification_visage && (
                        <p>Verifie le {new Date(modalDetail.date_verification_visage).toLocaleDateString("fr-FR")}</p>
                      )}
                    </>
                  }
                />
                <CarteVerif
                  icone="🪪"
                  titre="Carte Nationale"
                  verifie={modalDetail.est_cni_verifiee}
                  details={
                    modalDetail.date_verification_cni ? (
                      <p>Verifiee le {new Date(modalDetail.date_verification_cni).toLocaleDateString("fr-FR")}</p>
                    ) : undefined
                  }
                />
              </div>
              <div className="mt-4">
                <BarreProgression valeur={modalDetail.progres_verifications} label="Niveau de verification" />
                <p className="text-xs text-ardoise-clair mt-1 italic">
                  Niveau: {modalDetail.niveau_verification.replace(/_/g, " ")}
                </p>
              </div>
            </Section>

            <Separateur />

            {/* Score */}
            <Section titre="Score de confiance">
              <div className="bg-sable rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-lagune">
                    {modalDetail.score_actuel !== null ? modalDetail.score_actuel : "—"}
                  </span>
                  {modalDetail.score_actuel !== null && <span className="text-sm text-ardoise-clair">/ 100</span>}
                </div>
              </div>
            </Section>

            <Separateur />

            {/* Statut */}
            <Section titre="Statut du compte">
              <Grille champs={[
                { label: "Role", valeur: (modalDetail.role || "").replace(/_/g, " ") },
                { label: "Email verifie", valeur: modalDetail.est_email_verifie ? "Oui" : "Non" },
                { label: "2FA activee", valeur: modalDetail.deux_fa_active ? "Oui" : "Non" },
                { label: "Compte", valeur: modalDetail.est_supprime ? "Supprime" : modalDetail.est_verrouille ? "Verrouille" : modalDetail.est_actif ? "Actif" : "Inactif" },
              ]} />
              {modalDetail.motif_suspension && (
                <div className="mt-3 p-3 bg-terre/5 rounded-lg border border-terre/10">
                  <p className="text-xs font-semibold text-terre">Motif suspension</p>
                  <p className="text-sm text-ardoise">{modalDetail.motif_suspension}</p>
                </div>
              )}
            </Section>

            <Separateur />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-xs text-ardoise-clair">
              <div>
                <p className="font-semibold text-ardoise">Inscrit le</p>
                <p>{new Date(modalDetail.date_creation).toLocaleDateString("fr-FR")}</p>
              </div>
              <div>
                <p className="font-semibold text-ardoise">Derniere connexion</p>
                <p>{modalDetail.date_derniere_connexion ? new Date(modalDetail.date_derniere_connexion).toLocaleDateString("fr-FR") : "—"}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Bouton variante="ghost" onClick={() => setModalDetail(null)}>Fermer</Bouton>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ========== MODAL EDITION SIMPLE ========== */}
      {modalEdition && (
        <Modal ouvert={true} surFermeture={() => setModalEdition(null)}
          titre="Modifier le compte" description={modalEdition.email_masque}>
          <EditionSimple
            prenom_initiale={modalEdition.prenom_initiale}
            nom_initiale={modalEdition.nom_initiale}
            ville={modalEdition.ville}
            chargement={actionChargement}
            onSauvegarder={(d) => gererModification(modalEdition.id, d)}
            onAnnuler={() => setModalEdition(null)}
          />
        </Modal>
      )}

      {/* ========== MODAL CONFIRMATION ========== */}
      {modalConfirmation && (
        <Modal ouvert={true} surFermeture={() => setModalConfirmation(null)}
          titre={
            modalConfirmation.type === "suspendre" ? "Suspendre le compte" :
            modalConfirmation.type === "reactiver" ? "Reactiver le compte" :
            "Supprimer le compte"
          }>
          <div className="space-y-4">
            {modalConfirmation.type === "supprimer" && (
              <div className="bg-terre/10 border-l-4 border-terre p-3 rounded">
                <p className="text-sm text-terre font-semibold">Action irreversible</p>
                <p className="text-xs text-terre/80 mt-1">
                  Le compte sera desactive. Seul un super admin peut le restaurer.
                </p>
              </div>
            )}
            <p className="text-sm text-ardoise">
              {modalConfirmation.type === "suspendre" && <>Suspendre <strong>{modalConfirmation.utilisateur.email_masque}</strong> ?</>}
              {modalConfirmation.type === "reactiver" && <>Reactiver <strong>{modalConfirmation.utilisateur.email_masque}</strong> ?</>}
              {modalConfirmation.type === "supprimer" && <>Supprimer <strong>{modalConfirmation.utilisateur.email_masque}</strong> ?</>}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModalConfirmation(null)}>Annuler</Bouton>
              <Bouton variante={modalConfirmation.type === "supprimer" ? "primaire" : "secondaire"} taille="petit" chargement={actionChargement}
                onClick={() => {
                  const u = modalConfirmation.utilisateur;
                  if (modalConfirmation.type === "suspendre") gererSuspension(u.id);
                  else if (modalConfirmation.type === "reactiver") gererReactivation(u.id);
                  else gererSuppression(u.id);
                }}>
                {modalConfirmation.type === "suspendre" ? "Suspendre" :
                 modalConfirmation.type === "reactiver" ? "Reactiver" : "Confirmer la suppression"}
              </Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Sous-composants ----

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-3">{titre}</p>
      {children}
    </div>
  );
}

function Separateur() {
  return <div className="h-px bg-ardoise-clair/10" />;
}

function Grille({ champs }: { champs: { label: string; valeur: string; mono?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {champs.map((c) => (
        <div key={c.label}>
          <p className="text-[11px] uppercase text-ardoise-clair/60 font-semibold tracking-wider">{c.label}</p>
          <p className={`text-sm mt-0.5 text-ardoise ${c.mono ? "font-mono" : ""}`}>{c.valeur}</p>
        </div>
      ))}
    </div>
  );
}

function CarteVerif({
  icone, titre, verifie, details,
}: {
  icone: string; titre: string; verifie: boolean; details?: React.ReactNode;
}) {
  return (
    <div className="bg-sable rounded-xl p-4 border border-ardoise-clair/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icone}</span>
        <div>
          <p className="font-semibold text-sm text-ardoise">{titre}</p>
          {verifie ? <Badge variante="succes">Verifie</Badge> : <Badge variante="neutre">Non verifie</Badge>}
        </div>
      </div>
      {verifie && details && <div className="space-y-1 text-xs text-ardoise-clair">{details}</div>}
    </div>
  );
}

function BarreProgression({ valeur, label }: { valeur: number; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ardoise-clair mb-1">
        <span>{label}</span>
        <span className="font-semibold">{valeur}%</span>
      </div>
      <div className="w-full h-2 bg-sable rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${valeur >= 80 ? "bg-green-500" : valeur >= 40 ? "bg-ocre" : "bg-terre"}`}
          style={{ width: `${Math.min(valeur, 100)}%` }}
        />
      </div>
    </div>
  );
}

function EditionSimple({
  prenom_initiale, nom_initiale, ville, chargement, onSauvegarder, onAnnuler,
}: {
  prenom_initiale: string | null;
  nom_initiale: string | null;
  ville: string | null;
  chargement: boolean;
  onSauvegarder: (d: { ville?: string }) => void;
  onAnnuler: () => void;
}) {
  const [nouvelleVille, setNouvelleVille] = useState(ville || "");

  return (
    <div className="space-y-4">
      <div className="bg-sable/50 rounded-lg p-3 text-sm text-ardoise-clair">
        <p>Prenom: <strong>{prenom_initiale || "—"}</strong></p>
        <p>Nom: <strong>{nom_initiale || "—"}</strong></p>
        <p className="text-xs mt-1">(Les donnees completes sont visibles dans le detail)</p>
      </div>
      <div>
        <label className="text-xs uppercase text-ardoise-clair font-semibold">Ville</label>
        <input type="text" value={nouvelleVille} onChange={(e) => setNouvelleVille(e.target.value)}
          className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:border-lagune focus:ring-1 focus:ring-lagune/30" placeholder="Dakar" />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
        <Bouton variante="ghost" onClick={onAnnuler}>Annuler</Bouton>
        <Bouton variante="primaire" taille="petit" chargement={chargement}
          onClick={() => onSauvegarder({ ville: nouvelleVille || undefined })}>
          Enregistrer
        </Bouton>
      </div>
    </div>
  );
}
