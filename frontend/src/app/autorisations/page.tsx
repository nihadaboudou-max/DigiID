"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Modal } from "@/composants/commun/Modal";
import { useAuthentification } from "@/contextes/authentification";
import { obtenirMonActivite } from "@/services/profil";
import type { ActiviteUtilisateur } from "@/services/profil";
import { listerMesConsentements } from "@/services/consentements";
import type { ConsentementDetail } from "@/services/consentements";

export default function PageAutorisations() {
  return <EnvelopperEspaceProtege rolesAutorises={["citoyen","agent","medecin","police","ong","administrateur","super_administrateur"]}><Contenu /></EnvelopperEspaceProtege>;
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [activites, setActivites] = useState<ActiviteUtilisateur[]>([]);
  const [consentements, setConsentements] = useState<ConsentementDetail[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [accesDetail, setAccesDetail] = useState<ActiviteUtilisateur | null>(null);

  useEffect(() => { charger(); }, []);
  async function charger() {
    setChargement(true); setErreur("");
    try { const [a, c] = await Promise.all([obtenirMonActivite(50), listerMesConsentements()]); setActivites(a || []); setConsentements(c.consentements || []); }
    catch { setErreur("Erreur de chargement."); }
    setChargement(false);
  }

  const types = ["consultation_profil","acces_donnees","partage_digiid","connexion_reussie","modification_profil"];
  const accesProfil = activites.filter(a => types.some(t => a.type?.toLowerCase().includes(t)));
  const accesFiltres = accesProfil.filter(a => filtre === "mois" ? new Date(a.date) >= new Date(Date.now()-30*86400000) : filtre === "semaine" ? new Date(a.date) >= new Date(Date.now()-7*86400000) : true);
  const typesAcces = { consultations: accesFiltres.filter(a=>a.type==="consultation_profil"), connexions: accesFiltres.filter(a=>a.type==="connexion_reussie"), modifications: accesFiltres.filter(a=>a.type==="modification_profil") };

  if (!utilisateur) return null;

  return (
    <div className="space-y-6 apparition">
      <div><p className="text-ocre text-sm uppercase font-semibold tracking-wider">Vie privée</p><h1 className="mt-1">Mes autorisations</h1></div>
      {erreur && <p className="text-sm text-terre bg-terre/10 p-3 rounded">{erreur}</p>}
      <div className="grid grid-cols-4 gap-2">
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-lagune">{chargement?"...":accesProfil.length}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Accès</p></div>
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-ocre">{chargement?"...":typesAcces.consultations.length}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Consultations</p></div>
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-terre">{chargement?"...":consentements.filter(c=>!c.est_accorde).length}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Refusés</p></div>
        <div className="carte text-center p-3"><p className="text-2xl font-bold text-succes">{chargement?"...":consentements.filter(c=>c.est_accorde).length}</p><p className="text-[10px] uppercase text-ardoise-clair font-semibold">Consentements</p></div>
      </div>
      <div className="flex gap-2">{[{id:"tous",label:"Tout"},{id:"mois",label:"30j"},{id:"semaine",label:"7j"}].map(f=>(
        <button key={f.id} onClick={()=>setFiltre(f.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filtre===f.id?"bg-lagune text-white":"bg-sable text-ardoise-clair"}`}>{f.label}</button>
      ))}</div>
      <Carte titre="Qui a accédé à mes données">
        {chargement ? <p className="text-ardoise-clair italic text-center py-6">Chargement...</p>
        : accesFiltres.length === 0 ? <div className="text-center py-6"><p className="text-4xl mb-2">🔒</p><p className="text-ardoise-clair italic text-sm">Aucun accès.</p></div>
        : <div className="space-y-1">{[...accesFiltres].reverse().map((a,i)=>(
            <div key={a.id||i} className="flex items-center justify-between p-2 rounded hover:bg-sable cursor-pointer" onClick={()=>setAccesDetail(a)}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span>{a.type==="consultation_profil"?"👁️":a.type==="connexion_reussie"?"🔑":a.type==="modification_profil"?"✏️":"📋"}</span>
                <div className="min-w-0"><p className="text-sm font-medium text-ardoise truncate">{a.description||a.type.replace(/_/g," ")}</p><p className="text-[11px] text-ardoise-clair">{new Date(a.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p></div>
              </div>
              <Badge variante={a.type==="modification_profil"?"ocre":a.type==="connexion_reussie"?"succes":"lagune"} taille="petit">{a.type.replace(/_/g," ")}</Badge>
            </div>
          ))}</div>}
      </Carte>
      <Carte titre="Consentements">
        <div className="grid grid-cols-2 gap-2">
          {consentements.length>0?consentements.map(c=>(
            <div key={c.categorie} className="flex items-center justify-between p-2 bg-sable rounded"><p className="text-xs font-medium text-ardoise truncate">{c.titre}</p><Badge variante={c.est_accorde?"succes":"neutre"} taille="petit">{c.est_accorde?"✅":"❌"}</Badge></div>
          )):<p className="text-ardoise-clair italic text-sm col-span-2 text-center py-3">Aucun.</p>}
        </div>
        <div className="mt-2"><Link href="/consentements"><Bouton variante="ghost" taille="petit">Gérer →</Bouton></Link></div>
      </Carte>
      <Modal ouvert={accesDetail!==null} onFermer={()=>setAccesDetail(null)} titre="Détail">
        {accesDetail&&<div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-sable rounded"><p className="text-[10px] text-ardoise-clair uppercase">Type</p><p className="text-sm font-semibold text-ardoise">{accesDetail.type.replace(/_/g," ")}</p></div>
            <div className="p-2 bg-sable rounded"><p className="text-[10px] text-ardoise-clair uppercase">Date</p><p className="text-sm font-semibold text-ardoise">{new Date(accesDetail.date).toLocaleString("fr-FR")}</p></div>
          </div>
          {accesDetail.description&&<div className="p-2 bg-sable rounded"><p className="text-[10px] text-ardoise-clair uppercase">Description</p><p className="text-sm text-ardoise">{accesDetail.description}</p></div>}
          {accesDetail.adresse_ip&&<div className="p-2 bg-sable rounded"><p className="text-[10px] text-ardoise-clair uppercase">IP</p><p className="text-sm font-mono text-ardoise">{accesDetail.adresse_ip}</p></div>}
          <Bouton variante="ghost" onClick={()=>setAccesDetail(null)}>Fermer</Bouton>
        </div>}
      </Modal>
      <div className="flex gap-3"><Link href="/profil"><Bouton variante="primaire">← Profil</Bouton></Link><Link href="/consentements"><Bouton variante="secondaire">Consentements</Bouton></Link></div>
    </div>
  );
}
