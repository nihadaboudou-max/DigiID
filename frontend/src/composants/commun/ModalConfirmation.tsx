import { Modal } from "./Modal";
import { Alerte } from "./Alerte";
import { Bouton } from "./Bouton";

interface ProprietesModalConfirmation {
  ouvert: boolean;
  titre: string;
  description?: string;
  messageAlerte?: string;
  varianteAlerte?: "succes" | "avertissement" | "erreur" | "info";
  contenuCorps?: React.ReactNode;
  texteBoutonAnnuler?: string;
  texteBoutonConfirmer?: string;
  varianteBoutonConfirmer?: "primaire" | "ghost";
  couleurBoutonConfirmer?: "lagune" | "ocre" | "terre" | "succes";
  chargement?: boolean;
  desactive?: boolean;
  surAnnulation: () => void;
  surConfirmation: () => void | Promise<void>;
}

/**
 * ModalConfirmation — composant réutilisable pour les confirmations critiques.
 * Utilisé pour les suppressions, changements d'état, etc.
 */
export function ModalConfirmation({
  ouvert,
  titre,
  description,
  messageAlerte,
  varianteAlerte = "avertissement",
  contenuCorps,
  texteBoutonAnnuler = "Annuler",
  texteBoutonConfirmer = "Confirmer",
  varianteBoutonConfirmer = "primaire",
  couleurBoutonConfirmer,
  chargement = false,
  desactive = false,
  surAnnulation,
  surConfirmation,
}: ProprietesModalConfirmation) {
  const gererConfirmation = async () => {
    await surConfirmation();
  };

  const couleurClasses =
    couleurBoutonConfirmer === "terre"
      ? "!border-terre !text-terre hover:!bg-terre/10"
      : couleurBoutonConfirmer === "ocre"
      ? "!border-ocre !text-ocre hover:!bg-ocre/10"
      : couleurBoutonConfirmer === "succes"
      ? "!border-green-600 !text-green-600 hover:!bg-green-600/10"
      : "";

  return (
    <Modal
      ouvert={ouvert}
      surFermeture={surAnnulation}
      titre={titre}
      description={description}
      taille="moyen"
    >
      <div className="space-y-4">
        {messageAlerte && (
          <Alerte variante={varianteAlerte} titre="Attention">
            {messageAlerte}
          </Alerte>
        )}

        {contenuCorps && <div>{contenuCorps}</div>}

        <div className="flex justify-end gap-3 pt-4 border-t border-ardoise-clair/10">
          <Bouton
            type="button"
            variante="ghost"
            onClick={surAnnulation}
            disabled={chargement || desactive}
          >
            {texteBoutonAnnuler}
          </Bouton>
          <Bouton
            type="button"
            variante={varianteBoutonConfirmer}
            onClick={gererConfirmation}
            chargement={chargement}
            disabled={desactive}
            className={couleurClasses}
          >
            {texteBoutonConfirmer}
          </Bouton>
        </div>
      </div>
    </Modal>
  );
}
