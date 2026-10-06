"use client";
/**
 * Ma carte DigiID — le socle de tout le système.
 *
 * Deux idées fortes, contrairement au QR dynamique de 30 secondes :
 *
 *  1. **Ce QR est permanent.** Il ne change pas, ne s'expire pas, et peut être
 *     photographié sans risque : il ne sert qu'à *pré-remplir* une fiche au
 *     guichet (colis, billet, enfant confié). Il n'autorise aucune action seul.
 *  2. **Mes voyages.** Tous les envois dont je suis expéditeur ou destinataire,
 *     et tous les passagers dont je suis responsable, acheteur ou proche de
 *     confiance — avec un lien direct vers la page de suivi.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDateHeure, urlImageQR } from "@/composants/logistique/format";
import { TOUS_LES_ROLES } from "@/composants/logistique/roles";
import { ErreurAPI } from "@/services/client_api";
import { identiteAPI, type CarteDigiID, type VoyageCitoyen } from "@/services/identite_api";

export default function PageMaCarteDigiID() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={TOUS_LES_ROLES}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [carte, setCarte] = useState<CarteDigiID | null>(null);
  const [colis, setColis] = useState<VoyageCitoyen[]>([]);
  const [passagers, setPassagers] = useState<VoyageCitoyen[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        // La carte est indispensable ; la liste des voyages est un bonus :
        // on ne bloque pas l'affichage de la carte si elle échoue.
        const carteChargee = await identiteAPI.carte.obtenir();
        if (annule) return;
        setCarte(carteChargee);

        const voyages = await identiteAPI.mesVoyages().catch(() => null);
        if (annule || !voyages) return;
        setColis(voyages.colis);
        setPassagers(voyages.passagers);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger votre carte DigiID.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  async function copierLien() {
    if (!carte) return;
    try {
      await navigator.clipboard.writeText(carte.qr_code_url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  }

  if (chargement) {
    return (
      <p className="text-ardoise-clair italic py-12 text-center">
        Chargement de votre carte…
      </p>
    );
  }

  if (erreur || !carte) {
    return (
      <Alerte variante="erreur" titre="Carte indisponible">
        {erreur ?? "Carte introuvable."}
      </Alerte>
    );
  }

  const imageQR = urlImageQR(carte.qr_code_url);

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Ma carte DigiID</h1>
        <p className="text-sm text-ardoise-clair">
          Présentez ce QR Code au guichet : votre fiche se remplit automatiquement,
          sans ressaisie et sans erreur de numéro de téléphone.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Carte (QR permanent) ─────────────────────────────────── */}
        <Carte titre="Carte d'identité numérique">
          <div className="flex flex-col items-center gap-4">
            {imageQR ? (
              <div className="bg-white p-3 rounded-xl border-2 border-lagune/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageQR}
                  alt="QR Code de ma carte DigiID"
                  className="w-56 h-56"
                />
              </div>
            ) : (
              <p className="text-sm text-ardoise-clair italic">
                QR indisponible — utilisez votre DigiID ci-dessous.
              </p>
            )}

            <div className="w-full text-center space-y-1">
              <p className="text-lg font-bold text-ardoise">{carte.nom_complet}</p>
              {carte.digiid_public && (
                <p className="font-mono text-sm text-lagune tracking-widest">
                  {carte.digiid_public}
                </p>
              )}
              <p className="text-sm text-ardoise-clair">
                {carte.telephone ?? "Téléphone non renseigné"}
                {carte.ville ? ` · ${carte.ville}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center no-print">
              <Bouton variante="secondaire" taille="petit" onClick={() => void copierLien()}>
                {copie ? "Lien copié ✓" : "Copier le lien de la carte"}
              </Bouton>
              <Bouton
                variante="ghost"
                taille="petit"
                onClick={() => window.print()}
              >
                Imprimer
              </Bouton>
            </div>

            {!carte.deja_genere && (
              <Alerte variante="info">
                Votre carte vient d'être créée. Elle est désormais <strong>permanente</strong> :
                vous pouvez la photographier ou l'imprimer, elle restera valable.
              </Alerte>
            )}
          </div>
        </Carte>

        {/* ─── Explication du modèle de sécurité ────────────────────── */}
        <Carte titre="Comment ça marche ?">
          <ul className="text-sm text-ardoise space-y-3">
            <li>
              <strong>Ce QR ne change jamais.</strong> Il est stocké sur votre compte
              DigiID et reste scannable indéfiniment — contrairement au code affiché
              pour un contrôle de police, qui expire en 30 secondes.
            </li>
            <li>
              <strong>Il ne donne aucun droit.</strong> Le guichet obtient uniquement
              votre nom, votre téléphone et votre ville — jamais vos emails, vos
              documents ni votre photo.
            </li>
            <li>
              <strong>Il évite les erreurs de saisie.</strong> C'est ce qui garantit
              que les SMS de suivi (départ, arrivée) partent vers le bon numéro.
            </li>
            <li>
              <strong>Pas de compte ?</strong> Le guichet peut toujours créer la fiche
              manuellement ; la carte est un confort, jamais une obligation.
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <Link href="/logistique/profil">
              <Bouton variante="ghost" taille="petit">
                Mon dossier professionnel (chauffeur / receveur)
              </Bouton>
            </Link>
          </div>
        </Carte>
      </div>

      {/* ─── Mes voyages ──────────────────────────────────────────── */}
      <Carte
        titre="Mes voyages"
        description="Vos envois et les passagers dont vous êtes responsable — chaque ligne mène au suivi."
      >
        {colis.length === 0 && passagers.length === 0 ? (
          <p className="text-sm italic text-ardoise-clair">
            Aucun voyage pour le moment. Dès qu'un colis vous est adressé ou que vous
            enregistrez un passager, il apparaîtra ici.
          </p>
        ) : (
          <div className="space-y-6">
            <TableauVoyages
              titre="Mes envois (colis)"
              lignes={colis}
              messageVide="Aucun colis dont vous êtes expéditeur ou destinataire."
            />
            <TableauVoyages
              titre="Mes passagers"
              lignes={passagers}
              messageVide="Aucun passager dont vous êtes responsable."
            />
          </div>
        )}
      </Carte>
    </div>
  );
}

/** Tableau compact « mes voyages » (colis ou passagers). */
function TableauVoyages({
  titre,
  lignes,
  messageVide,
}: {
  titre: string;
  lignes: VoyageCitoyen[];
  messageVide: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ardoise mb-2">
        {titre} <span className="text-ardoise-clair">({lignes.length})</span>
      </h4>
      {lignes.length === 0 ? (
        <p className="text-sm italic text-ardoise-clair">{messageVide}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ardoise-clair/20 text-left text-xs uppercase tracking-wider text-ardoise-clair">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Pour</th>
                <th className="py-2 pr-3">Trajet</th>
                <th className="py-2 pr-3">Départ</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={`${ligne.type}-${ligne.id}`} className="border-b border-ardoise-clair/10">
                  <td className="py-2 pr-3 font-mono text-xs text-ardoise">
                    {ligne.code}
                  </td>
                  <td className="py-2 pr-3 text-ardoise">{ligne.libelle}</td>
                  <td className="py-2 pr-3 text-ardoise-clair">
                    {ligne.gare_depart_nom ?? "?"} → {ligne.gare_arrivee_nom ?? "?"}
                  </td>
                  <td className="py-2 pr-3 text-ardoise-clair">
                    {formaterDateHeure(ligne.date_depart)}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variante="info">{ligne.statut}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {ligne.lien && (
                      <Link
                        href={ligne.lien}
                        className="text-lagune hover:underline text-xs font-medium"
                      >
                        Suivre
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
