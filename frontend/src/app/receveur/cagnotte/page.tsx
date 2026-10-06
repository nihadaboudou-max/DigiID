"use client";
/**
 * Page « Ma cagnotte » — espace receveur / gérant de gare (S6).
 *
 * Le contenu est mutualisé (`CagnotteContenu`) : receveur, chauffeur et
 * commerçant disposent chacun de la même cagnotte ; seuls le titre et
 * l'explication changent.
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { CagnotteContenu } from "@/composants/logistique/CagnotteContenu";
import { ROLES_CAGNOTTE } from "@/composants/logistique/roles";

export default function PageCagnotte() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CAGNOTTE}>
      <CagnotteContenu
        titre="Ma cagnotte"
        sousTitre="Vos gains de commission et l'historique de votre portefeuille."
      />
    </EnvelopperEspaceProtege>
  );
}
