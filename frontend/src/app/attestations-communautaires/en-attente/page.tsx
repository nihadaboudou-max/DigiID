/**
 * Page Attestations en Attente — Liste des attestations reçues à traiter.
 * 
 * Affiche uniquement les attestations avec le statut EN_ATTENTE
 * pour que l'utilisateur puisse les approuver ou les refuser rapidement.
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ListeAttestations } from "@/composants/attestations-communautaires";

/**
 * Page des attestations en attente de décision.
 * Filtre automatiquement sur le statut "EN_ATTENTE".
 */
export default function PageAttestationsEnAttente() {
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
      <ListeAttestations
        direction="recues"
        titre="Attestations en attente"
        description="Ces attestations n'attendent que toi ! Approuve ou refuse les attestations que tu as reçues."
        nomPersonne="Attestant"
      />
    </EnvelopperEspaceProtege>
  );
}
