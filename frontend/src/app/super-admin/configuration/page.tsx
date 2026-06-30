"use client";

/**
 * Page super-admin — configuration système et feature flags améliorée.
 * Affiche et permet de modifier les feature flags en ligne (Phase 6).
 */
import { useCallback, useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { useNotifications } from "@/contextes/notifications";
import {
  listerFeatureFlags,
  modifierFeatureFlags,
  type ListeFeatureFlags,
  type FeatureFlagItem,
} from "@/services/super_admin_v2";

export default function PageConfigurationSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [flags, setFlags] = useState<FeatureFlagItem[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modificationEnCours, setModificationEnCours] = useState<string | null>(null);
  const { notifier } = useNotifications();

  const chargerFlags = useCallback(async () => {
    try {
      const data = await listerFeatureFlags();
      setFlags(data.flags);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerFlags();
  }, [chargerFlags]);

  const basculerFlag = async (cle: string, valeurActuelle: boolean) => {
    const nouvelleValeur = !valeurActuelle;
    setModificationEnCours(cle);
    try {
      const resultat = await modifierFeatureFlags({ flags: { [cle]: nouvelleValeur } });
      setFlags(resultat.flags);
      notifier(
        `Flag "${cle}" ${nouvelleValeur ? "activé" : "désactivé"} avec succès`,
        "succes"
      );
    } catch (e) {
      notifier(
        `Erreur lors de la modification du flag "${cle}"`,
        "erreur"
      );
    } finally {
      setModificationEnCours(null);
    }
  };

  if (chargement) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1 text-2xl">Configuration système</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-6">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
          Super administration
        </p>
        <h1 className="mt-1 text-2xl">Configuration système</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Feature flags dynamiques — modifiables en ligne, sans redémarrage.
          Toute modification est tracée dans le journal d'audit.
        </p>
      </header>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur de chargement">
          {erreur}
        </Alerte>
      )}

      <Carte
        titre="Feature flags"
        description="Activez ou désactivez les fonctionnalités du système en un clic"
      >
        <div className="space-y-1">
          {/* Phase 2 */}
          <FeatureFlagSection titre="Phase 2 — Modules métier">
            {flags
              .filter((f) => f.categorie === "metier")
              .map((flag) => (
                <FeatureFlagItemRow
                  key={flag.cle}
                  flag={flag}
                  modificationEnCours={modificationEnCours === flag.cle}
                  surBascule={() => basculerFlag(flag.cle, Boolean(flag.valeur))}
                />
              ))}
          </FeatureFlagSection>

          {/* Phase 3 */}
          <FeatureFlagSection titre="Phase 3 — Chatbot & RAG">
            {flags
              .filter((f) => f.categorie === "chatbot")
              .map((flag) => (
                <FeatureFlagItemRow
                  key={flag.cle}
                  flag={flag}
                  modificationEnCours={modificationEnCours === flag.cle}
                  surBascule={() => basculerFlag(flag.cle, Boolean(flag.valeur))}
                />
              ))}
          </FeatureFlagSection>

          {/* Phase 4 */}
          <FeatureFlagSection titre="Phase 4 — Reconnaissance faciale">
            {flags
              .filter((f) => f.categorie === "facial")
              .map((flag) => (
                <FeatureFlagItemRow
                  key={flag.cle}
                  flag={flag}
                  modificationEnCours={modificationEnCours === flag.cle}
                  surBascule={() => basculerFlag(flag.cle, Boolean(flag.valeur))}
                />
              ))}
          </FeatureFlagSection>

          {/* Production - Sécurité */}
          <FeatureFlagSection titre="Production — Sécurité">
            {flags
              .filter((f) => f.categorie === "securite")
              .map((flag) => (
                <FeatureFlagItemRow
                  key={flag.cle}
                  flag={flag}
                  modificationEnCours={modificationEnCours === flag.cle}
                  surBascule={() => basculerFlag(flag.cle, Boolean(flag.valeur))}
                />
              ))}
          </FeatureFlagSection>

          <div className="mt-3 pt-3 border-t border-ardoise-clair/10">
            <p className="text-xs text-ardoise-clair/60 italic">
              Les flags de sensibilité <Badge variante="terre" taille="petit">critique</Badge> (niveau 2)
              ont un audit renforcé : chaque modification est tracée avec l&apos;ancienne et la nouvelle valeur.
            </p>
          </div>
        </div>
      </Carte>
    </div>
  );
}

function FeatureFlagSection({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ardoise-clair/10 last:border-0">
      <p className="text-xs uppercase text-ardoise-clair font-bold tracking-wide py-2">
        {titre}
      </p>
      <div className="space-y-1 pb-2">{children}</div>
    </div>
  );
}

function FeatureFlagItemRow({
  flag,
  modificationEnCours,
  surBascule,
}: {
  flag: FeatureFlagItem;
  modificationEnCours: boolean;
  surBascule: () => void;
}) {
  const valeurBool = Boolean(flag.valeur);
  const sensibiliteBadge = flag.niveau_sensibilite >= 2 ? "terre" : flag.niveau_sensibilite >= 1 ? "ocre" : "neutre";
  const libelleSensibilite = flag.niveau_sensibilite >= 2 ? "Critique" : flag.niveau_sensibilite >= 1 ? "Sensible" : "Standard";

  return (
    <div className="flex items-start gap-3 p-2 bg-blanc rounded-lg border border-ardoise-clair/10 hover:border-lagune/30 transition-colors">
      <button
        type="button"
        onClick={surBascule}
        disabled={modificationEnCours}
        className="flex-shrink-0 focus:outline-none disabled:opacity-50"
        aria-label={`${valeurBool ? "Désactiver" : "Activer"} ${flag.cle}`}
      >
        <div
          className={`w-11 h-6 rounded-full flex items-center justify-center relative transition-all ${
            valeurBool ? "bg-green-600" : "bg-ardoise-clair/20"
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full absolute shadow transition-all ${
              valeurBool ? "translate-x-2.5" : "-translate-x-2.5"
            }`}
          />
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-ardoise">{flag.cle}</p>
          <Badge variante={sensibiliteBadge} taille="petit">
            {libelleSensibilite}
          </Badge>
        </div>
        <p className="text-xs text-ardoise-clair mt-0.5">{flag.description}</p>
      </div>
      <div className="flex items-center gap-2">
        {modificationEnCours && (
          <span className="text-xs text-ocre animate-pulse">Modification...</span>
        )}
        <Badge variante={valeurBool ? "succes" : "neutre"} taille="petit">
          {valeurBool ? "✓ Actif" : "— Inactif"}
        </Badge>
      </div>
    </div>
  );
}