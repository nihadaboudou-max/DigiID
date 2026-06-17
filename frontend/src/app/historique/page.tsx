"use client";

/**
 * Page Historique — journal d'activité personnel de l'utilisateur.
 * Données provenant du journal d'audit backend (JournalAudit).
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Alerte } from "@/composants/commun/Alerte";
import {
  obtenirMonActivite,
  type ActiviteUtilisateur,
} from "@/services/profil";
import { ErreurAPI } from "@/services/client_api";

const MAP_TYPE: Record<string, { libelle: string; variante: "lagune" | "ocre" | "succes" | "terre" | "neutre" }> = {
  connexion: { libelle: "Connexion", variante: "lagune" },
  inscription: { libelle: "Inscription", variante: "succes" },
  deconnexion: { libelle: "Déconnexion", variante: "neutre" },
  modification_profil: { libelle: "Modification", variante: "ocre" },
  modification_mot_de_passe: { libelle: "Mot de passe", variante: "ocre" },
  consentement_accorde: { libelle: "Consentement", variante: "succes" },
  consentement_retire: { libelle: "Consentement retiré", variante: "terre" },
  activation_2fa: { libelle: "2FA activée", variante: "succes" },
  desactivation_2fa: { libelle: "2FA désactivée", variante: "ocre" },
  calcul_score: { libelle: "Score", variante: "ocre" },
  consultation_profil: { libelle: "Consultation", variante: "lagune" },
  export_donnees: { libelle: "Export", variante: "lagune" },
  suppression_profil: { libelle: "Suppression", variante: "terre" },
  upload_photo: { libelle: "Photo uploadée", variante: "succes" },
  verification_visuelle: { libelle: "Vérif. faciale", variante: "lagune" },
  verification_cni: { libelle: "Vérif. CNI", variante: "lagune" },
  verification_email: { libelle: "Email vérifié", variante: "succes" },
  verification_2fa_echouee: { libelle: "Échec 2FA", variante: "terre" },
  partage_qr: { libelle: "Partage QR", variante: "lagune" },
};

function formaterType(type: string): { libelle: string; variante: "lagune" | "ocre" | "succes" | "terre" | "neutre" } {
  const key = type.toLowerCase().replace(/\s+/g, "_");
  return MAP_TYPE[key] || { libelle: type, variante: "neutre" };
}

function formaterDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PageHistorique() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [activites, setActivites] = useState<ActiviteUtilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    obtenirMonActivite(50)
      .then(setActivites)
      .catch((e) => {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
      })
      .finally(() => setChargement(false));
  }, []);

  const activitesFiltrees = activites.filter((a) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      a.description.toLowerCase().includes(q) ||
      (a.adresse_ip && a.adresse_ip.toLowerCase().includes(q)) ||
      a.type.toLowerCase().includes(q)
    );
  });

  if (chargement) {
    return (
      <div className="space-y-6 apparition">
        <header>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon activité</p>
          <h1 className="mt-1">Historique</h1>
        </header>
        <p className="text-ardoise-clair italic py-12 text-center">Chargement de ton historique...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon activité</p>
        <h1 className="mt-1">Historique</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Toutes les actions effectuées sur ton compte, tracées dans le journal d&apos;audit.
          Si quelque chose te paraît bizarre, déconnecte-toi et change ton mot de passe.
        </p>
      </header>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur de chargement">
          {erreur}
          <button
            type="button"
            onClick={() => {
              setErreur(null);
              setChargement(true);
              obtenirMonActivite(50)
                .then(setActivites)
                .catch((e) => setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur"))
                .finally(() => setChargement(false));
            }}
            className="ml-4 underline text-sm"
          >
            Réessayer
          </button>
        </Alerte>
      )}

      {/* Recherche */}
      {activites.length > 0 && (
        <ChampRecherche
          placeholder="Rechercher dans l'historique..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      )}

      {/* Timeline */}
      {!erreur && activitesFiltrees.length === 0 && (
        <Carte>
          {activites.length === 0 ? (
            <p className="text-center text-ardoise-clair italic py-8">
              Aucune activité enregistrée pour le moment. Les actions que tu effectues sur
              DigiID apparaîtront ici.
            </p>
          ) : (
            <p className="text-center text-ardoise-clair italic py-8">
              Aucune activité ne correspond à ces critères.
            </p>
          )}
        </Carte>
      )}

      {activitesFiltrees.length > 0 && (
        <div className="space-y-3">
          {activitesFiltrees.map((a) => {
            const style = formaterType(a.type);
            return (
              <Carte key={a.id} className="!py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variante={style.variante} taille="petit">{style.libelle}</Badge>
                      <span className="text-xs text-ardoise-clair">{formaterDate(a.date)}</span>
                    </div>
                    <p className="text-sm text-ardoise">{a.description}</p>
                    {a.adresse_ip && (
                      <div className="mt-2 text-xs text-ardoise-clair">
                        <span><strong>IP :</strong> <code className="font-mono">{a.adresse_ip}</code></span>
                      </div>
                    )}
                  </div>
                </div>
              </Carte>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ardoise-clair italic text-center pt-4">
        {activites.length} événement{activites.length > 1 ? "s" : ""} affiché{activites.length > 1 ? "s" : ""} sur les 50 plus récents
      </p>
    </div>
  );
}
