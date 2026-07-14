"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface Attestation {
  id: string;
  type: string;
  titre: string;
  attestant_nom: string;
  date_soumission: string;
  forces: string;
  statut: string;
}

export default function OngAttestationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      // ✅ On récupère la réponse brute en 'any' pour éviter les erreurs TS
      const response: any = await clientAPI.get("/api/v1/attestations/mes-attestations", { authentifie: true });
      
      // ✅ On sécurise l'extraction du tableau
      const dataArray = Array.isArray(response) ? response : (response.attestations || response.data || []);
      setAttestations(dataArray);
    } catch (error: any) {
      setErreur(error?.message || "Impossible de charger vos attestations");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  const getTypeBadgeColor = (type: string): "lagune" | "succes" | "ocre" | "terre" => {
    const colors: Record<string, "lagune" | "succes" | "ocre" | "terre"> = {
      "identite": "lagune",
      "competence": "succes",
      "moralite": "ocre",
      "residence": "terre",
      "activite": "lagune",
      "personnalise": "lagune",
    };
    return colors[type] || "lagune";
  };

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Attestations</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Agent ONG</p>
        <h1 className="mt-1 text-2xl">Attestations reçues</h1>
        <p className="text-ardoise-clair mt-1 text-sm">
          Certificats et recommandations de votre réseau de confiance.
        </p>
      </div>

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : attestations.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📜</p>
            <p className="text-ardoise-clair italic">Aucune attestation reçue pour le moment.</p>
            <p className="text-xs text-ardoise-clair mt-2">
              Les attestations apparaîtront ici une fois que des personnes de confiance vous auront recommandé.
            </p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-3">
          {attestations.map((attestation) => (
            <Carte key={attestation.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-ardoise">{attestation.titre}</h3>
                    <Badge variante={getTypeBadgeColor(attestation.type)}>
                      {attestation.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-ardoise-clair mb-2">
                    <strong>Attestant :</strong> {attestation.attestant_nom}
                  </p>
                  {attestation.forces && (
                    <p className="text-sm text-ardoise mb-2">
                      <strong>Forces/Qualités :</strong> {attestation.forces}
                    </p>
                  )}
                  <p className="text-xs text-ardoise-clair">
                    Soumise le {new Date(attestation.date_soumission).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge variante="succes">✓ Approuvée</Badge>
              </div>
            </Carte>
          ))}
        </div>
      )}

      <Link href="/ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}