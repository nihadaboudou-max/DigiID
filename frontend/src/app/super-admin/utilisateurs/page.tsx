"use client";

/**
 * Page super admin — Gestion complète des utilisateurs.
 * Liste, recherche, filtre, modification, suspension, suppression, changement de rôle.
 * 100% dynamique via API.
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
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { useNotifications } from "@/contextes/notifications";
import {
  listerTousUtilisateurs,
  obtenirUtilisateurDetail,
  modifierUtilisateur,
  suspendreUtilisateur,
  reactiverUtilisateur,
  supprimerUtilisateur,
  supprimerDefinitivementUtilisateur,
  changerRoleUtilisateur,
  compterUtilisateurs,
  creerProfilUtilisateur,
  type UtilisateurComplet,
  type ListeUtilisateurs,
  type FiltresUtilisateurs,
  type NombreUtilisateurs,
  type ModifierUtilisateurRequete,
  type ChangerRoleRequete,
  type CreerProfilRequete,
} from "@/services/super_admin_utilisateurs";
import { ErreurAPI } from "@/services/client_api";

// ---- Types des onglets de filtre ----
type FiltreStatut = "tous" | "actifs" | "verrouilles" | "supprimes";

const ROLES_DISPONIBLES = [
  { role: "citoyen", libelle: "Citoyen" },
  { role: "agent", libelle: "Agent administratif" },
  { role: "medecin", libelle: "Médecin" },
  { role: "police", libelle: "Forces de l'ordre" },
  { role: "ong", libelle: "ONG" },
  { role: "administrateur", libelle: "Administrateur" },
  { role: "super_administrateur", libelle: "Super administrateur" },
];

export default function PageSuperAdminUtilisateurs() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();

  // États
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurComplet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tous");
  const [filtreRole, setFiltreRole] = useState<string>("");
  const [compteurs, setCompteurs] = useState<NombreUtilisateurs | null>(null);

  // Modals
  const [modalUtilisateur, setModalUtilisateur] = useState<UtilisateurComplet | null>(null);
  const [modalEdition, setModalEdition] = useState<UtilisateurComplet | null>(null);
  const [modalCreation, setModalCreation] = useState(false);
  const [modalSuspension, setModalSuspension] = useState<UtilisateurComplet | null>(null);
  const [modalSuppression, setModalSuppression] = useState<UtilisateurComplet | null>(null);
  const [modalRole, setModalRole] = useState<UtilisateurComplet | null>(null);

  // États chargement actions
  const [actionChargement, setActionChargement] = useState(false);

  // ---- Chargement ----
  const charger = useCallback(async (pg: number = page) => {
    setChargement(true);
    setErreur(null);
    try {
      const filtres: FiltresUtilisateurs = { page: pg, limite: 20 };
      if (recherche) filtres.recherche = recherche;
      if (filtreRole) filtres.role = filtreRole;
      if (filtreStatut === "actifs") filtres.est_actif = true;
      else if (filtreStatut === "verrouilles") filtres.est_verrouille = true;
      else if (filtreStatut === "supprimes") filtres.est_supprime = true;

      const [liste, cpts] = await Promise.all([
        listerTousUtilisateurs(filtres),
        compterUtilisateurs().catch(() => null),
      ]);
      setUtilisateurs(liste.utilisateurs);
      setTotal(liste.total);
      setPage(liste.page);
      setPages(liste.pages);
      if (cpts) setCompteurs(cpts);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement des utilisateurs");
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreStatut, filtreRole, page]);

  useEffect(() => { charger(1); }, []);

  // Recharger quand recherche/filtres changent
  useEffect(() => {
    const timer = setTimeout(() => charger(1), 300);
    return () => clearTimeout(timer);
  }, [recherche, filtreStatut, filtreRole]);

  // ---- Actions ----
  const gererSuspension = async (utilisateur: UtilisateurComplet, motif: string) => {
    setActionChargement(true);
    try {
      const resultat = await suspendreUtilisateur(utilisateur.id, motif);
      notifier(`Compte ${resultat.email} suspendu avec succès`, "succes");
      setModalSuspension(null);
      charger(page);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suspension", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererReactivation = async (utilisateur: UtilisateurComplet) => {
    setActionChargement(true);
    try {
      const resultat = await reactiverUtilisateur(utilisateur.id);
      notifier(`Compte ${resultat.email} réactivé`, "succes");
      setModalSuspension(null);
      charger(page);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la réactivation", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererSuppression = async (utilisateur: UtilisateurComplet, raison: string) => {
    setActionChargement(true);
    try {
      await supprimerUtilisateur(utilisateur.id, raison);
      notifier(`Compte ${utilisateur.email} supprimé`, "succes");
      setModalSuppression(null);
      charger(page);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererChangementRole = async (utilisateur: UtilisateurComplet, nouveauRole: string, motif: string) => {
    setActionChargement(true);
    try {
      const donnees: ChangerRoleRequete = { role: nouveauRole, motif };
      const resultat = await changerRoleUtilisateur(utilisateur.id, donnees);
      notifier(`Rôle de ${resultat.email} changé en "${nouveauRole}"`, "succes");
      setModalRole(null);
      charger(page);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors du changement de rôle", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererModification = async (utilisateur: UtilisateurComplet, donnees: ModifierUtilisateurRequete) => {
    setActionChargement(true);
    try {
      const resultat = await modifierUtilisateur(utilisateur.id, donnees);
      notifier(`Compte ${resultat.email} modifié avec succès`, "succes");
      setModalEdition(null);
      charger(page);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la modification", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  const gererCreation = async (donnees: CreerProfilRequete) => {
    setActionChargement(true);
    try {
      const profil = await creerProfilUtilisateur(donnees);
      notifier(`Profil ${donnees.role} créé : ${profil.prenom} ${profil.nom} (${profil.email})`, "succes");
      setModalCreation(false);
      charger(page);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la création", "erreur");
    } finally {
      setActionChargement(false);
    }
  };

  // ---- Colonnes du tableau ----
  const colonnes: Colonne<UtilisateurComplet>[] = [
    {
      cle: "email",
      libelle: "Email",
      rendu: (u) => (
        <span className="font-medium text-ardoise">{u.email}</span>
      ),
    },
    {
      cle: "nom",
      libelle: "Nom complet",
      rendu: (u) => (
        <span>{[u.prenom, u.nom].filter(Boolean).join(" ") || "—"}</span>
      ),
    },
    {
      cle: "role",
      libelle: "Rôle",
      rendu: (u) => {
        const vars: Record<string, "lagune" | "succes" | "ocre" | "terre"> = {
          citoyen: "lagune", agent: "lagune", medecin: "succes",
          police: "succes", ong: "succes", administrateur: "ocre",
          super_administrateur: "terre",
        };
        const roles: Record<string, string> = {
          citoyen: "Citoyen", agent: "Agent", medecin: "Médecin",
          police: "Police", ong: "ONG", administrateur: "Admin",
          super_administrateur: "Super admin",
        };
        return <Badge variante={vars[u.role] || "lagune"}>{roles[u.role] || u.role}</Badge>;
      },
    },
    {
      cle: "statut",
      libelle: "Statut",
      rendu: (u) => {
        if (u.est_supprime) return <Badge variante="terre">Supprimé</Badge>;
        if (u.est_verrouille) return <Badge variante="terre">Verrouillé</Badge>;
        if (!u.est_actif) return <Badge variante="ocre">Inactif</Badge>;
        return <Badge variante="succes">Actif</Badge>;
      },
    },
    {
      cle: "ville",
      libelle: "Ville",
      rendu: (u) => <span className="text-ardoise-clair">{u.ville || "—"}</span>,
    },
    {
      cle: "score_actuel",
      libelle: "Score",
      alignement: "centre",
      rendu: (u) =>
        u.score_actuel !== null ? (
          <Badge variante={u.score_actuel >= 70 ? "succes" : u.score_actuel >= 40 ? "ocre" : "terre"}>
            {u.score_actuel}
          </Badge>
        ) : (
          <span className="text-ardoise-clair text-xs">—</span>
        ),
    },
    {
      cle: "2fa",
      libelle: "2FA",
      alignement: "centre",
      rendu: (u) =>
        u.deux_fa_active ? (
          <span className="text-green-500 text-sm">✓ Activé</span>
        ) : (
          <span className="text-ardoise-clair text-sm">—</span>
        ),
    },
    {
      cle: "date_creation",
      libelle: "Inscrit le",
      rendu: (u) => (
        <span className="text-xs text-ardoise-clair">
          {new Date(u.date_creation).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
    {
      cle: "actions",
      libelle: "Actions",
      alignement: "droite",
      rendu: (u) => (
        <div className="flex gap-1">
          <Bouton variante="ghost" taille="petit" onClick={() => setModalUtilisateur(u)} title="Voir détails">
            👁️
          </Bouton>
          <Bouton variante="ghost" taille="petit" onClick={() => setModalEdition(u)} title="Modifier">
            ✏️
          </Bouton>
          {!u.est_supprime && (
            <>
              <Bouton variante="ghost" taille="petit" onClick={() => setModalSuspension(u)} title={u.est_verrouille ? "Réactiver" : "Suspendre"}>
                {u.est_verrouille ? "🔓" : "🔒"}
              </Bouton>
              <Bouton variante="ghost" taille="petit" onClick={() => setModalRole(u)} title="Changer rôle">
                🎭
              </Bouton>
              <Bouton variante="ghost" taille="petit" onClick={() => setModalSuppression(u)} title="Supprimer">
                🗑️
              </Bouton>
            </>
          )}
        </div>
      ),
    },
  ];

  // ---- Rendu ----
  return (
    <div className="space-y-6 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/super-admin/tableau-de-bord" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Utilisateurs</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1">Gestion des utilisateurs</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Liste complète de tous les utilisateurs inscrits. Accès total en lecture/écriture.
            Toutes les actions sont tracées dans le journal d&apos;audit.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/super-admin/tableau-de-bord">
            <Bouton variante="ghost" taille="petit">← Retour</Bouton>
          </Link>
          <Bouton variante="primaire" taille="petit" onClick={() => setModalCreation(true)}>
            + Créer un profil
          </Bouton>
          <Link href="/super-admin/droits">
            <Bouton variante="secondaire" taille="petit">🛡️ Gestion des droits</Bouton>
          </Link>
        </div>
      </div>

      {/* Compteurs */}
      {compteurs && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <CarteStat valeur={compteurs.total} libelle="Total" couleur="lagune" />
          <CarteStat valeur={compteurs.actifs} libelle="Actifs" couleur="succes" />
          <CarteStat valeur={compteurs.verrouilles} libelle="Verrouillés" couleur="terre" />
          <CarteStat valeur={compteurs.supprimes} libelle="Supprimés" couleur="ardoise" />
          <CarteStat valeur={compteurs.avec_2fa} libelle="2FA activé" couleur="ocre" />
          <CarteStat valeur={compteurs.sans_2fa} libelle="Sans 2FA" couleur="ardoise" />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-full sm:w-72">
          <ChampRecherche
            placeholder="Rechercher par email, nom, ville..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["tous", "actifs", "verrouilles", "supprimes"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFiltreStatut(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtreStatut === f
                  ? "bg-ocre text-white"
                  : "bg-white border border-ardoise-clair/20 text-ardoise hover:bg-sable"
              }`}
            >
              {f === "tous" ? "Tous" : f === "actifs" ? "Actifs" : f === "verrouilles" ? "Verrouillés" : "Supprimés"}
            </button>
          ))}
        </div>

        <select
          value={filtreRole}
          onChange={(e) => { setFiltreRole(e.target.value); setPage(1); }}
          className="text-xs px-3 py-1.5 rounded-full border border-ardoise-clair/20 bg-white text-ardoise"
        >
          <option value="">Tous les rôles</option>
          {ROLES_DISPONIBLES.map((r) => (
            <option key={r.role} value={r.role}>{r.libelle}</option>
          ))}
        </select>
      </div>

      {/* Erreur */}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Tableau */}
      <Carte>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-ocre">{total}</strong> utilisateur{total > 1 ? "s" : ""}
            {recherche && <> · filtre : <code className="text-xs">{recherche}</code></>}
            {filtreRole && <> · rôle : <code className="text-xs">{filtreRole}</code></>}
          </p>
          <button
            onClick={() => charger(page)}
            className="text-xs text-ocre hover:text-ocre-clair transition-colors"
            title="Rafraîchir"
          >
            ↻ Actualiser
          </button>
        </div>

        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement des utilisateurs...</p>
        ) : (
          <Tableau
            colonnes={colonnes}
            donnees={utilisateurs}
            cleLigne={(u) => u.id}
            vide={<>Aucun utilisateur trouvé.</>}
          />
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-ardoise-clair/10">
            <Bouton
              variante="ghost"
              taille="petit"
              disabled={page <= 1}
              onClick={() => charger(page - 1)}
            >
              ← Précédent
            </Bouton>
            <span className="text-sm text-ardoise-clair">
              Page {page} / {pages}
            </span>
            <Bouton
              variante="ghost"
              taille="petit"
              disabled={page >= pages}
              onClick={() => charger(page + 1)}
            >
              Suivant →
            </Bouton>
          </div>
        )}
      </Carte>

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/super-admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Tableau de bord</Bouton>
        </Link>
        <Link href="/super-admin/droits">
          <Bouton variante="secondaire" taille="petit">🛡️ Gestion des droits</Bouton>
        </Link>
        <Link href="/super-admin/administrateurs">
          <Bouton variante="ghost" taille="petit">👤 Administrateurs</Bouton>
        </Link>
        <Link href="/super-admin/audit">
          <Bouton variante="ghost" taille="petit">📜 Audit</Bouton>
        </Link>
      </div>

      {/* ================================================================ */}
      {/* MODALS                                                          */}
      {/* ================================================================ */}

      {/* MODAL DÉTAIL */}
      {modalUtilisateur && (
        <DetailModal
          utilisateur={modalUtilisateur}
          onFermer={() => setModalUtilisateur(null)}
        />
      )}

      {/* MODAL ÉDITION */}
      {modalEdition && (
        <EditionModal
          utilisateur={modalEdition}
          chargement={actionChargement}
          onSauvegarder={(d) => gererModification(modalEdition, d)}
          onFermer={() => setModalEdition(null)}
        />
      )}

      {/* MODAL SUSPENSION / RÉACTIVATION */}
      {modalSuspension && (
        <SuspensionModal
          utilisateur={modalSuspension}
          chargement={actionChargement}
          onSuspendre={(motif) => gererSuspension(modalSuspension, motif)}
          onReactivater={() => gererReactivation(modalSuspension)}
          onFermer={() => setModalSuspension(null)}
        />
      )}

      {/* MODAL SUPPRESSION */}
      {modalSuppression && (
        <SuppressionModal
          utilisateur={modalSuppression}
          chargement={actionChargement}
          onSupprimer={(raison) => gererSuppression(modalSuppression, raison)}
          onFermer={() => setModalSuppression(null)}
        />
      )}

      {/* MODAL CHANGEMENT RÔLE */}
      {modalRole && (
        <RoleModal
          utilisateur={modalRole}
          chargement={actionChargement}
          onChangerRole={(role, motif) => gererChangementRole(modalRole, role, motif)}
          onFermer={() => setModalRole(null)}
        />
      )}

      {/* MODAL CRÉATION DE PROFIL */}
      {modalCreation && (
        <CreationModal
          chargement={actionChargement}
          onCreer={(d) => gererCreation(d)}
          onFermer={() => setModalCreation(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

function CarteStat({ valeur, libelle, couleur }: { valeur: number; libelle: string; couleur: string }) {
  const couleurs: Record<string, string> = {
    lagune: "text-lagune", succes: "text-green-600", ocre: "text-ocre",
    terre: "text-terre", ardoise: "text-ardoise-clair",
  };
  return (
    <div className="carte text-center">
      <p className={`text-2xl font-bold ${couleurs[couleur] || "text-ardoise"}`}>{valeur}</p>
      <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wide">{libelle}</p>
    </div>
  );
}

// ---- DÉTAIL ----
function DetailModal({ utilisateur, onFermer }: { utilisateur: UtilisateurComplet; onFermer: () => void }) {
  return (
    <Modal ouvert={true} surFermeture={onFermer} titre={`Détail — ${utilisateur.email}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">ID</p>
            <p className="font-mono text-xs mt-1 break-all">{utilisateur.id}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Email</p>
            <p className="text-sm mt-1">{utilisateur.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Prénom</p>
            <p className="text-sm mt-1">{utilisateur.prenom || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Nom</p>
            <p className="text-sm mt-1">{utilisateur.nom || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Rôle</p>
            <p className="text-sm mt-1">{utilisateur.role}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Ville</p>
            <p className="text-sm mt-1">{utilisateur.ville || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Score</p>
            <p className="text-sm mt-1">{utilisateur.score_actuel !== null ? `${utilisateur.score_actuel}/100` : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Sessions actives</p>
            <p className="text-sm mt-1">{utilisateur.sessions_actives}</p>
          </div>
        </div>

        <div className="border-t border-ardoise-clair/10 pt-4">
          <p className="text-xs uppercase text-ardoise-clair font-semibold mb-3">Statuts</p>
          <div className="flex flex-wrap gap-4">
            <StatutItem label="Actif" value={utilisateur.est_actif} />
            <StatutItem label="Verrouillé" value={utilisateur.est_verrouille} />
            <StatutItem label="Supprimé" value={utilisateur.est_supprime} />
            <StatutItem label="Email vérifié" value={utilisateur.est_email_verifie} />
            <StatutItem label="2FA actif" value={utilisateur.deux_fa_active} />
          </div>
        </div>

        <div className="border-t border-ardoise-clair/10 pt-4 grid grid-cols-2 gap-4 text-xs text-ardoise-clair">
          <div>
            <p className="font-semibold">Créé le</p>
            <p>{new Date(utilisateur.date_creation).toLocaleString("fr-FR")}</p>
          </div>
          <div>
            <p className="font-semibold">Dernière connexion</p>
            <p>{utilisateur.date_derniere_connexion ? new Date(utilisateur.date_derniere_connexion).toLocaleString("fr-FR") : "—"}</p>
          </div>
          {utilisateur.motif_suspension && (
            <div className="col-span-2">
              <p className="font-semibold">Motif suspension</p>
              <p>{utilisateur.motif_suspension}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-ardoise-clair/10">
          <Bouton variante="ghost" onClick={onFermer}>Fermer</Bouton>
        </div>
      </div>
    </Modal>
  );
}

function StatutItem({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${value ? "bg-green-500" : "bg-gray-300"}`} />
      <span className={value ? "text-ardoise" : "text-ardoise-clair"}>{label}</span>
    </div>
  );
}

// ---- ÉDITION ----
function EditionModal({
  utilisateur, chargement, onSauvegarder, onFermer,
}: {
  utilisateur: UtilisateurComplet;
  chargement: boolean;
  onSauvegarder: (d: ModifierUtilisateurRequete) => void;
  onFermer: () => void;
}) {
  const [prenom, setPrenom] = useState(utilisateur.prenom || "");
  const [nom, setNom] = useState(utilisateur.nom || "");
  const [ville, setVille] = useState(utilisateur.ville || "");

  return (
    <Modal ouvert={true} surFermeture={onFermer} titre={`Modifier — ${utilisateur.email}`}>
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Prénom</label>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Nom</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Ville</label>
          <input
            type="text"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
          <Bouton variante="ghost" onClick={onFermer}>Annuler</Bouton>
          <Bouton variante="primaire" taille="petit" chargement={chargement} onClick={() => onSauvegarder({ prenom, nom, ville })}>
            Enregistrer
          </Bouton>
        </div>
      </div>
    </Modal>
  );
}

// ---- SUSPENSION / RÉACTIVATION ----
function SuspensionModal({
  utilisateur, chargement, onSuspendre, onReactivater, onFermer,
}: {
  utilisateur: UtilisateurComplet;
  chargement: boolean;
  onSuspendre: (motif: string) => void;
  onReactivater: () => void;
  onFermer: () => void;
}) {
  const [motif, setMotif] = useState("");

  if (utilisateur.est_verrouille) {
    return (
      <Modal ouvert={true} surFermeture={onFermer} titre="Réactivation du compte">
        <div className="space-y-4">
          <p className="text-sm text-ardoise">
            Es-tu sûr de vouloir réactiver le compte de <strong>{utilisateur.email}</strong> ?
          </p>
          <p className="text-xs text-ardoise-clair">L'utilisateur pourra à nouveau se connecter.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
            <Bouton variante="ghost" onClick={onFermer}>Annuler</Bouton>
            <Bouton variante="primaire" taille="petit" chargement={chargement} onClick={onReactivater}>
              🔓 Réactiver
            </Bouton>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal ouvert={true} surFermeture={onFermer} titre="Suspendre le compte">
      <div className="space-y-4">
        <p className="text-sm text-ardoise">
          Suspendre le compte de <strong>{utilisateur.email}</strong>
        </p>
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Motif de suspension</label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none h-20"
            placeholder="Optionnel : indique la raison..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
          <Bouton variante="ghost" onClick={onFermer}>Annuler</Bouton>
          <Bouton variante="secondaire" taille="petit" chargement={chargement} onClick={() => onSuspendre(motif)}>
            🔒 Suspendre
          </Bouton>
        </div>
      </div>
    </Modal>
  );
}

// ---- SUPPRESSION ----
function SuppressionModal({
  utilisateur, chargement, onSupprimer, onFermer,
}: {
  utilisateur: UtilisateurComplet;
  chargement: boolean;
  onSupprimer: (raison: string) => void;
  onFermer: () => void;
}) {
  const [raison, setRaison] = useState("");

  return (
    <Modal ouvert={true} surFermeture={onFermer} titre="Supprimer le compte">
      <div className="space-y-4">
        <div className="bg-terre/10 border-l-4 border-terre p-3 rounded">
          <p className="text-sm text-terre font-semibold">⚠️ Action irréversible</p>
          <p className="text-xs text-terre/80 mt-1">
            Le compte sera marqué comme supprimé. L'utilisateur ne pourra plus se connecter.
            Un super admin peut restaurer le compte dans les 30 jours.
          </p>
        </div>
        <p className="text-sm text-ardoise">
          Supprimer le compte de <strong>{utilisateur.email}</strong>
        </p>
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Raison</label>
          <textarea
            value={raison}
            onChange={(e) => setRaison(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none h-20"
            placeholder="Obligatoire : indique la raison de la suppression..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
          <Bouton variante="ghost" onClick={onFermer}>Annuler</Bouton>
          <Bouton variante="primaire" taille="petit" chargement={chargement} disabled={!raison.trim()} onClick={() => onSupprimer(raison)}>
            🗑️ Confirmer la suppression
          </Bouton>
        </div>
      </div>
    </Modal>
  );
}

// ---- CHANGEMENT RÔLE ----
function RoleModal({
  utilisateur, chargement, onChangerRole, onFermer,
}: {
  utilisateur: UtilisateurComplet;
  chargement: boolean;
  onChangerRole: (role: string, motif: string) => void;
  onFermer: () => void;
}) {
  const [role, setRole] = useState(utilisateur.role);
  const [motif, setMotif] = useState("");

  return (
    <Modal ouvert={true} surFermeture={onFermer} titre={`Changer le rôle — ${utilisateur.email}`}>
      <div className="space-y-4">
        <p className="text-sm text-ardoise">
          Rôle actuel : <strong>{utilisateur.role}</strong>
        </p>
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Nouveau rôle</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
          >
            <option value="citoyen">Citoyen</option>
            <option value="agent">Agent administratif</option>
            <option value="medecin">Médecin</option>
            <option value="police">Forces de l'ordre</option>
            <option value="ong">ONG</option>
            <option value="administrateur">Administrateur</option>
            <option value="super_administrateur">Super administrateur</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Motif du changement</label>
          <input
            type="text"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            placeholder="Ex: Promu agent de mairie..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
          <Bouton variante="ghost" onClick={onFermer}>Annuler</Bouton>
          <Bouton variante="primaire" taille="petit" chargement={chargement} onClick={() => onChangerRole(role, motif)}>
            🎭 Changer le rôle
          </Bouton>
        </div>
      </div>
    </Modal>
  );
}

// ---- CRÉATION DE PROFIL ----
function CreationModal({
  chargement, onCreer, onFermer,
}: {
  chargement: boolean;
  onCreer: (d: CreerProfilRequete) => void;
  onFermer: () => void;
}) {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("agent");
  const [ville, setVille] = useState("Dakar");
  const [erreur, setErreur] = useState<string | null>(null);

  const ROLES_CREATION = [
    { role: "agent", libelle: "Agent administratif", icone: "🏛️" },
    { role: "medecin", libelle: "Médecin", icone: "🏥" },
    { role: "police", libelle: "Forces de l'ordre", icone: "👮" },
    { role: "ong", libelle: "ONG / Association", icone: "🤝" },
    { role: "administrateur", libelle: "Administrateur", icone: "⚙️" },
    { role: "super_administrateur", libelle: "Super administrateur", icone: "👑" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    // Validation simple côté client
    if (!email || !motDePasse || !prenom || !nom) {
      setErreur("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (motDePasse.length < 12) {
      setErreur("Le mot de passe doit faire au moins 12 caractères.");
      return;
    }
    if (prenom.length < 2 || nom.length < 2) {
      setErreur("Prénom et nom doivent faire au moins 2 caractères.");
      return;
    }

    onCreer({ email, mot_de_passe: motDePasse, prenom, nom, role, ville });
  };

  return (
    <Modal ouvert={true} surFermeture={onFermer} titre="Créer un profil" taille="grand">
      <form onSubmit={handleSubmit} className="space-y-3">
        {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold mb-2 block">Rôle du profil</label>
          <div className="grid grid-cols-3 gap-1.5">
            {ROLES_CREATION.map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => setRole(r.role)}
                className={`px-2 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                  role === r.role
                    ? "bg-ocre text-white border-ocre shadow-sm"
                    : "bg-white text-ardoise border-ardoise-clair/20 hover:border-ocre hover:text-ocre"
                }`}
              >
                <span className="block text-sm mb-0.5">{r.icone}</span>
                {r.libelle}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase text-ardoise-clair font-semibold">Prénom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
              minLength={2}
              className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-ardoise-clair font-semibold">Nom</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              minLength={2}
              className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            placeholder="exemple@domaine.sn"
          />
        </div>

        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Mot de passe</label>
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
            minLength={12}
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
          />
          <p className="text-xs text-ardoise-clair mt-1">
            12+ caractères avec majuscule, minuscule, chiffre et caractère spécial.
          </p>
        </div>

        <div>
          <label className="text-xs uppercase text-ardoise-clair font-semibold">Ville</label>
          <input
            type="text"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="w-full mt-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            placeholder="Dakar"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
          <Bouton type="button" variante="ghost" onClick={onFermer}>Annuler</Bouton>
          <Bouton type="submit" variante="primaire" chargement={chargement}>
            Créer le profil
          </Bouton>
        </div>
      </form>
    </Modal>
  );
}
