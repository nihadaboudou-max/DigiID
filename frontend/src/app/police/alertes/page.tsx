"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { listerAlertes, marquerAlerteLue } from "@/services/police";
import type { AlertePolice } from "@/services/police";

export default function PageAlertes() {
  return <EnvelopperEspaceProtege rolesAutorises={["agent_police"]}><Contenu /></EnvelopperEspaceProtege>;
}

function Contenu() {
  const [alertes, setAlertes] = useState<AlertePolice[]>([]);
  const [total, setTotal] = useState(0);
  const [nonLues, setNonLues] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreNonLues, setFiltreNonLues] = useState(false);

  useEffect(() => { charger(); const i = setInterval(charger, 15000); return () => clearInterval(i); }, []);
  async function charger() {
    try {
      const data = await listerAlertes({ non_lues_seulement: filtreNonLues });
      setAlertes(data.alertes || []); setTotal(data.total || 0); setNonLues(data.non_lues || 0);
    } catch { setErreur("Erreur de chargement."); }
    setChargement(false);
  }
  async function handleMarquerLue(id: string) { try { await marquerAlerteLue(id); charger(); } catch {} }
  async function handleToutLu() { for (const a of alertes.filter(a => !a.est_lue)) try { await marquerAlerteLue(a.id); } catch {} charger(); }

  const nc: Record<string, string> = { critique: "border-l-terre bg-terre/5", eleve: "border-l-ocre bg-ocre/5", moyen: "border-l-jaune bg-jaune/5", faible: "border-l-lagune bg-lagune/5", info: "border-l-ardoise-clair bg-sable" };
  const ni: Record<string, string> = { critique: "🔴", eleve: "🟠", moyen: "🟡", faible: "🔵", info: "ℹ️" };
  const fmtDate = (d: string) => new Date(d).toLocaleString("fr-FR");

  return (
    <div className="space-y-6 apparition">
      <nav className="text-xs text-ardoise-clair flex gap-1">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link><span>/</span><span className="text-ardoise">Alertes</span>
      </nav>
      <div className="flex items-center justify-between">
        <div><p className="text-ocre text-xs uppercase font-semibold">Police</p><h1 className="mt-1">Alertes{nonLues>0?` (${nonLues})`:''}</h1></div>
        <div className="flex gap-2">
          {nonLues>0&&<Bouton variante="primaire" taille="petit" onClick={handleToutLu}>✅ Tout lu</Bouton>}
          <Bouton variante="ghost" taille="petit" onClick={charger} chargement={chargement}>🔄</Bouton>
        </div>
      </div>
      {erreur && <p className="text-sm text-terre bg-terre/10 p-3 rounded">{erreur}</p>}
      <div className="grid grid-cols-3 gap-2">
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-lagune">{total}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Total</p></div>
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-terre">{nonLues}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Non lues</p></div>
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-succes">{total-nonLues}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Lues</p></div>
      </div>
      <div className="flex gap-2">{[{id:false,label:"Toutes"},{id:true,label:"Non lues"}].map(f=>(
        <button key={String(f.id)} onClick={()=>setFiltreNonLues(f.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtreNonLues===f.id?"bg-lagune text-white":"bg-sable text-ardoise-clair"}`}>{f.label}</button>
      ))}</div>
      <div className="space-y-2">
        {chargement ? <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        : alertes.length === 0 ? <Carte><div className="text-center py-6"><p className="text-3xl mb-2">🔔</p><p className="text-ardoise-clair italic text-sm">{filtreNonLues?"Aucune non lue.":"Aucune alerte."}</p></div></Carte>
        : alertes.map(a => (
            <div key={a.id} className={`border-l-4 rounded-lg p-3 ${!a.est_lue?"shadow-sm":""} ${nc[a.niveau]||nc.info}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="text-lg">{ni[a.niveau]||"ℹ️"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className={`text-xs font-semibold ${!a.est_lue?"text-ardoise":"text-ardoise-clair"}`}>{a.titre}</p>
                      {!a.est_lue&&<span className="w-1.5 h-1.5 bg-lagune rounded-full" />}
                      <Badge variante={a.niveau==="critique"?"terre":a.niveau==="eleve"?"ocre":"lagune"} taille="petit">{a.niveau}</Badge>
                    </div>
                    <p className="text-xs text-ardoise-clair">{a.message}</p>
                    <p className="text-[10px] text-ardoise-clair/60 mt-0.5">{fmtDate(a.date_creation)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!a.est_lue&&<button onClick={()=>handleMarquerLue(a.id)} className="text-[10px] text-lagune hover:underline">Lue</button>}
                  <Link href={`/police/profil/${(a.donnees_liees as any)?.digiid||""}`} className="text-[10px] text-ocre hover:underline">→</Link>
                </div>
              </div>
            </div>
        ))}
      </div>
      <Link href="/police/dashboard"><Bouton variante="ghost">← Dashboard</Bouton></Link>
    </div>
  );
}
