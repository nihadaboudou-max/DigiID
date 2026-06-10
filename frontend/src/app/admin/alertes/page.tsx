"use client";

/**
 * Page admin — alertes de securite.
 * Connectee au backend via GET /api/v1/admin/alertes (module detection_fraude).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { IconeAlerte, IconeCheck } from "@/composants/commun/Icones";
import { obtenirAlertesAdmin, type AlerteAdminItem } from "@/services/admin";
import { ErreurAPI } from "@/services/client_api";

export default function PageAlertesAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [alertes, setAlertes] = useState<AlerteAdminItem[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"non-resolues" | "toutes" | "resolues">("non-resolues");

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      try {
        const d = await obtenirAlertesAdmin({ resolues: false });
        if (actif) {
          setAlertes(d);
        }
      } catch (e) {
        if (actif) {
          setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
        }
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    };

    // Chargement initial
    charger();

    // Rafraîchissement automatique toutes les 10 secondes
    const intervalle = setInterval(charger, 10000);

    return () => {
      actif = false;
      clearInterval(intervalle);
    };
  }, []);

  const alertesFiltrees = alertes.filter((a) =>
    filtre === "toutes" ? true : filtre === "non-resolues" ? !a.resolue : a.resolue
  );

  const compteurs = {
    nonResolues: alertes.filter((a) => !a.resolue).length,
    critiques: alertes.filter((a) => !a.resolue && a.niveau === "critique").length,
    resolues: alertes.filter((a) => a.resolue).length,
  };

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <header>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Securite</p>
          <h1 className="mt-1">Alertes</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-12">Chargement des alertes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin/tableau-de-bord" className="hover:text-lagune transition-colors">
          Tableau de bord
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Alertes</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <header>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Securite</p>
          <h1 className="mt-1">Alertes</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Evenements suspects detectes par notre moteur de regles + ML.
          </p>
        </header>
        <div className="flex gap-3">
          <Link href="/admin/tableau-de-bord">
            <Bouton variante="ghost" taille="petit">← Retour</Bouton>
          </Link>
        </div>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="grid sm:grid-cols-3 gap-4">
        <CarteStatAlerte libelle="Non resolues" valeur={compteurs.nonResolues} couleur="ocre" />
        <CarteStatAlerte libelle="Critiques" valeur={compteurs.critiques} couleur="terre" />
        <CarteStatAlerte libelle="Resolues" valeur={compteurs.resolues} couleur="succes" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["non-resolues", "toutes", "resolues"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltre(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filtre === f
                ? "bg-lagune text-white"
                : "bg-white border border-ardoise-clair/20 text-ardoise hover:bg-sable"
            }`}
          >
            {f === "non-resolues" ? "Non resolues" : f === "toutes" ? "Toutes" : "Resolues"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {alertesFiltrees.length === 0 ? (
          <Carte>
            <p className="text-center text-ardoise-clair italic py-8">
              Aucune alerte dans cette categorie.
            </p>
          </Carte>
        ) : (
          alertesFiltrees.map((a) => (
            <LigneAlerte key={a.id} alerte={a} />
          ))
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
          <Link href="/admin/tableau-de-bord">
            <Bouton variante="ghost" taille="petit">← Tableau de bord</Bouton>
          </Link>
          <Link href="/admin/utilisateurs">
            <Bouton variante="secondaire" taille="petit">👥 Utilisateurs</Bouton>
          </Link>
          <Link href="/admin/statistiques">
            <Bouton variante="ghost" taille="petit">📊 Statistiques</Bouton>
          </Link>
          <Link href="/admin/droits">
            <Bouton variante="ghost" taille="petit">🛡️ Gestion des droits</Bouton>
          </Link>
      </div>
    </div>
  );
}

function CarteStatAlerte({ libelle, valeur, couleur }: {
  libelle: string; valeur: number;
  couleur: "ocre" | "terre" | "succes";
}) {
  const couleurTexte =
    couleur === "ocre" ? "text-ocre"
    : couleur === "terre" ? "text-terre"
    : "text-green-600";
  return (
    <div className="carte">
      <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-1">
        {libelle}
      </p>
      <p className={`text-4xl font-bold ${couleurTexte}`}>{valeur}</p>
    </div>
  );
}

function LigneAlerte({ alerte }: { alerte: AlerteAdminItem }) {
  const couleurBordure =
    alerte.niveau === "critique" ? "border-l-terre"
    : alerte.niveau === "elevee" ? "border-l-ocre"
    : alerte.niveau === "moderee" || alerte.niveau === "modere" ? "border-l-lagune"
    : "border-l-ardoise-clair";

  const badgeVariant =
    alerte.niveau === "critique" ? "terre"
    : alerte.niveau === "elevee" ? "ocre"
    : "lagune";

  return (
    <div className={`bg-white rounded-xl border border-ardoise-clair/10 border-l-4 ${couleurBordure} p-4 ${alerte.resolue ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-sable">
          <IconeAlerte className={
            alerte.niveau === "critique" ? "text-terre"
            : alerte.niveau === "elevee" ? "text-ocre"
            : "text-lagune"
          } />
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-ardoise">{alerte.type_action}</span>
            <Badge variante={badgeVariant}>{alerte.niveau}</Badge>
            {alerte.resolue && <Badge variante="succes">Resolue</Badge>}
          </div>
          <p className="text-sm text-ardoise-clair mb-2">{alerte.description}</p>
          <div className="flex flex-wrap gap-4 text-xs text-ardoise-clair">
            {alerte.utilisateur_id && (
              <span><strong className="text-ardoise">Utilisateur :</strong> <code>{alerte.utilisateur_id.slice(0, 8)}...</code></span>
            )}
            {alerte.adresse_ip && (
              <span><strong className="text-ardoise">IP :</strong> <code>{alerte.adresse_ip}</code></span>
            )}
            <span><strong className="text-ardoise">Date :</strong> {alerte.date_evenement}</span>
          </div>
        </div>
        {!alerte.resolue && (
          <Bouton variante="ghost" taille="petit" disabled>
            <IconeCheck className="w-3 h-3" />
            Signaler resolue
          </Bouton>
        )}
      </div>
    </div>
  );
}
