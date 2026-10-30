"use client";

import { CagnotteContenu } from "@/composants/logistique/CagnotteContenu";
import { ROLES_CAGNOTTE_COMMERCANT } from "@/composants/logistique/roles";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageCommissionsCommercant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CAGNOTTE_COMMERCANT}>
      <CagnotteContenu
        titre="Mes commissions"
        sousTitre="Consultez les commissions générées par vos dépôts de colis."
      />
    </EnvelopperEspaceProtege>
  );
}
