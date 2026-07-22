"use client";

/**
 * Détail d'un enrôlement — actions : modifier, valider, rejeter.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import type { Enrolement } from "@/services/enrolement";

export default function DetailEnrolementPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [enrolement, setEnrolement] = useState<Enrolement | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { charger(); }, [id]);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const e = await clientAPI.get<Enrolement>(`/api/v1/enrolement/${id}`, { authentifie: true });
      setEnrolement(e);
      setNotes(e.notes || "");
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Impossible de charger l'enrôlement");
    } finally {
      setChargement(false);
    }
  }

  async function mettreAJour(donnees: Record<string, unknown>) {
    setEnvoi(true);
    setMessage("");
    setErreur("");
    try {
      const e = await clientAPI.patch<Enrolement>(`/api/v1/enrolement/${id}`, donnees, { authentifie: true });
      setEnrolement(e);
      setMessage("Enrôlement mis à jour !");
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (erreur && !enrolement) {
    return (
      <div className="space-y-8 apparition">
        <Alerte variante="erreur">{erreur}</Alerte>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  if (!enrolement) return null;

  const statutBadge = (s: string) => {
    if (s === "valide") return <Badge variante="succes">Validé</Badge>;
    if (s === "rejete") return <Badge variante="terre">Rejeté</Badge>;
    return <Badge variante="ocre">En attente</Badge>;
  };

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/agent/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <Link href="/agent/enrolement" className="hover:text-ocre">Enrôlement</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Détail</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
          <h1 className="mt-1">
            {enrolement.citoyen_prenom} {enrolement.citoyen_nom}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {statutBadge(enrolement.statut)}
        </div>
      </div>

      {message && <Alerte variante="succes">{message}</Alerte>}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Identité du citoyen">
          <div className="space-y-3">
            <ChampDetail libelle="Nom complet" valeur={`${enrolement.citoyen_prenom} ${enrolement.citoyen_nom}`} />
            <ChampDetail libelle="Téléphone" valeur={enrolement.citoyen_telephone || "—"} />
            <ChampDetail libelle="Email" valeur={enrolement.citoyen_email || "—"} />
            {enrolement.citoyen_digiid && (
              <ChampDetail libelle="DigiID" valeur={enrolement.citoyen_digiid} mono />
            )}
            <ChampDetail libelle="Date d'enrôlement" valeur={new Date(enrolement.date_enrolement).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
            })} />
            {enrolement.date_validation && (
              <ChampDetail libelle="Date de validation" valeur={new Date(enrolement.date_validation).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric"
              })} />
            )}
          </div>
        </Carte>

        <Carte titre="Vérifications">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 p-3 bg-sable rounded-lg">
              <span className="text-sm text-ardoise">Scan CNI</span>
              <div className="flex items-center gap-2">
                <Badge variante={enrolement.scan_cni ? "succes" : "neutre"}>
                  {enrolement.scan_cni ? "Effectué" : "Non effectué"}
                </Badge>
                {!enrolement.scan_cni && enrolement.statut === "en_attente" && (
                  <Link href={`/agent/scan?enrolement_id=${enrolement.id}`}>
                    <Bouton variante="secondaire" taille="petit">Scanner</Bouton>
                  </Link>
                )}
                {!enrolement.scan_cni && enrolement.statut === "en_attente" && (
                  <Bouton
                    variante="ghost"
                    taille="petit"
                    disabled={envoi}
                    onClick={() => mettreAJour({ scan_cni: true })}
                  >
                    Marquer fait
                  </Bouton>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-3 bg-sable rounded-lg">
              <span className="text-sm text-ardoise">Capture biométrique</span>
              <div className="flex items-center gap-2">
                <Badge variante={enrolement.capture_biometrique ? "succes" : "neutre"}>
                  {enrolement.capture_biometrique ? "Effectuée" : "Non effectuée"}
                </Badge>
                {!enrolement.capture_biometrique && enrolement.statut === "en_attente" && (
                  <Link href={`/agent/capture?enrolement_id=${enrolement.id}`}>
                    <Bouton variante="secondaire" taille="petit">Capturer</Bouton>
                  </Link>
                )}
                {!enrolement.capture_biometrique && enrolement.statut === "en_attente" && (
                  <Bouton
                    variante="ghost"
                    taille="petit"
                    disabled={envoi}
                    onClick={() => mettreAJour({ capture_biometrique: true })}
                  >
                    Marquer fait
                  </Bouton>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-sable rounded-lg">
              <span className="text-sm text-ardoise">Statut</span>
              {statutBadge(enrolement.statut)}
            </div>
          </div>
        </Carte>
      </div>

      <Carte titre="Notes">
        {enrolement.statut === "en_attente" ? (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
              placeholder="Ajouter des notes..."
            />
            <Bouton variante="secondaire" taille="petit" disabled={envoi} onClick={() => mettreAJour({ notes })}>
              {envoi ? "Enregistrement..." : "Enregistrer les notes"}
            </Bouton>
          </div>
        ) : (
          <p className="text-sm text-ardoise-clair">{enrolement.notes || "Aucune note."}</p>
        )}
      </Carte>

      {/* Actions */}
      {enrolement.statut === "en_attente" && (
        <Carte titre="Actions">
          <div className="flex flex-wrap gap-3">
            <Bouton
              variante="primaire"
              chargement={envoi && message === ""}
              disabled={envoi}
              onClick={() => mettreAJour({ statut: "valide" })}
            >
              Valider l&apos;enrôlement
            </Bouton>
            <Bouton
              variante="ghost"
              className="!border-terre !text-terre hover:!bg-terre hover:!text-white"
              disabled={envoi}
              onClick={() => mettreAJour({ statut: "rejete" })}
            >
              Rejeter
            </Bouton>
          </div>
        </Carte>
      )}

      <Link href="/agent/dashboard"><Bouton variante="ghost">← Retour au tableau de bord</Bouton></Link>
    </div>
  );
}

function ChampDetail({ libelle, valeur, mono }: { libelle: string; valeur: string; mono?: boolean }) {
  return (
    <div className="pb-2 border-b border-ardoise-clair/10 last:border-0">
      <p className="text-xs text-ardoise-clair uppercase tracking-wide">{libelle}</p>
      <p className={`font-medium text-ardoise mt-0.5 ${mono ? "font-mono" : ""}`}>{valeur}</p>
    </div>
  );
}
