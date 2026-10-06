
"use client";
/**
 * Carte DigiID scannée — la page qui s'ouvre quand un agent scanne la carte
 * d'un client avec l'appareil photo de son téléphone.
 *
 * Le QR de la carte encode `/guichet/carte?token=…`. On arrive donc ici avec le
 * jeton dans l'URL, on résout la carte côté serveur, et on propose immédiatement
 * les deux suites utiles : **enregistrer un colis** ou **enregistrer un
 * passager**, avec la fiche pré-remplie.
 *
 * Un simple passant qui scannerait la carte sans être connecté comme agent
 * logistique ne verra qu'un message d'accès refusé.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis, IconeIdentite } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { RechercheCarteDigiID } from "@/composants/logistique/RechercheCarteDigiID";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
import type { ContactDigiID } from "@/services/identite_api";

export default function PageCarteScanneeGuichet() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <Suspense
        fallback={
          <p className="text-ardoise-clair italic py-12 text-center">
            Lecture de la carte…
          </p>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const searchParams = useSearchParams();
  // La carte encode ?token=… ; on tolère ?digiid=… pour les liens manuels.
  const code = searchParams.get("token") ?? searchParams.get("digiid") ?? "";
  const [contact, setContact] = useState<ContactDigiID | null>(null);

  // On préfère le DigiID public (stable) au jeton de QR pour la suite du parcours.
  const referenceParcours = contact?.digiid_public ?? code;

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Carte DigiID scannée</h1>
        <p className="text-sm text-ardoise-clair">
          Vérifiez que la carte correspond bien à la personne en face de vous,
          puis choisissez la fiche à pré-remplir.
        </p>
      </div>

      <RechercheCarteDigiID
        rechercheInitiale={code || undefined}
        titre="Carte du client"
        description="Le QR de la carte a été lu automatiquement. Si besoin, saisissez un DigiID ou scannez une autre carte."
        surSelection={setContact}
      />

      {contact ? (
        <>
          <Carte titre="Client identifié" variante="accent">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Info libelle="Nom complet" valeur={contact.nom_complet} />
              <Info
                libelle="Téléphone"
                valeur={contact.telephone ?? "Non renseigné"}
              />
              <Info libelle="Ville" valeur={contact.ville ?? "—"} />
              <Info libelle="DigiID" valeur={contact.digiid_public ?? "—"} />
              {contact.adresse && (
                <Info libelle="Adresse" valeur={contact.adresse} />
              )}
            </dl>
            <div className="mt-3">
              <Badge variante="lagune">
                {contact.correspondance === "qr"
                  ? "Carte reconnue par son QR"
                  : "Carte reconnue par son DigiID"}
              </Badge>
            </div>
          </Carte>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href={`/receveur/colis/nouveau?digiid=${encodeURIComponent(referenceParcours)}`}
              className="carte-accent hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-lagune/10 text-lagune flex items-center justify-center flex-shrink-0">
                  <IconeColis className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-ardoise">
                    Enregistrer un colis pour ce client
                  </p>
                  <p className="text-xs text-ardoise-clair mt-0.5">
                    La fiche expéditeur (nom + téléphone) sera déjà remplie.
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href={`/receveur/suivi-familial/nouveau?digiid=${encodeURIComponent(referenceParcours)}`}
              className="carte hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-ocre/15 text-ocre-fonce flex items-center justify-center flex-shrink-0">
                  <IconeIdentite className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-ardoise">
                    Enregistrer un passager pour ce client
                  </p>
                  <p className="text-xs text-ardoise-clair mt-0.5">
                    Le responsable (nom + téléphone) sera déjà rempli — les SMS
                    partiront au bon numéro.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </>
      ) : (
        <Alerte variante="info" titre="Aucune carte lue">
          Scannez la carte DigiID du client (ou saisissez son DigiID ci-dessus), ou
          continuez en saisie manuelle : la carte est un confort, jamais une
          obligation.
        </Alerte>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/receveur/colis/nouveau">
          <Bouton variante="ghost" taille="petit">
            Enregistrer un colis sans carte
          </Bouton>
        </Link>
        <Link href="/receveur/suivi-familial/nouveau">
          <Bouton variante="ghost" taille="petit">
            Enregistrer un passager sans carte
          </Bouton>
        </Link>
      </div>
    </div>
  );
}

/** Ligne libellé/valeur de la fiche client. */
function Info({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
        {libelle}
      </dt>
      <dd className="text-ardoise">{valeur}</dd>
    </div>
  );
}
