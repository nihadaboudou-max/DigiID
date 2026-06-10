/**
 * Page Attestations Envoyées — Liste des attestations écrites par l'utilisateur.
 * 
 * Affiche la liste paginée avec filtres des attestations que l'utilisateur
 * connecté a écrites pour les autres membres de la communauté.
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ListeAttestations } from "@/composants/attestations-communautaires";

/**
 * Page des attestations envoyées par l'utilisateur.
 */
export default function PageAttestationsEnvoyees() {
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
        direction="envoyees"
        titre="Attestations envoyées"
        description="Retrouve toutes les attestations que tu as écrites. Suis leur statut (en attente, approuvée, refusée)."
        nomPersonne="Attesté"
      />
    </EnvelopperEspaceProtege>
  );
}
