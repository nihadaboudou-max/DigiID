"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { CagnotteContenu } from "@/composants/logistique/CagnotteContenu";
import { ROLES_GERANT_GARE } from "@/composants/logistique/roles";

export default function PageCagnotteGérant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GERANT_GARE}>
      <CagnotteContenu
        titre="Ma cagnotte"
        sousTitre="Vos gains de commission et l'historique de votre portefeuille."
      />
    </EnvelopperEspaceProtege>
  );
}
