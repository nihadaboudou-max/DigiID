"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerEnrolements } from "@/services/enrolement";
import type { Enrolement } from "@/services/enrolement";

export default function AgentDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement: chargementPerms, erreur: erreurPerms } = useRoleUI();
  const [enrolements, setEnrolements] = useState<Enrolement[]>([]);
  const [enrolementsOriginaux, setEnrolementsOriginaux] = useState<Enrolement[]>([]);
  const [chargementListe, setChargementListe] = useState(true);
  const [erreurListe, setErreurListe] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");

  useEffect(() => { charger(); }, [filtreStatut]);

  async function charger() {
    setChargementListe(true);
    setErreurListe("");
    try { 
      const data = await listerEnrolements(filtreStatut === "tous" ? undefined : filtreStatut);
      setEnrolements(data); 
      setEnrolementsOriginaux(data);
    }
    catch { setErreurListe("Impossible de charger la liste des enrolements."); }
    finally { setChargementListe(false); }
  }

  const aujourdhui = enrolements.filter(e => new Date(e.date_enrolement).toDateString() === new Date().toDateString()).length;
  const enAttente = enrolements.filter(e => e.statut === "en_attente").length;
  const valides = enrolements.filter(e => e.statut === "valide").length;
  const rejetes = enrolements.filter(e => e.statut === "rejete").length;
  const taux = enrolements.length > 0 ? Math.round((valides / enrolements.length) * 100) : 0;

  if (chargementPerms) {
    return <div className="space-y-8 apparition"><p className="text-ardoise-clair italic text-center py-12">Chargement...</p></div>;
  }
  if (erreurPerms) {
    return <div className="space-y-8 apparition"><div className="bg-terre/10 border-l-4 border-terre p-4 rounded"><p className="text-sm text-terre">{erreurPerms}</p></div></div>;
  }

  return (
    <div className="space-y-8 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
          <h1 className="mt-1">Enrolement des citoyens</h1>
          <p className="text-ardoise-clair mt-2">Inscris les nouveaux citoyens au systeme DigiID.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {can.enroll && (
            <Link href="/agent/enrolement"><Bouton variante="primaire">+ Nouvel enrolement</Bouton></Link>
          )}
          {can.scanCNI && (
            <Link href="/agent/scan"><Bouton variante="secondaire">Scanner une CNI</Bouton></Link>
          )}
        </div>
      </div>

            {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{chargementListe ? "..." : aujourdhui}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Enroles aujourd'hui</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">{chargementListe ? "..." : enrolements.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total enrolements</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{chargementListe ? "..." : `${taux}%`}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Taux de validation</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{chargementListe ? "..." : enAttente}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">En attente</p>
        </div>
      </div>

      {/* Progression */}
      <Carte titre="Progression">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ardoise">
            {chargementListe ? "..." : `${aujourdhui} aujourd'hui`}
          </span>
          <span className="text-sm text-ardoise-clair">
            {chargementListe ? "..." : `${valides} valides / ${enrolements.length} total`}
          </span>
        </div>
        <BarreProgression valeur={Math.min(taux, 100)} couleur="ocre" />
        <div className="mt-3 flex gap-4 text-xs text-ardoise-clair">
          <span>✅ {valides} valides</span>
          <span>⏳ {enAttente} en attente</span>
          <span>❌ {rejetes} rejetes</span>
        </div>
      </Carte>

      {/* Enrolements recents */}
      {can.viewEnrollments && (
        <Carte titre="Enrolements recents">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Rechercher par nom..."
                className="flex-1 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
                onChange={(e) => {
                  const terme = e.target.value.toLowerCase();
                  if (!terme) { setEnrolements(enrolementsOriginaux); return; }
                  setEnrolements(enrolementsOriginaux.filter(e => 
                    e.citoyen_prenom.toLowerCase().includes(terme) ||
                    e.citoyen_nom.toLowerCase().includes(terme) ||
                    (e.citoyen_digiid || "").toLowerCase().includes(terme)
                  ));
                }}
              />
            </div>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="tous">Tous</option>
              <option value="en_attente">En attente</option>
              <option value="valide">Valides</option>
              <option value="rejete">Rejetes</option>
            </select>
          </div>
          {erreurListe ? (
            <div className="text-center py-6">
              <p className="text-terre text-sm mb-3">{erreurListe}</p>
              <Bouton variante="ghost" taille="petit" onClick={charger}>Reessayer</Bouton>
            </div>
          ) : chargementListe ? (
            <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
          ) : enrolements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-ardoise-clair italic">Aucun enrolement pour le moment.</p>
              <Link href="/agent/enrolement" className="mt-4 inline-block">
                <Bouton variante="primaire" taille="petit">+ Premier enrolement</Bouton>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                                {enrolements.slice(0, 5).map((enr) => (
                  <Link
                    key={enr.id}
                    href={`/agent/enrolement/${enr.id}`}
                    className="flex items-center justify-between p-3 bg-sable rounded-lg group hover:shadow-sm hover:bg-sable/80 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                        {enr.citoyen_prenom.charAt(0)}{enr.citoyen_nom.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ardoise truncate group-hover:text-lagune transition-colors">
                          {enr.citoyen_prenom} {enr.citoyen_nom}
                        </p>
                        <p className="text-xs text-ardoise-clair">
                          {new Date(enr.date_enrolement).toLocaleDateString("fr-FR", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                          {enr.citoyen_digiid && ` \u00b7 ${enr.citoyen_digiid}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variante={enr.statut === "valide" ? "succes" : enr.statut === "rejete" ? "terre" : "ocre"}>
                        {enr.statut === "valide" ? "Valide" : enr.statut === "rejete" ? "Rejete" : "En attente"}
                      </Badge>
                      {enr.scan_cni && <span className="text-xs" title="CNI scannée">🪪</span>}
                      {enr.capture_biometrique && <span className="text-xs" title="Biometrie capturee">🔐</span>}
                      <span className="text-xs text-ardoise-clair/40 group-hover:text-lagune group-hover:translate-x-0.5 transition-all">→</span>
                    </div>
                  </Link>
                ))}
              </div>
              {enrolements.length > 5 && (
                <p className="text-center text-xs text-ardoise-clair mt-3">
                  +{enrolements.length - 5} autres enrolements
                </p>
              )}
            </>
          )}
        </Carte>
      )}

      {/* Actions rapides */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.enroll && <CarteAction titre="Nouvel enrolement" description="Inscrire un nouveau citoyen" href="/agent/enrolement" icone="👤" />}
        {can.scanCNI && <CarteAction titre="Scanner CNI" description="OCR de la carte d'identite" href="/agent/scan" icone="🪪" />}
        {can.captureBiometrics && <CarteAction titre="Capture biometrique" description="Photo et empreinte" href="/agent/capture" icone="🔐" />}
      </div>
    </div>
  );
}

function CarteAction({ titre, description, href, icone }: { titre: string; description: string; href: string; icone: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">{titre}</h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Acceder →</p>
      </div>
    </Link>
  );
}
