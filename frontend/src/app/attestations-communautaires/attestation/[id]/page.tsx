/**
 * Page Détail d'une Attestation — Consultation et actions.
 * 
 * Affiche le détail complet d'une attestation et permet :
 *   - À l'attesté : approuver ou refuser (si en attente)
 *   - À l'attestant : modifier ou supprimer (si en attente)
 *   - À tous : consulter les informations
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { DetailAttestation } from "@/composants/attestations-communautaires";
import { useAuthentification } from "@/contextes/authentification";
import {
  obtenirDetailAttestation,
  type AttestationDetail,
} from "@/services/attestations_communautaires";
import { ErreurAPI } from "@/services/client_api";

/**
 * Page de détail d'une attestation communautaire.
 * Récupère l'attestation par son ID depuis l'URL.
 */
export default function PageDetailAttestation() {
  // Récupérer l'ID depuis l'URL
  const params = useParams();
  const attestationId = params.id as string;

  // Contexte utilisateur
  const { utilisateur } = useAuthentification();

  // État local
  const [attestation, setAttestation] = useState<AttestationDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Charger l'attestation
  const charger = useCallback(async () => {
    if (!attestationId) return;

    setChargement(true);
    setErreur(null);
    try {
      const donnees = await obtenirDetailAttestation(attestationId);
      setAttestation(donnees);
    } catch (e) {
      if (e instanceof ErreurAPI) {
        if (e.code_http === 404) {
          setErreur("Attestation introuvable.");
        } else if (e.code_http === 403) {
          setErreur("Vous n'êtes pas autorisé à consulter cette attestation.");
        } else {
          setErreur(e.message_utilisateur);
        }
      } else {
        setErreur("Erreur de chargement de l'attestation.");
      }
    } finally {
      setChargement(false);
    }
  }, [attestationId]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen",
        "agent",
        "medecin",
        "police",
        "ong",
        "administrateur",
        "super_administrateur",
      ]}
    >
      {/* État de chargement */}
      {chargement && (
        <div className="space-y-6 animate-pulse apparition">
          <div className="h-8 bg-sable rounded-lg w-1/3" />
          <div className="h-48 bg-sable rounded-xl" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-32 bg-sable rounded-xl" />
            <div className="h-32 bg-sable rounded-xl" />
          </div>
          <div className="h-40 bg-sable rounded-xl" />
        </div>
      )}

      {/* État d'erreur */}
      {!chargement && erreur && (
        <div className="space-y-4 aparition">
          <Alerte variante="erreur" titre="Erreur">
            {erreur}
          </Alerte>
          <Bouton variante="secondaire" onClick={charger}>
            Réessayer
          </Bouton>
        </div>
      )}

      {/* Détail de l'attestation */}
      {!chargement && !erreur && attestation && utilisateur && (
        <DetailAttestation
          attestation={attestation}
          utilisateurId={utilisateur.id}
          onRafraichir={charger}
        />
      )}
    </EnvelopperEspaceProtege>
  );
}
