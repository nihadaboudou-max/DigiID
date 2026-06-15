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
    <EnvelopperEspaceProtege rolesAutorises={["agent"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement } = useRoleUI();
  const [enrolements, setEnrolements] = useState<Enrolement[]>([]);
  const [chargementListe, setChargementListe] = useState(true);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargementListe(true);
    try { setEnrolements(await listerEnrolements()); }
    catch { /* silencieux */ }
    finally { setChargementListe(false); }
  }

  const aujourdhui = enrolements.filter(e => new Date(e.date_enrolement).toDateString() === new Date().toDateString()).length;
  const enAttente = enrolements.filter(e => e.statut === "en_attente").length;
  const valides = enrolements.filter(e => e.statut === "valide").length;
  const taux = enrolements.length > 0 ? Math.round((valides / enrolements.length) * 100) : 0;

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
        <h1>Tableau de bord</h1>
        <p className="text-ardoise-clair italic text-center py-12">Chargement...</p>
      </div>
    );
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

      <Carte titre="Progression">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ardoise">{aujourdhui} aujourd'hui</span>
          <span className="text-sm text-ardoise-clair">{enrolements.length} total</span>
        </div>
        <BarreProgression valeur={Math.min(taux, 100)} couleur="ocre" />
      </Carte>

      {can.viewEnrollments && (
        <Carte titre="Enrolements recents">
          {chargementListe ? (
            <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
          ) : enrolements.length === 0 ? (
            <p className="text-ardoise-clair italic text-center py-8">Aucun enrolement. Commencez par en creer un !</p>
          ) : (
            <div className="space-y-2">
              {enrolements.slice(0, 5).map((enr) => (
                <div key={enr.id} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold">
                      {enr.citoyen_nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ardoise">{enr.citoyen_nom} {enr.citoyen_prenom}</p>
                      <p className="text-xs text-ardoise-clair">{new Date(enr.date_enrolement).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                  <Badge variante={enr.statut === "valide" ? "succes" : enr.statut === "rejete" ? "terre" : "ocre"}>
                    {enr.statut === "valide" ? "Valide" : enr.statut === "rejete" ? "Rejete" : "En attente"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Carte>
      )}

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
