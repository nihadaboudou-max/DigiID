"use client";

/**
 * Page détails d'un administrateur — consultation et édition.
 */
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { useNotifications } from "@/contextes/notifications";
import { listerAdmins, suspendreAdmin, reactiverAdmin, type AdminApercu } from "@/services/super_admin";
import { reinitialiserMotDePasse, supprimerAdmin, basculer2FA, modifierAdmin } from "@/services/super_admin_v2";
import { ErreurAPI } from "@/services/client_api";

export default function PageDetailsAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const params = useParams();
  const adminId = params.id as string;
  const { notifier } = useNotifications();

  const [admin, setAdmin] = useState<AdminApercu | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState(false);
  const [modaleSuppressionOuverte, setModaleSuppressionOuverte] = useState(false);
  const [modaleResetMdpOuverte, setModaleResetMdpOuverte] = useState(false);
  const [resetMdpEnCours, setResetMdpEnCours] = useState(false);
  const [resetMdpResultat, setResetMdpResultat] = useState<string | null>(null);

  const [formulaire, setFormulaire] = useState({
    prenom: "",
    nom: "",
    ville: "",
  });

  useEffect(() => {
    const charger = async () => {
      try {
        const reponse = await listerAdmins();
        const found = reponse.administrateurs.find((a) => a.id === adminId);
        if (!found) {
          setErreur("Administrateur introuvable");
          return;
        }
        setAdmin(found);
        setFormulaire({
          prenom: found.prenom || "",
          nom: found.nom || "",
          ville: "", // À récupérer du backend si nécessaire
        });
      } catch (e) {
        const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
        setErreur(msg);
      } finally {
        setChargement(false);
      }
    };

    charger();
  }, [adminId]);

  const modifierChamp = (champ: keyof typeof formulaire) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormulaire((f) => ({ ...f, [champ]: e.target.value }));
    };
  };

  const gererSauvegarde = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resultat = await modifierAdmin(admin!.id, {
        prenom: formulaire.prenom,
        nom: formulaire.nom,
        ville: formulaire.ville,
      });
      setAdmin(resultat);
      setEnEdition(false);
      notifier("Administrateur modifie avec succes.", "succes");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la modification";
      notifier(msg, "erreur");
    }
  };

  const gererBascule = async () => {
    if (!admin) return;
    const verbe = admin.est_actif ? "suspendre" : "réactiver";
    if (!confirm(`Veux-tu vraiment ${verbe} cet administrateur ?`)) return;

    try {
      const maj = admin.est_actif
        ? await suspendreAdmin(admin.id)
        : await reactiverAdmin(admin.id);
      setAdmin(maj);
      notifier(
        `Administrateur ${maj.est_actif ? "réactivé" : "suspendu"}.`,
        maj.est_actif ? "succes" : "avertissement"
      );
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  };

  const gererSuppression = async () => {
    if (!admin) return;
    try {
      await supprimerAdmin(admin.id);
      notifier("Administrateur supprime avec succes.", "succes");
      setModaleSuppressionOuverte(false);
      router.push("/super-admin/administrateurs");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression";
      notifier(msg, "erreur");
    }
  };

  if (chargement) {
    return (
      <div className="space-y-4 apparition">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/super-admin/administrateurs">
            <Bouton variante="ghost" taille="petit">
              ← Retour
            </Bouton>
          </Link>
        </div>
        <p className="text-ardoise-clair italic text-center py-12">Chargement...</p>
      </div>
    );
  }

  if (erreur || !admin) {
    return (
      <div className="space-y-4 apparition">
        <Link href="/super-admin/administrateurs">
          <Bouton variante="ghost" taille="petit">
            ← Retour
          </Bouton>
        </Link>
        <Alerte variante="erreur" titre="Erreur">
          {erreur || "Administrateur introuvable"}
        </Alerte>
      </div>
    );
  }

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/super-admin/administrateurs">
            <p className="text-ocre text-sm font-semibold uppercase tracking-wider hover:underline">
              ← Administrateurs
            </p>
          </Link>
          <h1 className="mt-2">
            {admin.prenom} {admin.nom}
          </h1>
          <p className="text-ardoise-clair mt-1 font-mono text-sm">{admin.email}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {admin.role !== "super_administrateur" && (
            <>
              <Bouton
                variante="ghost"
                onClick={() => gererBascule()}
                className={admin.est_actif ? "!border-terre !text-terre" : ""}
              >
                {admin.est_actif ? "Suspendre" : "Réactiver"}
              </Bouton>
              <Bouton
                variante="ghost"
                onClick={() => setModaleSuppressionOuverte(true)}
                className="!border-terre !text-terre"
              >
                Supprimer
              </Bouton>
            </>
          )}
        </div>
      </div>

      {/* Informations principales */}
      <div className="grid md:grid-cols-3 gap-6">
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair mb-2">Rôle</p>
          <Badge
            variante={
              admin.role === "super_administrateur" ? "ocre" : "lagune"
            }
          >
            {admin.role === "super_administrateur" ? "Super administrateur" : "Administrateur"}
          </Badge>
        </Carte>

        <Carte>
          <p className="text-xs uppercase text-ardoise-clair mb-2">Statut</p>
          <Badge variante={admin.est_actif ? "succes" : "neutre"}>
            {admin.est_actif ? "Actif" : "Suspendu"}
          </Badge>
        </Carte>

        <Carte>
          <p className="text-xs uppercase text-ardoise-clair mb-2">2FA</p>
          <Badge variante={admin.deux_fa_active ? "succes" : "terre"}>
            {admin.deux_fa_active ? "Activée" : "Désactivée"}
          </Badge>
        </Carte>
      </div>

      {/* Dates */}
      <div className="grid md:grid-cols-2 gap-6">
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair mb-2">Créé le</p>
          <p className="text-lg font-semibold text-ardoise">
            {new Date(admin.date_creation).toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </Carte>

        <Carte>
          <p className="text-xs uppercase text-ardoise-clair mb-2">Dernière connexion</p>
          <p className="text-lg font-semibold text-ardoise">
            {admin.date_derniere_connexion
              ? new Date(admin.date_derniere_connexion).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Jamais"}
          </p>
        </Carte>
      </div>

      {/* Édition du profil */}
      <Carte titre="Profil" description="Modification des informations personnelles">
        <form onSubmit={gererSauvegarde} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <ChampSaisie
              libelle="Prénom"
              value={formulaire.prenom}
              onChange={modifierChamp("prenom")}
              disabled={!enEdition}
            />
            <ChampSaisie
              libelle="Nom"
              value={formulaire.nom}
              onChange={modifierChamp("nom")}
              disabled={!enEdition}
            />
          </div>

          <ChampSaisie
            libelle="Email"
            type="email"
            value={admin.email}
            disabled={true}
            aide="Non modifiable pour des raisons de sécurité"
          />

          <ChampSaisie
            libelle="Ville"
            value={formulaire.ville}
            onChange={modifierChamp("ville")}
            disabled={!enEdition}
          />

          <div className="flex gap-3 pt-4">
            {!enEdition ? (
              <Bouton
                type="button"
                variante="primaire"
                onClick={() => setEnEdition(true)}
              >
                Éditer
              </Bouton>
            ) : (
              <>
                <Bouton type="submit" variante="primaire">
                  Sauvegarder
                </Bouton>
                <Bouton
                  type="button"
                  variante="ghost"
                  onClick={() => setEnEdition(false)}
                >
                  Annuler
                </Bouton>
              </>
            )}
          </div>
        </form>
      </Carte>

      {/* Sécurité */}
      <Carte titre="Sécurité" description="Gestion du mot de passe et de l'authentification">
        <div className="space-y-3">
          <div className="p-4 bg-sable rounded-lg">
            <p className="text-sm text-ardoise-clair mb-2">Mot de passe</p>
            <p className="text-xs text-ardoise mb-3">
              Pour réinitialiser le mot de passe, utilise la fonction dédiée.
            </p>
                        <Bouton variante="ghost" onClick={() => setModaleResetMdpOuverte(true)}>
                Réinitialiser le mot de passe
            </Bouton>
          </div>

          <div className="p-4 bg-sable rounded-lg">
            <p className="text-sm text-ardoise-clair mb-2">Double authentification (2FA)</p>
            <p className="text-xs text-ardoise mb-3">
              Actuellement {admin.deux_fa_active ? "activée" : "désactivée"}.
            </p>
            <Bouton variante="ghost" onClick={async () => {
              try {
                const resultat = await basculer2FA(admin.id, !admin.deux_fa_active);
                setAdmin(resultat);
                notifier("2FA " + (resultat.deux_fa_active ? "activee" : "desactivee") + ".", "succes");
              } catch (e) {
                const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
                notifier(msg, "erreur");
              }
            }}>
              {admin.deux_fa_active ? "Desactiver" : "Activer"} le 2FA
            </Bouton>
          </div>
        </div>
      </Carte>

      {/* Sessions actives */}
      <Carte titre="Sessions actives" description="Appareils connectés actuellement">
        <div className="space-y-3">
          <p className="text-sm text-ardoise-clair">
            Consulte les appareils connectés et révoque les sessions si nécessaire.
          </p>
          <Link href={`/super-admin/administrateurs/${admin.id}/sessions`}>
            <Bouton variante="ghost">
              Voir les sessions actives →
            </Bouton>
          </Link>
        </div>
      </Carte>

      {/* Export des données de l'admin */}
      <Carte titre="Export" description="Téléchargement des données">
        <div className="space-y-3">
          <p className="text-sm text-ardoise-clair">
            Tu peux exporter les informations de cet administrateur au format CSV.
          </p>
          <Bouton
            variante="ghost"
            onClick={() => {
              const enTetes = ["Email", "Prénom", "Nom", "Rôle", "Statut", "2FA", "Date création", "Dernière connexion"];
              const lignes = [[
                admin.email,
                admin.prenom || "",
                admin.nom || "",
                admin.role,
                admin.est_actif ? "Actif" : "Suspendu",
                admin.deux_fa_active ? "Oui" : "Non",
                new Date(admin.date_creation).toLocaleDateString("fr-FR"),
                admin.date_derniere_connexion
                  ? new Date(admin.date_derniere_connexion).toLocaleDateString("fr-FR")
                  : "",
              ]];
              const csv = [enTetes.join(","), ...lignes.map((l) => l.join(","))].join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `admin-${admin.email}-${new Date().toISOString().split("T")[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              notifier("Données exportées en CSV.", "succes");
            }}
          >
            Exporter en CSV
          </Bouton>
        </div>
      </Carte>

      {/* Modale réinitialisation mot de passe */}
      <Modal
        ouvert={modaleResetMdpOuverte}
        surFermeture={() => {
          setModaleResetMdpOuverte(false);
          setResetMdpResultat(null);
        }}
        titre="Réinitialiser le mot de passe"
        description={`Pour ${admin.prenom} ${admin.nom}`}
        taille="moyen"
      >
        <div className="space-y-4">
          {resetMdpResultat ? (
            <>
              <Alerte variante="succes">
                Nouveau mot de passe temporaire généré. Communique-le par un canal sécurisé.
              </Alerte>
              <div className="p-6 bg-sable rounded-lg text-center">
                <p className="text-xs uppercase text-ardoise-clair mb-2">Mot de passe temporaire</p>
                <code className="text-lg font-mono font-bold text-lagune break-all select-all">
                  {resetMdpResultat}
                </code>
              </div>
              <div className="bg-ocre/10 p-4 rounded-lg border border-ocre/20">
                <p className="text-xs text-ocre font-semibold mb-1">⚠️ Important</p>
                <p className="text-xs text-ardoise-clair">
                  Ce mot de passe ne sera plus affiché après la fermeture de cette fenêtre.
                  L'administrateur devra le changer à sa prochaine connexion.
                </p>
              </div>
              <Bouton
                type="button"
                variante="primaire"
                onClick={() => {
                  setModaleResetMdpOuverte(false);
                  setResetMdpResultat(null);
                }}
              >
                Fermer
              </Bouton>
            </>
          ) : (
            <>
              <Alerte variante="avertissement" titre="Action sensible">
                Tu t'apprêtes à réinitialiser le mot de passe de {admin.prenom} {admin.nom}.
                Il devra utiliser un mot de passe temporaire à sa prochaine connexion.
              </Alerte>
              <p className="text-sm text-ardoise-clair">
                Un nouveau mot de passe temporaire sera généré. Tu devras le communiquer par
                un canal sécurisé (téléphone, en main propre). Il expirera à la première
                authentification.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <Bouton
                  type="button"
                  variante="ghost"
                  onClick={() => setModaleResetMdpOuverte(false)}
                >
                  Annuler
                </Bouton>
                <Bouton
                  type="button"
                  variante="primaire"
                  chargement={resetMdpEnCours}
                  onClick={async () => {
                    setResetMdpEnCours(true);
                    try {
                    const reponse = await reinitialiserMotDePasse(admin.id);
                    setResetMdpResultat(reponse.nouveau_mot_de_passe);
                    } catch (e) {
                      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
                      notifier(msg, "erreur");
                    } finally {
                      setResetMdpEnCours(false);
                    }
                  }}
                >
                  Générer le mot de passe
                </Bouton>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modale de suppression */}
      <Modal
        ouvert={modaleSuppressionOuverte}
        surFermeture={() => setModaleSuppressionOuverte(false)}
        titre="Supprimer l'administrateur"
        description="Cette action est irréversible."
        taille="moyen"
      >
        <div className="space-y-4">
          <Alerte variante="erreur" titre="Action critique">
            Tu t'apprêtes à supprimer le compte de {admin.prenom} {admin.nom}. Cette action
            est immuable et sera tracée dans le journal d'audit.
          </Alerte>

          <p className="text-sm text-ardoise-clair">
            Cet administrateur n'aura plus accès au système. Ses actions passées resteront dans
            l'audit.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Bouton
              type="button"
              variante="ghost"
              onClick={() => setModaleSuppressionOuverte(false)}
            >
              Annuler
            </Bouton>
            <Bouton
              type="button"
              variante="ghost"
              onClick={gererSuppression}
              className="!border-terre !text-terre"
            >
              Supprimer définitivement
            </Bouton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
