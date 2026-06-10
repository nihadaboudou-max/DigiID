"use client";

/**
 * Page Badges — affiche les badges debloques et ceux a debloquer.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { listerMesBadges, type BadgeDetail, type ListeBadges } from "@/services/gamification";
import { ErreurAPI } from "@/services/client_api";

const RARETE_PRIORITE: Record<string, number> = {
  commun: 0,
  rare: 1,
  epique: 2,
  legendaire: 3,
};

const COULEURS_RARETE: Record<string, string> = {
  commun: "bg-ardoise-clair/30 text-ardoise",
  rare: "bg-lagune text-white",
  epique: "bg-ocre text-ardoise",
  legendaire: "bg-gradient-to-r from-ocre to-terre text-white",
};

export default function PageBadges() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [donnees, setDonnees] = useState<ListeBadges | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerMesBadges()
      .then(setDonnees)
      .catch((e) => setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur"))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p className="text-ardoise-clair italic">Chargement de tes badges...</p>;
  if (erreur) return <Alerte variante="erreur">{erreur}</Alerte>;
  if (!donnees) return null;

  const debloques = donnees.badges.filter((b) => b.est_debloque);
  const aDebloquer = donnees.badges
    .filter((b) => !b.est_debloque)
    .sort((a, b) => RARETE_PRIORITE[a.rarete] - RARETE_PRIORITE[b.rarete]);

  const prochainBadge = aDebloquer[0];

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Ma collection
        </p>
        <h1 className="mt-1">Mes badges</h1>
        <p className="text-ardoise-clair mt-2">
          Debloque des medailles en utilisant DigiID. Chaque badge te donne un bonus de score !
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-1">
            Debloques
          </p>
          <p className="text-4xl font-bold text-ocre">
            {donnees.total_debloques}
            <span className="text-ardoise-clair text-2xl"> / {donnees.total_disponibles}</span>
          </p>
        </Carte>
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-1">
            Bonus total cumule
          </p>
          <p className="text-4xl font-bold text-lagune">
            +{donnees.bonus_total} <span className="text-ardoise-clair text-2xl">pts</span>
          </p>
        </Carte>
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-1">
            Progression
          </p>
          <div className="space-y-2">
            <p className="text-4xl font-bold text-green-600">
              {Math.round((donnees.total_debloques / donnees.total_disponibles) * 100)}%
            </p>
            <div className="h-2 rounded-full bg-ardoise-clair/20 overflow-hidden">
              <div
                className="h-full bg-lagune"
                style={{ width: `${Math.round((donnees.total_debloques / donnees.total_disponibles) * 100)}%` }}
              />
            </div>
          </div>
        </Carte>
      </div>

      {prochainBadge && (
        <section>
          <h2 className="mb-4">Prochain badge</h2>
          <Carte className="border-2 border-dashed border-ardoise-clair/40">
            <div className="flex items-center gap-4">
              <div className="text-5xl">{prochainBadge.icone}</div>
              <div>
                <p className="font-semibold">{prochainBadge.titre}</p>
                <p className="text-sm text-ardoise-clair leading-relaxed">
                  {prochainBadge.description}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-ardoise-clair">
              <span>{prochainBadge.rarete}</span>
              <span>+{prochainBadge.bonus_score} pts</span>
            </div>
          </Carte>
        </section>
      )}

      {debloques.length > 0 && (
        <section>
          <h2 className="mb-4">Badges debloques ({debloques.length})</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {debloques.map((b) => <CarteBadge key={b.code} badge={b} />)}
          </div>
        </section>
      )}

      {aDebloquer.length > 0 && (
        <section>
          <h2 className="mb-4">A debloquer ({aDebloquer.length})</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {aDebloquer.map((b) => <CarteBadge key={b.code} badge={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function formaterDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function CarteBadge({ badge }: { badge: BadgeDetail }) {
  return (
    <div
      className={`carte transition-all ${badge.est_debloque ? "border-l-4 border-l-ocre" : "opacity-60"}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="text-5xl flex-shrink-0">{badge.icone}</div>
        <div className="flex-grow min-w-0">
          <h3 className="!text-base !mb-1 truncate">{badge.titre}</h3>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              COULEURS_RARETE[badge.rarete]
            }`}
          >
            {badge.rarete}
          </span>
        </div>
      </div>
      <p className="text-xs text-ardoise-clair leading-relaxed mb-3">
        {badge.description}
      </p>
      {badge.est_debloque && (
        <p className="text-xs text-ardoise-clair mb-3">
          Obtenu le {formaterDate(badge.date_obtention)}
        </p>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-ardoise-clair/10">
        <span className="text-xs text-ardoise-clair">
          {badge.est_debloque ? "Debloque" : "A debloquer"}
        </span>
        <span className="text-sm font-bold text-lagune">+{badge.bonus_score} pts</span>
      </div>
    </div>
  );
}
