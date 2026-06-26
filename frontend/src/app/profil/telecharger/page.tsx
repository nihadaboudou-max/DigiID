"use client";
import { useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { useAuthentification } from "@/contextes/authentification";
import { exporterMesDonnees, obtenirMonActivite } from "@/services/profil";
import { obtenirMonScore } from "@/services/score";

export default function PageTelecharger() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [chargement, setChargement] = useState(false);
  const [format, setFormat] = useState<string>("json");
  const [inclure, setInclure] = useState({
    profil: true,
    score: true,
    activite: true,
    documents: true,
    consentements: true,
    attestations: true,
  });
  const [message, setMessage] = useState<{ type: "succes" | "erreur" | "info"; texte: string } | null>(null);

  if (!utilisateur) return null;

  function basculerInclusion(key: keyof typeof inclure) {
    setInclure((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleExporter() {
    setChargement(true);
    setMessage(null);

    try {
      const donnees: Record<string, unknown> = {
        date_export: new Date().toISOString(),
        application: "DigiID",
        version: "v1",
      };

      if (inclure.profil) {
        const exportData = await exporterMesDonnees();
        donnees.profil = exportData.utilisateur || utilisateur;
      } else {
        donnees.profil = {
          prenom: utilisateur.prenom,
          nom: utilisateur.nom,
          email: utilisateur.email,
          digiid: utilisateur.digiid_public,
          role: utilisateur.role,
        };
      }

      if (inclure.score) {
        try {
          const scoreData = await obtenirMonScore();
          donnees.score = scoreData;
        } catch {
          donnees.score = { erreur: "Score non disponible" };
        }
      }

      if (inclure.activite) {
        try {
          const activite = await obtenirMonActivite(50);
          donnees.activite_recente = activite;
        } catch {
          donnees.activite_recente = [];
        }
      }

      // Générer le fichier
      const nomFichier = `digiid-profil-${utilisateur.digiid_public || "export"}-${new Date().toISOString().split("T")[0]}`;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nomFichier}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ type: "succes", texte: "Export JSON téléchargé avec succès !" });
      } else if (format === "pdf") {
        // Version HTML imprimable (convertible en PDF via le navigateur)
        const contenuHTML = genererHTMLProfil(donnees, utilisateur);
        const blob = new Blob([contenuHTML], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nomFichier}.html`;
        a.click();
        URL.revokeObjectURL(url);

        // Ouvrir dans un nouvel onglet pour impression
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(contenuHTML);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 500);
        }

        setMessage({
          type: "info",
          texte: "Document HTML généré. Utilise Ctrl+P (ou Cmd+P) pour imprimer en PDF.",
        });
      }
    } catch {
      setMessage({ type: "erreur", texte: "Erreur lors de la génération de l'export." });
    } finally {
      setChargement(false);
    }
  }

  if (!utilisateur) return null;

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/profil" className="hover:text-ocre">Mon profil</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Télécharger mon profil</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Export</p>
        <h1 className="mt-1">Télécharger mon profil</h1>
      </div>

      {message && (
        <Alerte variante={message.type === "succes" ? "succes" : message.type === "erreur" ? "erreur" : "info"}>
          {message.texte}
        </Alerte>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Format du fichier">
          <div className="space-y-2">
            <label onClick={()=>setFormat("json")} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 ${format==="json"?"border-lagune bg-lagune/5":"border-ardoise-clair/10 bg-sable"}`}>
              <input type="radio" name="format" value="json" checked={format==="json"} onChange={()=>{}} className="sr-only" />
              <span className="text-2xl">📄</span>
              <div><p className="font-bold text-ardoise text-sm">JSON</p><p className="text-[10px] text-ardoise-clair">Structuré, pour traitement</p></div>
            </label>
            <label onClick={()=>setFormat("pdf")} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 ${format==="pdf"?"border-lagune bg-lagune/5":"border-ardoise-clair/10 bg-sable"}`}>
              <input type="radio" name="format" value="pdf" checked={format==="pdf"} onChange={()=>{}} className="sr-only" />
              <span className="text-2xl">📋</span>
              <div><p className="font-bold text-ardoise text-sm">HTML/PDF</p><p className="text-[10px] text-ardoise-clair">Prêt à imprimer</p></div>
            </label>
          </div>
        </Carte>
        <Carte titre="Données">
          <div className="space-y-1">
            {[{key:"profil" as const,label:"Identité",icone:"👤"},{key:"score" as const,label:"Score",icone:"📊"},{key:"activite" as const,label:"Activité",icone:"🕐"},{key:"documents" as const,label:"Documents",icone:"📄"},{key:"consentements" as const,label:"Consentements",icone:"✅"},{key:"attestations" as const,label:"Attestations",icone:"📜"}].map(item=>(
              <label key={item.key} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-sable/50">
                <input type="checkbox" checked={inclure[item.key]} onChange={()=>basculerInclusion(item.key)} className="rounded" />
                <span>{item.icone}</span>
                <span className="text-xs text-ardoise">{item.label}</span>
              </label>
            ))}
          </div>
        </Carte>
      </div>

      <Carte titre="Aperçu">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold">
            {((utilisateur.prenom?.[0]||"")+(utilisateur.nom?.[0]||"")).toUpperCase()||"?"}
          </div>
          <div>
            <p className="font-bold text-ardoise text-sm">{[utilisateur.prenom,utilisateur.nom].filter(Boolean).join(" ")||utilisateur.email}</p>
            <p className="text-xs text-ardoise-clair font-mono">{utilisateur.digiid_public||"—"}</p>
          </div>
          <div className="flex gap-1 ml-auto">
            <Badge variante="lagune" taille="petit">{utilisateur.role?.replace(/_/g," ")}</Badge>
          </div>
        </div>
      </Carte>

      <div className="text-center">
        <Bouton variante="primaire" chargement={chargement} disabled={chargement} onClick={handleExporter}>
          {chargement ? "Génération..." : `📥 Télécharger (${format.toUpperCase()})`}
        </Bouton>
      </div>
      <div className="flex gap-2 justify-center">
        <Link href="/profil"><Bouton variante="ghost">← Profil</Bouton></Link>
        <Link href="/partage"><Bouton variante="secondaire">Partager</Bouton></Link>
      </div>
    </div>
  );
}

/**
 * Génère une version HTML complète du profil pour impression/PDF.
 */
function genererHTMLProfil(donnees: Record<string, unknown>, utilisateur: any): string {
  const nom = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;
  const dateExport = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const scoreData = donnees.score as any;
  const activiteData = donnees.activite_recente as any[] || [];

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Profil DigiID - ${nom}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: 'Helvetica', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #b45309; font-size: 28px; border-bottom: 3px solid #b45309; padding-bottom: 10px; }
    h2 { color: #0e7490; font-size: 20px; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header .digiid { font-family: monospace; font-size: 18px; color: #0e7490; letter-spacing: 2px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; margin: 2px; }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-no { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #e0f2fe; color: #075985; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f8fafc; font-weight: 600; }
    .score { font-size: 36px; font-weight: bold; color: #0e7490; text-align: center; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .encadre { border: 2px solid #b45309; padding: 15px; border-radius: 8px; background: #fffbeb; margin: 15px 0; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Profil Numérique DigiID</h1>
    <p class="digiid">${utilisateur.digiid_public || "—"}</p>
    <p>Généré le ${dateExport}</p>
  </div>

  <div class="encadre">
    <p><strong>${nom}</strong></p>
    <p>Rôle : ${utilisateur.role?.replace(/_/g, " ") || "—"}</p>
    <p>Email : ${utilisateur.email || "—"} ${utilisateur.est_email_verifie ? '<span class="badge badge-ok">✓ Vérifié</span>' : '<span class="badge badge-no">Non vérifié</span>'}</p>
    ${utilisateur.telephone ? `<p>Téléphone : ${utilisateur.telephone}</p>` : ""}
    ${utilisateur.ville ? `<p>Ville : ${utilisateur.ville}</p>` : ""}
  </div>

  ${scoreData && scoreData.score_total !== undefined ? `
  <h2>Score de confiance</h2>
  <div class="score">${scoreData.score_total}/100</div>
  <p style="text-align:center">Niveau : ${scoreData.niveau || "—"}</p>
  ` : ""}

  ${activiteData.length > 0 ? `
  <h2>Activité récente (${activiteData.length} événements)</h2>
  <table>
    <tr><th>Date</th><th>Type</th><th>Description</th></tr>
    ${activiteData.slice(0, 20).map((a: any) => `
      <tr>
        <td>${new Date(a.date).toLocaleDateString("fr-FR")}</td>
        <td>${(a.type || "").replace(/_/g, " ")}</td>
        <td>${a.description || "—"}</td>
      </tr>
    `).join("")}
  </table>
  ` : ""}

  <h2>Informations légales</h2>
  <p>Ce document est un export de vos données personnelles stockées sur DigiID.</p>
  <p>Conformément à la loi 2008-12 du Sénégal relative à la protection des données à caractère personnel.</p>

  <div class="footer">
    <p>DigiID — Identité Numérique Africaine</p>
    <p>Document généré automatiquement le ${dateExport}</p>
  </div>
</body>
</html>`;
}
