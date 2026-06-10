"use client";

/**
 * Page gestion des sessions actives d'un administrateur.
 * Permet de voir et révoquer les sessions (forcer déconnexion).
 */
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import { useNotifications } from "@/contextes/notifications";
import { listerSessionsAdmin, revoquerSessionAdmin, type SessionAdmin } from "@/services/super_admin_v2";
import { ErreurAPI } from "@/services/client_api";

export default function PageSessions() {
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

  const [sessions, setSessions] = useState<SessionAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sessionARevoquer, setSessionARevoquer] = useState<SessionAdmin | null>(null);
  const [revocationEnCours, setRevocationEnCours] = useState(false);

  useEffect(() => {
    const charger = async () => {
      try {
        const reponse = await listerSessionsAdmin(adminId);
        setSessions(reponse.sessions);
      } catch (e) {
        const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement";
        setErreur(msg);
      } finally {
        setChargement(false);
      }
    };

    charger();
  }, [adminId]);

  const gererRevocation = async () => {
    if (!sessionARevoquer) return;

    setRevocationEnCours(true);
    try {
      await revoquerSessionAdmin(adminId, sessionARevoquer.id);
      setSessions((liste) => liste.filter((s) => s.id !== sessionARevoquer.id));
      notifier("Session révoquée — l'appareil sera déconnecté.", "succes");
      setSessionARevoquer(null);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    } finally {
      setRevocationEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div className="space-y-4 apparition">
        <Link href={`/super-admin/administrateurs/${adminId}`}>
          <Bouton variante="ghost" taille="petit">
            ← Retour
          </Bouton>
        </Link>
        <p className="text-ardoise-clair italic text-center py-12">Chargement des sessions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/super-admin/administrateurs/${adminId}`}>
          <Bouton variante="ghost" taille="petit">
            ← Retour
          </Bouton>
        </Link>
        <div>
          <h1>Sessions actives</h1>
          <p className="text-ardoise-clair text-sm mt-1">
            Appareils connectés actuellement. Vous pouvez révoquer une session pour forcer la
            déconnexion.
          </p>
        </div>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {sessions.length === 0 ? (
        <Carte>
          <div className="text-center py-12">
            <p className="text-ardoise-clair italic">Aucune session active actuellement.</p>
          </div>
        </Carte>
      ) : (
        <>
          <Alerte variante="info">
            Cet administrateur a <strong>{sessions.length}</strong> session
            {sessions.length > 1 ? "s" : ""} active
            {sessions.length > 1 ? "s" : ""}.
          </Alerte>

          <div className="space-y-3">
            {sessions.map((session) => (
              <Carte key={session.id}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variante="succes" taille="petit">
                        ✓ Actif
                      </Badge>
                      <span className="text-xs font-mono text-ardoise-clair bg-sable px-2 py-1 rounded">
                        {session.id.substring(0, 8)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-ardoise-clair font-semibold">
                          IP
                        </span>
                        <code className="font-mono text-sm text-ardoise bg-sable px-2 py-1 rounded">
                          {session.adresse_ip}
                        </code>
                      </div>

                      {session.agent_utilisateur && (
                        <div>
                          <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">
                            Appareil
                          </p>
                          <p className="text-sm text-ardoise bg-sable px-3 py-2 rounded break-all">
                            {session.agent_utilisateur}
                          </p>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs">
                        <div>
                          <p className="text-ardoise-clair font-semibold mb-1">Connecté le</p>
                          <p className="text-ardoise">
                            {new Date(session.cree_le).toLocaleString("fr-FR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-ardoise-clair font-semibold mb-1">Dernière utilisation</p>
                          <p className="text-ardoise">
                            {new Date(session.date_derniere_utilisation).toLocaleString("fr-FR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Bouton
                    variante="ghost"
                    onClick={() => setSessionARevoquer(session)}
                    className="!border-terre !text-terre"
                  >
                    Révoquer
                  </Bouton>
                </div>
              </Carte>
            ))}
          </div>
        </>
      )}

      {/* Modale de revocation */}
      <ModalConfirmation
        ouvert={sessionARevoquer !== null}
        titre="Révoquer la session"
        description="Forcer la déconnexion de l'appareil"
        messageAlerte="Cet administrateur sera déconnecté de cet appareil immédiatement. Une reconnexion sera nécessaire."
        varianteAlerte="avertissement"
        varianteBoutonConfirmer="ghost"
        couleurBoutonConfirmer="terre"
        texteBoutonAnnuler="Annuler"
        texteBoutonConfirmer="Révoquer la session"
        chargement={revocationEnCours}
        contenuCorps={
          sessionARevoquer && (
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-ardoise-clair font-semibold mb-1">IP</p>
                <code className="bg-sable px-2 py-1 rounded font-mono text-ardoise">
                  {sessionARevoquer.adresse_ip}
                </code>
              </div>
              {sessionARevoquer.agent_utilisateur && (
                <div>
                  <p className="text-xs text-ardoise-clair font-semibold mb-1">Appareil</p>
                  <p className="text-ardoise-clair">{sessionARevoquer.agent_utilisateur}</p>
                </div>
              )}
            </div>
          )
        }
        surAnnulation={() => setSessionARevoquer(null)}
        surConfirmation={gererRevocation}
      />
    </div>
  );
}
