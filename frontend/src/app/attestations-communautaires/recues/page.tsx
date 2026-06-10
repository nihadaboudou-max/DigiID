/**
 * Page Attestations Reçues — Liste des attestations reçues par l'utilisateur.
 * 
 * Affiche la liste paginée avec filtres des attestations que d'autres
 * membres de la communauté ont écrites pour l'utilisateur connecté.
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ListeAttestations } from "@/composants/attestations-communautaires";

/**
 * Page des attestations reçues par l'utilisateur.
 */
export default function PageAttestationsRecues() {
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
        titre="Attestations reçues"
        description="Consulte les attestations que les autres membres de la communauté ont écrites pour toi. Approuve ou refuse celles qui sont en attente."
        nomPersonne="Attestant"
      />
    </EnvelopperEspaceProtege>
  );
}
