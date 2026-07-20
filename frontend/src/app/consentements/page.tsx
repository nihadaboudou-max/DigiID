"use client";

/**
 * Page Consentements — Phase 2 : vraies données depuis l'API backend.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { Bouton } from "@/composants/commun/Bouton";
import { useNotifications } from "@/contextes/notifications";
import {
  basculerConsentement,
  listerMesConsentements,
  obtenirConsentementDetail,
  type ConsentementDetail,
  type ConsentementTexteLegal,
} from "@/services/consentements";
import { ErreurAPI } from "@/services/client_api";

export default function PageConsentements() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[      
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [consentements, setConsentements] = useState<ConsentementDetail[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [details, setDetails] = useState<ConsentementTexteLegal | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);

  useEffect(() => {
    listerMesConsentements()
      .then((r) => setConsentements(r.consentements))
      .catch((e) => {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
      })
      .finally(() => setChargement(false));
  }, []);

  async function basculer(categorie: string, donne_actuel: boolean) {
    try {
      const nouveau = await basculerConsentement(categorie, !donne_actuel);
      setConsentements((liste) =>
        liste.map((c) => (c.categorie === categorie ? nouveau : c))
      );
      notifier(
        nouveau.est_accorde
          ? `Consentement accordé pour : ${nouveau.titre}`
          : `Consentement retiré pour : ${nouveau.titre}`,
        nouveau.est_accorde ? "succes" : "avertissement",
      );
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  }

  async function ouvrirDetail(categorie: string) {
    setChargementDetail(true);
    try {
      const detail = await obtenirConsentementDetail(categorie);
      setDetails(detail);
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    } finally {
      setChargementDetail(false);
    }
  }

  if (chargement) {
    return <p className="text-ardoise-clair italic">Chargement de tes consentements...</p>;
  }

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mes autorisations
        </p>
        <h1 className="mt-1">Consentements</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Pour chaque catégorie de donnée, tu décides. Tu peux revenir sur tes choix à tout
          moment — c'est ton droit, garanti par la loi 2008-12.
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <Alerte variante="info" titre="Comment lire cette page">
        Les consentements <strong>obligatoires</strong> sont nécessaires pour que DigiID fonctionne.
        Les consentements <strong>facultatifs</strong> améliorent ton score ou ajoutent des
        fonctionnalités, mais tu peux refuser sans pénalité.
      </Alerte>

      <div className="space-y-4">
        {consentements.map((c) => (
          <Carte key={c.categorie} className={c.est_accorde ? "" : "opacity-90"}>
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="!mb-0">{c.titre}</h3>
                  {c.obligatoire && <Badge variante="terre">Obligatoire</Badge>}
                  {!c.obligatoire && c.est_accorde && <Badge variante="succes">Accordé</Badge>}
                  {!c.obligatoire && !c.est_accorde && <Badge variante="neutre">Refusé</Badge>}
                </div>
                <p className="text-sm text-ardoise-clair">{c.description}</p>
                {c.date_accord && c.est_accorde && (
                  <p className="text-xs text-ardoise-clair italic mt-2">
                    Accordé le {new Date(c.date_accord).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
              <Interrupteur
                actif={c.est_accorde}
                desactive={c.obligatoire}
                surBascule={() => basculer(c.categorie, c.est_accorde)}
                libelle={c.titre}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-ardoise-clair/10">
              <button
                type="button"
                onClick={() => ouvrirDetail(c.categorie)}
                disabled={chargementDetail}
                className="text-xs text-lagune hover:text-lagune-clair font-medium"
              >
                Lire le texte légal complet →
              </button>
            </div>
          </Carte>
        ))}
      </div>

      <Carte variante="pointilles" titre="Tes droits sur tes consentements">
        <ul className="space-y-2 text-sm text-ardoise">
          <li>✓ Tu peux retirer un consentement à tout moment (effet immédiat).</li>
          <li>✓ Le retrait n'a aucune conséquence pénalisante pour toi.</li>
          <li>✓ Tu peux exporter la liste de tes consentements actifs depuis ton profil.</li>
          <li>✓ En cas de litige, la CDP (Commission de Protection des Données) est compétente.</li>
        </ul>
      </Carte>

      <Modal
        ouvert={details !== null}
        surFermeture={() => setDetails(null)}
        titre={details?.titre}
        description="Texte légal complet"
        taille="grand"
      >
        <div className="space-y-4">
          <p className="text-sm text-ardoise leading-relaxed bg-sable-clair p-4 rounded-lg whitespace-pre-line">
            {details?.texte_legal}
          </p>
          <p className="text-xs text-ardoise-clair italic">
            Référence légale : loi 2008-12 du Sénégal (art. 33), Code numérique du Bénin (loi 2017-20).
            Version du texte : {details?.version}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Bouton variante="ghost" onClick={() => setDetails(null)}>
              Fermer
            </Bouton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Interrupteur({ actif, desactive, surBascule, libelle }: {
  actif: boolean; desactive: boolean; surBascule: () => void; libelle: string;
}) {
  return (
    <button
      type="button"
      onClick={surBascule}
      disabled={desactive}
      aria-label={`Consentement : ${libelle}`}
      className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${
        actif ? "bg-lagune" : "bg-ardoise-clair/30"
      } ${desactive ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`block w-5 h-5 bg-white rounded-full absolute top-1 shadow transition-all ${
          actif ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}
