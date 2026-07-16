"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { obtenirProfilPersonne } from "@/services/police";
import type { ProfilPersonne } from "@/services/police";

export default function PageProfilPersonne() {
  return <EnvelopperEspaceProtege rolesAutorises={["agent_police", "chef_police"]}><Contenu /></EnvelopperEspaceProtege>;
}

function Contenu() {
  const { digiid } = useParams<{ digiid: string }>();
  const [profil, setProfil] = useState<ProfilPersonne | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!digiid) return;
    charger();
  }, [digiid]);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const data = await obtenirProfilPersonne(digiid);
      setProfil(data);
    } catch {
      setErreur("Erreur de chargement.");
    } finally {
      setChargement(false);
    }
  }

  if (chargement) return <div className="space-y-6 apparition"><p className="text-ocre text-xs uppercase font-semibold">Police</p><h1>Profil citoyen</h1><p className="text-ardoise-clair italic text-center py-8">Chargement...</p></div>;
  if (erreur || !profil) return (
    <div className="space-y-6 apparition">
      <p className="text-ocre text-xs uppercase font-semibold">Police</p>
      <h1>Profil citoyen</h1>
      <p className="text-sm text-terre bg-terre/10 p-3 rounded">{erreur||"Introuvable."}</p>
      <Link href="/police/recherche"><Bouton variante="ghost">← Recherche</Bouton></Link>
    </div>
  );

  return (
    <div className="space-y-8 apparition">
      <nav className="text-xs text-ardoise-clair flex gap-1">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link><span>/</span>
        <Link href="/police/recherche" className="hover:text-ocre">Recherche</Link><span>/</span>
        <span className="text-ardoise">{profil.nom||digiid}</span>
      </nav>
      <p className="text-ocre text-xs uppercase font-semibold">Forces de l'ordre</p>

      <div className="carte">
        <div className="flex gap-4 items-start">
          <div className="w-14 h-14 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-xl font-bold">
            {profil.nom?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()||"?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-ardoise">{profil.nom||digiid}</h2>
              <Badge variante={profil.est_actif?"succes":"terre"} taille="petit">{profil.est_actif?"Actif":"Inactif"}</Badge>
              <Badge variante="lagune" taille="petit">{profil.role}</Badge>
            </div>
            <p className="text-xs text-ardoise-clair font-mono">{profil.digiid}</p>
            <div className="flex gap-3 mt-1 text-xs">
              {profil.email&&<span>✉️ {profil.email}</span>}
              {profil.telephone&&<span>📞 {profil.telephone}</span>}
              {profil.ville&&<span>📍 {profil.ville}</span>}
            </div>
          </div>
          <div className="text-center"><p className="text-2xl font-bold text-ocre">{profil.score}</p><p className="text-[10px] text-ardoise-clair font-semibold uppercase">Score</p></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <VerifBadge label="Email" ok={profil.est_email_verifie} />
        <VerifBadge label="Visage" ok={profil.est_visage_verifie} />
        <VerifBadge label="CNI" ok={profil.est_cni_verifiee} />
        <VerifBadge label="Inscrit" info={profil.date_inscription?new Date(profil.date_inscription).toLocaleDateString("fr-FR"):"—"} />
      </div>

      {/* Grille détails */}
      <div className="grid md:grid-cols-3 gap-6">
        <Carte titre="Documents">
          {profil.documents?.length>0?<ul className="space-y-1">{profil.documents.map((d:any,i:number)=>(
            <li key={i} className="flex items-center gap-2 text-xs p-1.5 bg-sable rounded">
              <span>📄</span><span className="text-ardoise">{d.type||d.nom||"Doc"}</span>
              <Badge variante={d.est_valide?"succes":"terre"} taille="petit">{d.est_valide?"✓":"✗"}</Badge>
            </li>
          ))}</ul>:<p className="text-xs text-ardoise-clair italic">Aucun.</p>}
        </Carte>

        <Carte titre="Signalements">
          {profil.signalements?.length>0?<ul className="space-y-1">{profil.signalements.map((s:any,i:number)=>(
            <li key={i} className="flex items-center justify-between text-xs p-1.5 bg-sable rounded">
              <span className="text-ardoise">{s.motif||"Signalement"}</span>
              <Badge variante={s.statut==="traite"?"succes":"ocre"} taille="petit">{s.statut||"En cours"}</Badge>
            </li>
          ))}</ul>:<p className="text-xs text-ardoise-clair italic">Aucun.</p>}
        </Carte>

        <Carte titre="Vérifications précédentes">
          {profil.verifications_precedentes?.length>0?<ul className="space-y-1">{profil.verifications_precedentes.map((v:any,i:number)=>(
            <li key={i} className="text-xs p-1.5 bg-sable rounded">
              <p className="text-ardoise">{v.type_verification||"Vérification"}</p>
              <p className="text-[10px] text-ardoise-clair">{v.date_verification?new Date(v.date_verification).toLocaleDateString("fr-FR"):""}{v.resultat?` · ${v.resultat}`:""}</p>
            </li>
          ))}</ul>:<p className="text-xs text-ardoise-clair italic">Aucune.</p>}
        </Carte>
      </div>

      {profil.notes_internes?.length>0&&<Carte titre="Notes">
        <ul className="space-y-1">{profil.notes_internes.map((n:any,i:number)=>(
          <li key={i} className="p-2 bg-sable rounded">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-ardoise">{n.titre||"Note"}</p>{n.est_important&&<span className="text-terre text-[10px]">⭐</span>}</div>
            {n.contenu&&<p className="text-[10px] text-ardoise-clair">{n.contenu}</p>}
          </li>
        ))}</ul>
      </Carte>}

      <div className="flex flex-wrap gap-2">
        <Link href={`/police/verification?digiid=${digiid}`}><Bouton variante="primaire" taille="petit">🔍 Vérifier</Bouton></Link>
        <Link href={`/police/signalement?digiid=${digiid}`}><Bouton variante="secondaire" taille="petit">🚨 Signaler</Bouton></Link>
        <Link href={`/police/notes?digiid=${digiid}`}><Bouton variante="ghost" taille="petit">📝 Note</Bouton></Link>
        <Link href="/police/recherche"><Bouton variante="ghost" taille="petit">← Recherche</Bouton></Link>
      </div>
      <div className="bg-ocre/5 p-2 rounded"><p className="text-[10px] text-ardoise-clair">⚠️ Consultation tracée.</p></div>
    </div>
  );
}

function VerifBadge({ label, ok, info }: { label: string; ok?: boolean; info?: string }) {
  return (
    <div className="carte text-center">
      <p className="text-2xl mb-1">{ok !== undefined ? (ok ? "✅" : "❌") : "—"}</p>
      <p className="text-xs font-semibold text-ardoise-clair uppercase">{label}</p>
      {info && <p className="text-xs text-ardoise-clair/70 mt-1">{info}</p>}
    </div>
  );
}
