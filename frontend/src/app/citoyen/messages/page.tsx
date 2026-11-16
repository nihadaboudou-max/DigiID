"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeCloche, IconeColis, IconeFlecheRetour, IconeVue } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import {
  listerMesNotifications,
  marquerNotificationLue,
  type NotificationDetail,
} from "@/services/gamification";
import { ErreurAPI } from "@/services/client_api";

const TAILLE_PAGE = 5;

function codeSuivi(notification: NotificationDetail): string | null {
  if (!notification.lien_action) return null;
  try {
    const url = new URL(notification.lien_action, window.location.origin);
    const chemin = url.pathname;
    const correspondance = chemin.match(/\/suivi\/([^/]+)$/);
    return correspondance
      ? decodeURIComponent(correspondance[1])
      : url.searchParams.get("colis");
  } catch {
    return null;
  }
}

export default function PageMessagesCitoyen() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState("");
  const [codesReveles, setCodesReveles] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [chargementAction, setChargementAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await listerMesNotifications(false, {
        page,
        parPage: TAILLE_PAGE,
        recherche,
        categorie: "logistique_colis,logistique_suivi",
      });
      setNotifications(resultat.notifications);
      setTotal(resultat.total);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger tes messages. Réessaie dans un instant.",
      );
    } finally {
      setChargement(false);
    }
  }, [page, recherche]);

  useEffect(() => {
    const minuteur = window.setTimeout(() => void charger(), 250);
    return () => window.clearTimeout(minuteur);
  }, [charger]);

  useEffect(() => {
    setCodesReveles({});
  }, [page, recherche]);

  async function ouvrirEnvoi(notification: NotificationDetail) {
    setChargementAction(notification.id);
    setErreur(null);
    try {
      if (!notification.est_lue) await marquerNotificationLue(notification.id);
      const code = codeSuivi(notification);
      if (notification.categorie === "logistique_suivi" && code) {
        router.push(`/suivi/${encodeURIComponent(code)}`);
      } else {
        router.push(
          code ? `/citoyen/envois?code=${encodeURIComponent(code)}` : "/citoyen/envois",
        );
      }
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible d'ouvrir ce message. Réessaie.",
      );
    } finally {
      setChargementAction(null);
    }
  }

  async function revelerCode(notification: NotificationDetail) {
    setChargementAction(notification.id);
    setErreur(null);
    try {
      const resultat = await listerMesNotifications(false, {
        page,
        parPage: TAILLE_PAGE,
        categorie: notification.categorie,
        recherche,
        revelerCodeNotificationId: notification.id,
      });
      const codeRemise = resultat.code_remise;
      if (codeRemise === null) {
        throw new Error("Le code de remise n'est plus disponible.");
      }
      setCodesReveles((actuels) => ({
        ...actuels,
        [notification.id]: codeRemise,
      }));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : e instanceof Error
            ? e.message
            : "Impossible d'afficher le code de remise.",
      );
    } finally {
      setChargementAction(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <div className="space-y-5 apparition">
      <header>
        <p className="text-ocre font-semibold uppercase tracking-wide">Mes informations</p>
        <h1 className="mt-1">Messages</h1>
        <p className="mt-1 text-ardoise-clair">
          Les nouvelles de tes colis et des passagers suivis.
        </p>
      </header>

      <Carte>
        <label htmlFor="recherche-messages" className="mb-2 block font-semibold text-ardoise">
          Rechercher un message
        </label>
        <input
          id="recherche-messages"
          value={recherche}
          onChange={(event) => {
            setRecherche(event.target.value);
            setPage(1);
          }}
          placeholder="Tape un mot ou un code"
          className="champ-saisie min-h-14"
        />
      </Carte>

      {erreur && <Alerte variante="erreur" titre="Action impossible">{erreur}</Alerte>}

      <section aria-label="Messages logistiques" className="space-y-3">
        {chargement ? (
          <Carte><p className="py-4 text-center text-ardoise-clair">Chargement des messages…</p></Carte>
        ) : notifications.length === 0 ? (
          <Carte>
            <p className="text-center text-ardoise">
              Aucun message de colis ou de passager pour le moment.
            </p>
            <div className="mt-4 flex justify-center">
              <Bouton
                type="button"
                variante="secondaire"
                taille="grand"
                onClick={() => router.push("/citoyen/envois")}
              >
                <IconeColis className="h-5 w-5" aria-hidden="true" />
                Voir mes envois
              </Bouton>
            </div>
          </Carte>
        ) : (
          notifications.map((notification) => {
            const estCodeRemise = notification.titre.toLowerCase().includes("code de remise");
            const estSuiviFamilial = notification.categorie === "logistique_suivi";
            const code = codesReveles[notification.id];
            return (
              <Carte
                key={notification.id}
                className={`space-y-3 ${notification.est_lue ? "" : "border-l-4 border-l-lagune"}`}
              >
                <div className="flex items-start gap-3">
                  <IconeCloche className="mt-1 h-6 w-6 shrink-0 text-lagune" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ardoise">{notification.titre}</p>
                    <p className="mt-1 text-ardoise-clair">{notification.message}</p>
                    {!notification.est_lue && (
                      <p className="mt-1 font-semibold text-lagune">Nouveau message</p>
                    )}
                    {estCodeRemise && (
                      <p className="mt-2 font-semibold text-ardoise">
                        Code de remise : {code ?? "••••••"}
                      </p>
                    )}
                    <time className="mt-2 block text-sm text-ardoise-clair" dateTime={notification.cree_le}>
                      {new Date(notification.cree_le).toLocaleString("fr-FR")}
                    </time>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Bouton
                    type="button"
                    taille="grand"
                    className="flex-1"
                    disabled={chargementAction === notification.id}
                    onClick={() => void ouvrirEnvoi(notification)}
                  >
                    <IconeColis className="h-5 w-5" aria-hidden="true" />
                    {estSuiviFamilial ? "Ouvrir le suivi du passager" : "Ouvrir dans Mes envois"}
                  </Bouton>
                  {estCodeRemise && !code && (
                    <Bouton
                      type="button"
                      variante="ghost"
                      taille="grand"
                      disabled={chargementAction === notification.id}
                      onClick={() => void revelerCode(notification)}
                    >
                      <IconeVue className="h-5 w-5" aria-hidden="true" />
                      Afficher
                    </Bouton>
                  )}
                </div>
              </Carte>
            );
          })
        )}
      </section>

      <nav aria-label="Pagination des messages" className="flex flex-wrap items-center justify-between gap-3">
        <Bouton
          type="button"
          variante="ghost"
          disabled={page <= 1 || chargement}
          onClick={() => setPage((courante) => Math.max(1, courante - 1))}
        >
          <IconeFlecheRetour className="h-5 w-5" aria-hidden="true" />
          Précédent
        </Bouton>
        <span className="font-semibold text-ardoise">Page {page} sur {totalPages}</span>
        <Bouton
          type="button"
          variante="ghost"
          disabled={page >= totalPages || chargement}
          onClick={() => setPage((courante) => Math.min(totalPages, courante + 1))}
        >
          Suivant
          <IconeFlecheRetour className="h-5 w-5 rotate-180" aria-hidden="true" />
        </Bouton>
      </nav>
    </div>
  );
}
