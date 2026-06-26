"use client";

/**
 * Page profil détaillé d'une personne (consultation police).
 * Affiche toutes les données disponibles sur un citoyen :
 * identité, score, documents, signalements, vérifications, notes.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { obtenirProfilPersonne } from "@/services/police";
import type { ProfilPersonne } from "@/services/police";

export default function PageProfilPersonne() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { digiid } = useParams<{ digiid: string }>();
  const router = useRouter();
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
      setErreur("Impossible de charger le profil de cette personne.");
    } finally {
      setChargement(false);
    }
  }

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
        <h1>Profil citoyen</h1>
        <p className="text-ardoise-clair italic text-center py-12">Chargement du profil {digiid}...</p>
      </div>
    );
  }

  if (erreur || !profil) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
        <h1>Profil citoyen</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur || "Profil introuvable."}</p>
        </div>
        <Link href="/police/recherche"><Bouton variante="ghost">← Nouvelle recherche</Bouton></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <Link href="/police/recherche" className="hover:text-ocre">Recherche</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">{profil.nom || digiid}</span>
      </nav>

      <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>

      {/* En-tête identité */}
      <div className="carte">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-20 h-20 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-3xl font-bold flex-shrink-0">
            {profil.nom ? profil.nom.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-ardoise">{profil.nom || "Nom inconnu"}</h2>
              <Badge variante={profil.est_actif ? "succes" : "terre"}>
                {profil.est_actif ? "Actif" : "Inactif"}
              </Badge>
              <Badge variante="lagune">{profil.role}</Badge>
            </div>
            <p className="text-sm text-ardoise-clair font-mono">{profil.digiid}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              {profil.email && <span>✉️ {profil.email}</span>}
              {profil.telephone && <span>📞 {profil.telephone}</span>}
              {profil.ville && <span>📍 {profil.ville}{profil.pays ? `, ${profil.pays}` : ""}</span>}
            </div>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-3xl font-bold text-ocre">{profil.score}</p>
            <p className="text-xs text-ardoise-clair font-semibold uppercase">Score DigiID</p>
          </div>
        </div>
      </div>

      {/* Vérifications */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <VerifBadge label="Email vérifié" ok={profil.est_email_verifie} />
        <VerifBadge label="Visage vérifié" ok={profil.est_visage_verifie} />
        <VerifBadge label="CNI vérifiée" ok={profil.est_cni_verifiee} />
        <VerifBadge label="Date inscription" info={profil.date_inscription ? new Date(profil.date_inscription).toLocaleDateString("fr-FR") : "N/A"} />
      </div>

      {/* Grille détails */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Documents */}
        <Carte titre="Documents">
          {profil.documents?.length > 0 ? (
            <ul className="space-y-2">
              {profil.documents.map((doc: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm p-2 bg-sable rounded">
                  <span>📄</span>
                  <span className="text-ardoise">{doc.type || doc.nom || "Document"}</span>
                  <Badge variante={doc.est_valide ? "succes" : "terre"} taille="petit">
                    {doc.est_valide ? "Valide" : "Invalide"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ardoise-clair italic">Aucun document enregistré.</p>
          )}
        </Carte>

        {/* Signalements */}
        <Carte titre="Signalements">
          {profil.signalements?.length > 0 ? (
            <ul className="space-y-2">
              {profil.signalements.map((sig: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm p-2 bg-sable rounded">
                  <span className="text-ardoise">{sig.motif || "Signalement"}</span>
                  <Badge variante={sig.statut === "traite" ? "succes" : "ocre"} taille="petit">
                    {sig.statut || "En cours"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ardoise-clair italic">Aucun signalement.</p>
          )}
        </Carte>

        {/* Vérifications précédentes */}
        <Carte titre="Vérifications précédentes">
          {profil.verifications_precedentes?.length > 0 ? (
            <ul className="space-y-2">
              {profil.verifications_precedentes.map((verif: any, i: number) => (
                <li key={i} className="text-sm p-2 bg-sable rounded">
                  <p className="text-ardoise">{verif.type_verification || "Vérification"}</p>
                  <p className="text-xs text-ardoise-clair">
                    {verif.date_verification ? new Date(verif.date_verification).toLocaleDateString("fr-FR") : ""}
                    {verif.resultat ? ` · ${verif.resultat}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ardoise-clair italic">Aucune vérification précédente.</p>
          )}
        </Carte>
      </div>

      {/* Notes internes */}
      {profil.notes_internes?.length > 0 && (
        <Carte titre="Notes internes">
          <ul className="space-y-2">
            {profil.notes_internes.map((note: any, i: number) => (
              <li key={i} className="p-3 bg-sable rounded">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-ardoise">{note.titre || "Note"}</p>
                  {note.est_important && <span className="text-terre text-xs">⭐ Important</span>}
                </div>
                {note.contenu && <p className="text-xs text-ardoise-clair">{note.contenu}</p>}
                <p className="text-xs text-ardoise-clair/60 mt-1">
                  {note.date_creation ? new Date(note.date_creation).toLocaleDateString("fr-FR") : ""}
                  {note.categorie ? ` · ${note.categorie}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/police/verification?digiid=${digiid}`}>
          <Bouton variante="primaire">🔍 Nouvelle vérification</Bouton>
        </Link>
        <Link href={`/police/signalement?digiid=${digiid}`}>
          <Bouton variante="secondaire">🚨 Signaler</Bouton>
        </Link>
        <Link href={`/police/notes?digiid=${digiid}`}>
          <Bouton variante="ghost">📝 Ajouter une note</Bouton>
        </Link>
        <Link href="/police/recherche">
          <Bouton variante="ghost">← Nouvelle recherche</Bouton>
        </Link>
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          ⚠️ Consultation tracée et horodatée. ID officier enregistré.
          Tout accès non autorisé est passible de poursuites.
        </p>
      </div>
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
