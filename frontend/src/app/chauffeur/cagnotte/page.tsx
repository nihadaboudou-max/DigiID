"use client";
/**
 * « Ma cagnotte » — espace chauffeur (S4 + S6).
 *
 * Le chauffeur enregistre lui-même les clients montés en route
 * (`/chauffeur/colis/nouveau`) : chaque colis ainsi créé lui reverse sa
 * commission, exactement comme au guichet. Sa cagnotte est la même que celle du
 * receveur — mais elle lui appartient, et il la consulte depuis **son** espace
 * (plus de lien « receveur » dans le menu chauffeur).
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { CagnotteContenu } from "@/composants/logistique/CagnotteContenu";
import { ROLES_CAGNOTTE } from "@/composants/logistique/roles";

export default function PageCagnotteChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CAGNOTTE}>
      <CagnotteContenu
        titre="Ma cagnotte"
        sousTitre="Vos gains sur les colis que vous enregistrez en route, et l'historique de votre portefeuille."
        messageVide="Aucun mouvement pour l'instant. Enregistrez un colis depuis « Enregistrer un client » : votre commission est créditée dès l'encaissement au guichet."
      />
    </EnvelopperEspaceProtege>
  );
}
