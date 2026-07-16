"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { listerVerifications } from "@/services/police";
import type { VerificationPolice } from "@/services/police";

export default function AuditPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police", "chef_police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [verifications, setVerifications] = useState<VerificationPolice[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      try { setVerifications(await listerVerifications()); }
      catch {}
      finally { setChargement(false); }
    })();
  }, []);

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Mon historique</span>
      </nav>
      <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Forces de l ordre</p>
      <h1>Mon historique de verifications</h1>
      <p className="text-ardoise-clair">{verifications.length} verification(s) effectuee(s)</p>

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
      ) : verifications.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucune verification.</p></Carte>
      ) : (
        <div className="space-y-2">
          {verifications.map((v) => (
            <div key={v.id} className="carte flex items-center justify-between">
              <div>
                <p className="font-semibold text-ardoise">{v.personne_digiid}</p>
                <p className="text-xs text-ardoise-clair">{v.personne_nom || "Nom non renseigne"} · {v.type_verification}</p>
                <p className="text-xs text-ardoise-clair">{new Date(v.date_verification).toLocaleString("fr-FR")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variante={v.resultat === "confirme" ? "succes" : v.resultat === "infirme" ? "terre" : "ocre"}>
                  {v.resultat === "confirme" ? "Confirme" : v.resultat === "infirme" ? "Infirme" : "En cours"}
                </Badge>
                {v.est_signalement_fraude && <span className="text-xs text-terre font-semibold">Fraude</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
