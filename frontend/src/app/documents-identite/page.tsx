"use client";

/**
 * Page Documents d'Identité — CNI, Permis de Conduire, Assurance.
 * Mise à jour pour utiliser les nouveaux modules OCR dédiés.
 */
import { useCallback, useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";

// ✅ IMPORTS DES NOUVEAUX SERVICES DÉDIÉS
import { 
  obtenirHistoriquePermis, 
  type VerificationPermisDetail 
} from "@/services/permis_conduire";
import { 
  obtenirHistoriqueAssurance, 
  type VerificationAssuranceDetail 
} from "@/services/assurance_auto";

type OngletType = "cni" | "permis" | "assurance";

const LIBELLES_TYPE_DOCUMENT: Record<OngletType, string> = {
  cni: "Carte Nationale d'Identité",
  permis: "Permis de Conduire",
  assurance: "Assurance Automobile",
};

const ICONES_TYPE_DOCUMENT: Record<OngletType, string> = {
  cni: "🆔",
  permis: "🚗",
  assurance: "🛡️",
};

const COULEURS_BORDURE: Record<OngletType, string> = {
  cni: "border-lagune",
  permis: "border-amber-500",
  assurance: "border-green-500",
};

export default function PageDocumentsIdentite() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical",
        "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine",
        "administrateur", "super_administrateur"
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<OngletType>("cni");
  
  // ✅ États spécifiques pour chaque type de document
  const [permis, setPermis] = useState<VerificationPermisDetail | null>(null);
  const [assurance, setAssurance] = useState<VerificationAssuranceDetail | null>(null);
  // (Tu peux ajouter l'état CNI ici si tu as un service dédié, sinon on le garde en placeholder)
  const [cni, setCni] = useState<any>(null); 

  const chargerDocuments = useCallback(async () => {
    setChargement(true);
    try {
      // Appel parallèle aux nouvelles API dédiées
      const [resPermis, resAssurance] = await Promise.allSettled([
        obtenirHistoriquePermis(1), // On récupère le plus récent
        obtenirHistoriqueAssurance(1)
      ]);

      if (resPermis.status === "fulfilled" && resPermis.value.historique.length > 0) {
        setPermis(resPermis.value.historique[0]);
      } else {
        setPermis(null);
      }

      if (resAssurance.status === "fulfilled" && resAssurance.value.historique.length > 0) {
        setAssurance(resAssurance.value.historique[0]);
      } else {
        setAssurance(null);
      }
      
      // Placeholder pour la CNI (à adapter avec ton vrai service CNI)
      setCni(null); 

    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement des documents";
      notifier(msg, "erreur");
    } finally {
      setChargement(false);
    }
  }, [notifier]);

  useEffect(() => {
    chargerDocuments();
  }, [chargerDocuments]);

  // Déterminer le document actif en fonction de l'onglet
  const docActif = onglet === "permis" ? permis : onglet === "assurance" ? assurance : cni;
  const aUnDocument = !!docActif;

  return (
    <div className="space-y-8 apparition max-w-5xl mx-auto">
      {/* En-tête */}
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mon identité
        </p>
        <h1 className="mt-1 text-2xl font-bold text-ardoise">Mes documents d'identité</h1>
        <p className="text-ardoise-clair mt-2 max-w-3xl">
          Consulte les données officielles extraites automatiquement par l'OCR. 
          Ces informations sont verrouillées pour garantir l'intégrité et la traçabilité de ton identité numérique.
        </p>
      </header>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-ardoise-clair/10 pb-2 overflow-x-auto">
        {(["cni", "permis", "assurance"] as const).map((type) => {
          const aDoc = type === "permis" ? !!permis : type === "assurance" ? !!assurance : !!cni;
          return (
            <button
              key={type}
              onClick={() => setOnglet(type)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all whitespace-nowrap text-sm font-medium ${
                onglet === type
                  ? "bg-ocre/10 text-ocre border-b-2 border-ocre"
                  : "text-ardoise-clair hover:text-ardoise hover:bg-sable/50"
              }`}
            >
              <span className="text-lg">{ICONES_TYPE_DOCUMENT[type]}</span>
              <span>{LIBELLES_TYPE_DOCUMENT[type]}</span>
              {aDoc && <Badge variante="succes" taille="petit">✓</Badge>}
            </button>
          );
        })}
      </div>

      {chargement ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {aUnDocument ? (
            <VueDocument 
              typeDocument={onglet} 
              document={docActif!} 
              onSupprimer={async () => {
                // Note: La suppression réelle devra être implémentée dans les services dédiés
                notifier("Fonction de suppression à implémenter dans le service dédié", "info");
              }}
            />
          ) : (
            <Alerte variante="info" titre={`Aucun ${LIBELLES_TYPE_DOCUMENT[onglet].toLowerCase()} enregistré`}>
              <p className="mb-3">
                Tu n'as pas encore scanné ce document. Les données seront extraites automatiquement 
                et de manière sécurisée via notre moteur OCR.
              </p>
              <Bouton 
                variante="primaire" 
                onClick={() => {
                  // Redirection vers la page d'upload dédiée
                  window.location.href = onglet === "permis" ? "/permis-conduire" : "/assurance-auto";
                }}
              >
                📷 Scanner mon document
              </Bouton>
            </Alerte>
          )}

          {/* Impact score */}
          <Carte variante="pointilles" titre="📊 Impact sur ton score DigiID">
            <div className="space-y-2 text-sm">
              <p className="text-ardoise">
                Chaque document vérifié améliore ton score de confiance :
              </p>
              <ul className="space-y-1.5 text-ardoise-clair">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-lagune" />
                  <strong>CNI authentifiée</strong> — jusqu&apos;à <strong className="text-lagune">4 pts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <strong>Permis de conduire</strong> — jusqu&apos;à <strong className="text-amber-600">3 pts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <strong>Assurance valide</strong> — jusqu&apos;à <strong className="text-green-600">2 pts</strong>
                </li>
              </ul>
            </div>
          </Carte>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Vue d'un document existant (Lecture seule des données OCR)
// =============================================================================
function VueDocument({
  typeDocument,
  document,
  onSupprimer,
}: {
  typeDocument: OngletType;
  document: any; // Typé 'any' ici pour accepter PermisDetail ou AssuranceDetail
  onSupprimer: () => Promise<void>;
}) {
  // Définition des champs à afficher selon le type de document
  const champsOfficiels = typeDocument === "permis" 
    ? [
        { key: "numero_permis", libelle: "N° Permis" },
        { key: "categories", libelle: "Catégories", isList: true },
        { key: "date_delivrance", libelle: "Délivré le", isDate: true },
        { key: "date_expiration", libelle: "Expire le", isDate: true, checkExpiration: true },
      ]
    : typeDocument === "assurance"
    ? [
        { key: "compagnie_assurance", libelle: "Compagnie d'assurance" },
        { key: "numero_contrat", libelle: "N° Contrat / Police" },
        { key: "immatriculation_vehicule", libelle: "Immatriculation" },
        { key: "marque_vehicule", libelle: "Marque du véhicule" },
        { key: "date_expiration", libelle: "Valable jusqu'au", isDate: true, checkExpiration: true },
      ]
    : []; // Ajouter les champs CNI ici

  const modifDate = new Date(document.cree_le).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className={`bg-white rounded-xl border border-ardoise-clair/20 shadow-sm border-l-4 ${COULEURS_BORDURE[typeDocument]} p-6`}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-lagune/10 text-lagune border border-lagune/20">
              {ICONES_TYPE_DOCUMENT[typeDocument]} Extrait par OCR
            </span>
            <Badge variante={document.statut === "approuve" ? "succes" : "ocre"}>
              {document.statut === "approuve" ? "Validé" : "En attente"}
            </Badge>
          </div>
          <h3 className="text-lg font-bold text-ardoise">
            {LIBELLES_TYPE_DOCUMENT[typeDocument]}
          </h3>
        </div>
        <Bouton
          variante="danger"
          taille="petit"
          onClick={async () => {
            if (confirm(`Supprimer ce document et ses données associées ?`)) {
              await onSupprimer();
            }
          }}
        >
          🗑️ Supprimer
        </Bouton>
      </div>

      {/* Grille des champs officiels (lecture seule) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {champsOfficiels.map((champ) => {
          const valeur = document[champ.key];
          if (!valeur) return null;
          
          let valeurAffichee: string | React.ReactNode = String(valeur);
          
          // Formatage des listes (ex: catégories de permis)
          if (champ.isList && Array.isArray(valeur)) {
            valeurAffichee = (
              <div className="flex flex-wrap gap-1">
                {valeur.map((cat: string, i: number) => (
                  <Badge key={i} variante="lagune" taille="petit">{cat}</Badge>
                ))}
              </div>
            );
          }
          
          // Formatage des dates
          if (champ.isDate && typeof valeur === "string") {
            try {
              const date = new Date(valeur);
              valeurAffichee = date.toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric",
              });
            } catch {
              valeurAffichee = String(valeur);
            }
          }
          
          // Alerte d'expiration
          let alerteExpiration = null;
          if (champ.checkExpiration && typeof valeur === "string") {
            try {
              const dateExp = new Date(valeur);
              const joursRestants = Math.ceil((dateExp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (joursRestants < 0) {
                alerteExpiration = (
                  <span className="block mt-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-1 rounded">
                    ⚠️ Expiré depuis {Math.abs(joursRestants)} jours
                  </span>
                );
              } else if (joursRestants < 90) {
                alerteExpiration = (
                  <span className="block mt-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded">
                    ⚠️ Expire dans {joursRestants} jours
                  </span>
                );
              }
            } catch { /* Ignore */ }
          }
          
          return (
            <div key={champ.key} className="bg-sable/30 rounded-lg p-4 border border-ardoise-clair/10">
              <p className="text-[10px] uppercase text-ardoise-clair font-bold tracking-wider mb-1.5 flex items-center gap-1">
                <span>🔒</span> {champ.libelle}
              </p>
              <div className="text-sm font-semibold text-ardoise break-words">
                {valeurAffichee}
              </div>
              {alerteExpiration}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-ardoise-clair/10 flex flex-wrap gap-4 text-xs text-ardoise-clair">
        <span>📅 Ajouté le {modifDate}</span>
        <span>🔒 Source: Extraction OCR automatique</span>
      </div>
    </div>
  );
}