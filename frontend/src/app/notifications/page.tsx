"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import {
  IconeCheck,
  IconeCloche,
  IconeVue,
} from "@/composants/commun/Icones";
import {
  listerMesNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
  type NotificationDetail,
} from "@/services/gamification";
import { ErreurAPI } from "@/services/client_api";

const TAILLE_PAGE = 10;
const ROLES_AUTORISES = [
  "citoyen",
  "administrateur",
  "super_administrateur",
  "super_admin",
  "admin_domaine",
  "chef_police",
  "chef_medical",
  "chef_ong",
  "chef_agent",
  "agent_police",
  "agent_medical",
  "agent_ong",
  "agent_terrain",
  "gerant_gare",
  "receveur",
  "chauffeur",
  "commercant",
];

export default function PageNotifications() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_AUTORISES}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [nonLues, setNonLues] = useState(0);
  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await listerMesNotifications(false, {
        page,
        parPage: TAILLE_PAGE,
        recherche,
      });
      setNotifications(resultat.notifications);
      setTotal(resultat.total);
      setNonLues(resultat.non_lues);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger les notifications.",
      );
    } finally {
      setChargement(false);
    }
  }, [page, recherche]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function ouvrir(notification: NotificationDetail) {
    setActionEnCours(notification.id);
    setErreur(null);
    try {
      if (!notification.est_lue) {
        await marquerNotificationLue(notification.id);
      }
      await charger();
      if (notification.lien_action) {
        const cible = new URL(notification.lien_action, window.location.origin);
        if (cible.origin === window.location.origin) {
          router.push(`${cible.pathname}${cible.search}${cible.hash}`);
        }
      }
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible d'ouvrir cette notification.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  async function toutMarquerCommeLu() {
    setActionEnCours("tout");
    setErreur(null);
    try {
      await marquerToutesNotificationsLues();
      await charger();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de mettre à jour les notifications.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <div className="space-y-5 apparition">
      <header>
        <p className="text-ocre font-semibold uppercase tracking-wide">
          Mes informations
        </p>
        <h1 className="mt-1">Notifications</h1>
        <p className="mt-1 text-ardoise-clair">
          Les mises à jour de tes colis, passagers et activités.
        </p>
      </header>

      <Carte>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex-1 font-semibold text-ardoise" htmlFor="recherche-notifications">
            Rechercher une notification
            <input
              id="recherche-notifications"
              value={recherche}
              onChange={(event) => {
                setRecherche(event.target.value);
                setPage(1);
              }}
              className="champ-saisie mt-2"
              placeholder="Titre ou contenu"
            />
          </label>
          <Bouton
            type="button"
            variante="ghost"
            disabled={nonLues === 0 || actionEnCours === "tout"}
            chargement={actionEnCours === "tout"}
            onClick={() => void toutMarquerCommeLu()}
          >
            <IconeCheck className="h-4 w-4" />
            Tout marquer comme lu
          </Bouton>
        </div>
      </Carte>

      {erreur && (
        <Alerte variante="erreur" titre="Notifications indisponibles">
          {erreur}
        </Alerte>
      )}

      <section aria-label="Liste des notifications" className="space-y-3">
        {chargement ? (
          <Carte>
            <p className="py-4 text-center text-ardoise-clair">
              Chargement des notifications…
            </p>
          </Carte>
        ) : notifications.length === 0 ? (
          <Carte>
            <div className="flex items-center justify-center gap-2 py-4 text-center text-ardoise-clair">
              <IconeCloche className="h-5 w-5" />
              <p>Aucune notification pour le moment.</p>
            </div>
          </Carte>
        ) : (
          notifications.map((notification) => (
            <Carte
              key={notification.id}
              className={
                notification.est_lue
                  ? "space-y-3"
                  : "space-y-3 border-l-4 border-l-lagune bg-lagune/5"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-ardoise">
                    {notification.titre}
                  </h2>
                  <p className="mt-1 text-xs text-ardoise-clair">
                    {new Date(notification.cree_le).toLocaleString("fr-FR")}
                    {!notification.est_lue && " · Non lue"}
                  </p>
                </div>
                <span className="rounded-full bg-sable px-2.5 py-1 text-xs text-ardoise-clair">
                  {notification.categorie.replace(/_/g, " ")}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-ardoise">
                {notification.message}
              </p>
              {(notification.lien_action || !notification.est_lue) && (
                <Bouton
                  type="button"
                  variante="secondaire"
                  taille="petit"
                  chargement={actionEnCours === notification.id}
                  onClick={() => void ouvrir(notification)}
                >
                  <IconeVue className="h-4 w-4" />
                  {notification.lien_action ? "Consulter" : "Marquer comme lue"}
                </Bouton>
              )}
            </Carte>
          ))
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Bouton
            type="button"
            variante="ghost"
            disabled={page <= 1 || chargement}
            onClick={() => setPage((valeur) => Math.max(1, valeur - 1))}
          >
            Précédent
          </Bouton>
          <span className="text-sm text-ardoise-clair">
            Page {page} / {totalPages}
          </span>
          <Bouton
            type="button"
            variante="ghost"
            disabled={page >= totalPages || chargement}
            onClick={() => setPage((valeur) => Math.min(totalPages, valeur + 1))}
          >
            Suivant
          </Bouton>
        </div>
      )}
    </div>
  );
}
