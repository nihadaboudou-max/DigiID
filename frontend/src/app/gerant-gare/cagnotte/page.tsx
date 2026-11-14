"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { CagnotteContenu } from "@/composants/logistique/CagnotteContenu";
import { ROLES_GERANT_GARE } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";

export default function PageCagnotteGérant() {
  const { utilisateur } = useAuthentification();

  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GERANT_GARE}>
      <CagnotteContenu
        titre="Ma cagnotte"
        sousTitre="Vos gains et vos dépenses."
        paginationServeur={utilisateur?.role === "gerant_gare"}
      />
    </EnvelopperEspaceProtege>
  );
}
