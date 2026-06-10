/**
 * Page Nouvelle Attestation — Formulaire de création d'attestation.
 * 
 * Permet à l'utilisateur de créer une attestation communautaire
 * envers un autre membre de DigiID.
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { FormulaireAttestation } from "@/composants/attestations-communautaires";

/**
 * Page de création d'une nouvelle attestation.
 */
export default function PageNouvelleAttestation() {
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
      <FormulaireAttestation />
    </EnvelopperEspaceProtege>
  );
}
