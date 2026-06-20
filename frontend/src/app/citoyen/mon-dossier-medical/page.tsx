"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { monDossierMedical } from "@/services/medical";
import type { DossierMedical, Consultation, Ordonnance } from "@/services/medical";

export default function MonDossierMedicalPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dossiers, setDossiers] = useState<
    { dossier: DossierMedical; consultations: Consultation[]; ordonnances: Ordonnance[] }[]
  >([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState("");
  const [dossierOuvert, setDossierOuvert] = useState<string | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try {
      const data = await monDossierMedical();
      setDossiers(data);
    } catch (error: any) {
      console.error("Erreur chargement dossier médical:", error);
      setMessage("Erreur lors du chargement de votre dossier médical.");
    } finally {
      setChargement(false);
    }
  }

  /** Vérifie si une date de contrôle approche (dans les 7 jours) */
  function controleApproche(dateControle: string | null): boolean {
    if (!dateControle) return false;
    const controle = new Date(dateControle);
    const maintenant = new Date();
    const diffJours = Math.ceil((controle.getTime() - maintenant.getTime()) / (1000 * 60 * 60 * 24));
    return diffJours >= 0 && diffJours <= 7;
  }

  /** Vérifie si une date de contrôle est dépassée */
  function controleDepasse(dateControle: string | null): boolean {
    if (!dateControle) return false;
    const controle = new Date(dateControle);
    const maintenant = new Date();
    return controle < maintenant;
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/citoyen/dashboard" className="hover:text-ocre">Mon espace</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Mon dossier médical</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Santé</p>
        <h1 className="mt-1">Mon dossier médical complet</h1>
        <p className="text-ardoise-clair mt-2">
          Consultez l&apos;intégralité de votre historique médical : dossiers, consultations, ordonnances et contrôles de suivi.
        </p>
      </div>

      {message && (
        <div className="bg-vert/10 border-l-4 border-vert p-3 rounded">
          <p className="text-sm text-vert">{message}</p>
        </div>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement de votre dossier médical...</p>
      ) : dossiers.length === 0 ? (
        <Carte>
          <p className="text-ardoise-clair italic text-center py-8">
            Vous n&apos;avez aucun dossier médical pour le moment.
          </p>
        </Carte>
      ) : (
        <div className="space-y-6">
          {dossiers.map(({ dossier, consultations, ordonnances }) => (
            <div key={dossier.id} className="carte-medicale">
              {/* En-tête du dossier */}
              <button
                onClick={() => setDossierOuvert(dossierOuvert === dossier.id ? null : dossier.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between p-4 bg-sable rounded-t-lg hover:bg-sable-fonce transition-colors">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="font-bold text-ardoise">
                      {dossier.motif}
                    </h2>
                    <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"}>
                      {dossier.statut === "ouvert" ? "Suivi en cours" : "Archivé"}
                    </Badge>
                    <span className="text-xs text-ardoise-clair">
                      🏥 {dossier.hopital || "Établissement non précisé"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ardoise-clair">
                    <span>{consultations.length} consultation(s)</span>
                    <span>{ordonnances.length} ordonnance(s)</span>
                    <span className={`transition-transform ${dossierOuvert === dossier.id ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </div>
                </div>
              </button>

              {/* Contenu dépliable */}
              {dossierOuvert === dossier.id && (
                <div className="p-4 space-y-6 border-t border-ardoise-clair/10">
                  {/* Infos du dossier */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-ardoise-clair uppercase font-semibold">Diagnostic</p>
                      <p className="text-ardoise">{dossier.diagnostic || "Non renseigné"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ardoise-clair uppercase font-semibold">Médecin</p>
                      <p className="text-ardoise">{dossier.medecin_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ardoise-clair uppercase font-semibold">Créé le</p>
                      <p className="text-ardoise">{new Date(dossier.date_creation).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ardoise-clair uppercase font-semibold">Modifié le</p>
                      <p className="text-ardoise">{new Date(dossier.date_modification).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>

                  {/* Consultations */}
                  <div>
                    <h3 className="text-sm font-bold text-ardoise mb-3 flex items-center gap-2">
                      📋 Consultations ({consultations.length})
                    </h3>
                    {consultations.length === 0 ? (
                      <p className="text-sm text-ardoise-clair italic">Aucune consultation</p>
                    ) : (
                      <div className="space-y-3">
                        {consultations.map((c) => (
                          <div key={c.id} className="p-3 bg-sable rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm">{c.motif}</p>
                                  {c.type_consultation && (
                                    <Badge variante={c.type_consultation === "controle" ? "ocre" : "neutre"}>
                                      {c.type_consultation === "controle" ? "🔍 Contrôle" : c.type_consultation}
                                    </Badge>
                                  )}
                                </div>
                                {c.diagnostic && (
                                  <p className="text-xs text-ardoise-clair mt-1">{c.diagnostic}</p>
                                )}
                              </div>
                              <span className="text-xs text-ardoise-clair shrink-0">
                                {new Date(c.date_consultation).toLocaleDateString("fr-FR")}
                              </span>
                            </div>

                            {/* Indicateurs de santé */}
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-ardoise-clair">
                              {c.poids && <span>⚖️ {c.poids} kg</span>}
                              {c.taille && <span>📏 {c.taille} cm</span>}
                              {c.temperature && <span>🌡️ {(c.temperature / 10).toFixed(1)}°C</span>}
                              {c.pression_arterielle && <span>💉 {c.pression_arterielle}</span>}
                            </div>

                            {c.observations && (
                              <p className="text-xs text-ardoise-clair mt-2 italic">{c.observations}</p>
                            )}
                            {c.conclusion && (
                              <p className="text-xs font-medium text-ardoise mt-2">Conclusion : {c.conclusion}</p>
                            )}

                            {/* Date de contrôle */}
                            {c.date_controle && (
                              <div className={`mt-3 p-2 rounded text-xs font-medium flex items-center gap-2 ${
                                controleDepasse(c.date_controle)
                                  ? "bg-terre/10 text-terre"
                                  : controleApproche(c.date_controle)
                                    ? "bg-ocre/10 text-ocre"
                                    : "bg-vert/10 text-vert"
                              }`}>
                                {controleDepasse(c.date_controle) ? "⚠️" : controleApproche(c.date_controle) ? "⏰" : "📅"}
                                <span>
                                  {controleDepasse(c.date_controle)
                                    ? `Contrôle dépassé depuis le ${new Date(c.date_controle).toLocaleDateString("fr-FR")}`
                                    : controleApproche(c.date_controle)
                                      ? `Contrôle prévu le ${new Date(c.date_controle).toLocaleDateString("fr-FR")} (très bientôt !)`
                                      : `Prochain contrôle recommandé : ${new Date(c.date_controle).toLocaleDateString("fr-FR")}`
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ordonnances */}
                  <div>
                    <h3 className="text-sm font-bold text-ardoise mb-3 flex items-center gap-2">
                      💊 Ordonnances ({ordonnances.length})
                    </h3>
                    {ordonnances.length === 0 ? (
                      <p className="text-sm text-ardoise-clair italic">Aucune ordonnance</p>
                    ) : (
                      <div className="space-y-3">
                        {ordonnances.map((o) => (
                          <div key={o.id} className="p-3 bg-sable rounded-lg">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{o.medicaments}</p>
                              <span className="text-xs text-ardoise-clair font-mono">#{o.numero_ordonnance}</span>
                              {o.statut !== "active" && (
                                <Badge variante={o.statut === "expiree" ? "neutre" : "terre"}>
                                  {o.statut === "expiree" ? "Expirée" : "Annulée"}
                                </Badge>
                              )}
                            </div>
                            {o.instructions && (
                              <p className="text-xs text-ardoise-clair mt-1">{o.instructions}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-ardoise-clair">
                              <span>📅 Prescrit le {new Date(o.date_prescription).toLocaleDateString("fr-FR")}</span>
                              {o.date_expiration && (
                                <span className="text-terre">⏳ Expire le {new Date(o.date_expiration).toLocaleDateString("fr-FR")}</span>
                              )}
                              {o.medecin_nom && <span>👨‍⚕️ Dr. {o.medecin_nom}</span>}
                              {o.hopital && <span>🏥 {o.hopital}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Link href="/citoyen/dashboard">
        <Bouton variante="ghost">Retour à mon espace</Bouton>
      </Link>
    </div>
  );
}
