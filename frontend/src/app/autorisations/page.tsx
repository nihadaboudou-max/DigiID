"use client";

/**
 * Page "Mes autorisations" — Qui a accès à mes données ?
 * Affiche l'historique des accès à ton profil : qui, quand, pourquoi.
 * Permet de révoquer un accès si nécessaire.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { useAuthentification } from "@/contextes/authentification";
import { obtenirMonActivite } from "@/services/profil";
import type { ActiviteUtilisateur } from "@/services/profil";
import { listerMesConsentements } from "@/services/consentements";
import type { ConsentementDetail } from "@/services/consentements";
import { clientAPI } from "@/services/client_api";

export default function PageAutorisations() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [activites, setActivites] = useState<ActiviteUtilisateur[]>([]);
  const [consentements, setConsentements] = useState<ConsentementDetail[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [accesDetail, setAccesDetail] = useState<ActiviteUtilisateur | null>(null);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const [activitesData, consentementsData] = await Promise.all([
        obtenirMonActivite(50),
        listerMesConsentements(),
      ]);
      setActivites(activitesData || []);
      setConsentements(consentementsData.consentements || []);
    } catch {
      setErreur("Impossible de charger les données d'accès.");
    } finally {
      setChargement(false);
    }
  }

  // Filtrer les activités pertinentes (consultations de profil, accès par des tiers)
  const accesProfil = activites.filter((a) => {
    const typesAcces = [
      "consultation_profil", "acces_donnees", "partage_digiid",
      "connexion_reussie", "modification_profil",
    ];
    return typesAcces.some((t) => a.type?.toLowerCase().includes(t));
  });

  const accesFiltres = accesProfil.filter((a) => {
    if (filtre === "mois") {
      const ilYAMois = new Date();
      ilYAMois.setMonth(ilYAMois.getMonth() - 1);
      return new Date(a.date) >= ilYAMois;
    }
    if (filtre === "semaine") {
      const ilYASemaine = new Date();
      ilYASemaine.setDate(ilYASemaine.getDate() - 7);
      return new Date(a.date) >= ilYASemaine;
    }
    return true;
  });

  // Regrouper les accès par type
  const accesParType = {
    consultations: accesFiltres.filter((a) => a.type === "consultation_profil"),
    connexions: accesFiltres.filter((a) => a.type === "connexion_reussie"),
    modifications: accesFiltres.filter((a) => a.type === "modification_profil"),
    autres: accesFiltres.filter((a) => !["consultation_profil", "connexion_reussie", "modification_profil"].includes(a.type)),
  };

  if (!utilisateur) return null;

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Vie privée
        </p>
        <h1 className="mt-1">Mes autorisations</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Découvre qui a consulté tes données, quand, et pourquoi.
          Tu gardes le contrôle à tout moment.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{chargement ? "..." : accesProfil.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Accès total</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">{chargement ? "..." : accesParType.consultations.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Consultations profil</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{chargement ? "..." : consentements.filter(c => !c.est_accorde).length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Consentements refusés</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{chargement ? "..." : consentements.filter(c => c.est_accorde).length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Consentements actifs</p>
        </div>
      </div>

      {/* Filtres temporels */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "tous", label: "Tout l'historique" },
          { id: "mois", label: "Ce mois" },
          { id: "semaine", label: "Cette semaine" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltre(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filtre === f.id ? "bg-lagune text-white" : "bg-sable text-ardoise-clair hover:bg-sable/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Journal des accès */}
      <Carte titre="Qui a accédé à mes données ?">
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement du journal d'accès...</p>
        ) : accesFiltres.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-5xl mb-4">🔒</p>
            <p className="text-ardoise-clair italic">Aucun accès enregistré sur cette période.</p>
            <p className="text-xs text-ardoise-clair/60 mt-2">
              Les accès à ton profil par des institutions (banque, hôpital, police)
              apparaîtront ici avec leur motif.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {accesFiltres.map((activite, i) => (
              <div
                key={activite.id || i}
                className="flex items-start justify-between p-3 rounded-lg hover:bg-sable transition-colors cursor-pointer"
                onClick={() => setAccesDetail(activite)}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {activite.type === "consultation_profil" ? "👁️"
                    : activite.type === "connexion_reussie" ? "🔑"
                    : activite.type === "modification_profil" ? "✏️"
                    : activite.type === "partage_digiid" ? "📤"
                    : "📋"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ardoise truncate">
                      {activite.description || activite.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-ardoise-clair">
                      {new Date(activite.date).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {activite.adresse_ip && ` · IP ${activite.adresse_ip}`}
                    </p>
                  </div>
                </div>
                <Badge
                  variante={
                    activite.type === "modification_profil" ? "ocre"
                    : activite.type === "connexion_reussie" ? "succes"
                    : "lagune"
                  }
                  taille="petit"
                >
                  {activite.type === "consultation_profil" ? "Consultation"
                  : activite.type === "connexion_reussie" ? "Connexion"
                  : activite.type === "modification_profil" ? "Modification"
                  : activite.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Consentements actifs */}
      <Carte titre="Mes consentements actifs">
        <div className="grid sm:grid-cols-2 gap-3">
          {consentements.length > 0 ? (
            consentements.map((c) => (
              <div key={c.categorie} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-ardoise">{c.titre}</p>
                  <p className="text-xs text-ardoise-clair">{c.description?.slice(0, 80)}...</p>
                </div>
                <Badge variante={c.est_accorde ? "succes" : "neutre"} taille="petit">
                  {c.est_accorde ? "✅ Accordé" : "❌ Refusé"}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-ardoise-clair italic text-sm col-span-2 text-center py-4">
              Aucun consentement configuré.
            </p>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
          <Link href="/consentements">
            <Bouton variante="secondaire">Gérer tous mes consentements →</Bouton>
          </Link>
        </div>
      </Carte>

      {/* Modal détail accès */}
      <Modal
        ouvert={accesDetail !== null}
        onFermer={() => setAccesDetail(null)}
        titre="Détail de l'accès"
      >
        {accesDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-sable rounded">
                <p className="text-xs text-ardoise-clair uppercase">Type</p>
                <p className="text-sm font-semibold text-ardoise">{accesDetail.type.replace(/_/g, " ")}</p>
              </div>
              <div className="p-3 bg-sable rounded">
                <p className="text-xs text-ardoise-clair uppercase">Date</p>
                <p className="text-sm font-semibold text-ardoise">
                  {new Date(accesDetail.date).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            {accesDetail.description && (
              <div className="p-3 bg-sable rounded">
                <p className="text-xs text-ardoise-clair uppercase">Description</p>
                <p className="text-sm text-ardoise">{accesDetail.description}</p>
              </div>
            )}
            {accesDetail.adresse_ip && (
              <div className="p-3 bg-sable rounded">
                <p className="text-xs text-ardoise-clair uppercase">Adresse IP</p>
                <p className="text-sm font-mono text-ardoise">{accesDetail.adresse_ip}</p>
              </div>
            )}
            <p className="text-xs text-ardoise-clair italic">
              Conformément à la loi 2008-12 (Sénégal), tout accès à tes données est tracé
              et conservé pendant 3 ans.
            </p>
            <Bouton variante="ghost" onClick={() => setAccesDetail(null)}>
              Fermer
            </Bouton>
          </div>
        )}
      </Modal>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/profil">
          <Bouton variante="primaire">← Retour à mon profil</Bouton>
        </Link>
        <Link href="/consentements">
          <Bouton variante="secondaire">Gérer mes consentements</Bouton>
        </Link>
      </div>

      <Alerte variante="info" titre="🔒 Chiffré et tracé">
        Chaque accès à ton profil est horodaté et conservé dans le journal d'audit.
        Personne ne peut consulter tes données sans que tu le saches.
        Tu peux exporter cette liste depuis ton profil.
      </Alerte>
    </div>
  );
}
