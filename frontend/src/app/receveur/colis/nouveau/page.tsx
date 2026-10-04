"use client";
/**
 * Enregistrement d'un colis au guichet (S3).
 */
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { EnregistrementColis } from "@/composants/logistique/EnregistrementColis";
import { ROLES_GUICHET_ECRITURE } from "@/composants/logistique/roles";

export default function PageNouveauColis() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET_ECRITURE}>
      <div className="space-y-6 apparition">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-ardoise">Enregistrer un colis</h1>
          <p className="text-sm text-ardoise-clair">
            Renseignez le destinataire et le trajet : un ticket avec QR Code sera généré.
          </p>
        </div>

        <EnregistrementColis />

        <Carte variante="pointilles">
          <p className="text-xs text-ardoise-clair">
            <strong className="text-ardoise">Astuce :</strong> après l&apos;enregistrement,
            imprimez le ticket et collez-le sur le colis. Le QR Code permet de suivre le colis
            jusqu&apos;à sa remise au destinataire.
          </p>
        </Carte>
      </div>
    </EnvelopperEspaceProtege>
  );
}
