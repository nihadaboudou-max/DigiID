"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { useRoleUI } from "@/crochets/useRoleUI";
import { verifierIdentite, rechercherPersonne } from "@/services/police";
import type { PersonneRecherchee } from "@/services/police";

export default function VerificationPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police", "chef_police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [digiid, setDigiid] = useState("");
  const [personnes, setPersonnes] = useState<PersonneRecherchee[]>([]);
  const [personneSelectionnee, setPersonneSelectionnee] = useState<PersonneRecherchee | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [enRecherche, setEnRecherche] = useState(false);

  async function handleRecherche() {
    if (!digiid) return;
    setEnRecherche(true);
    setErreur("");
    setPersonnes([]);
    setPersonneSelectionnee(null);
    setResultat(null);
    try {
      const resultats = await rechercherPersonne(digiid);
      if (resultats && resultats.length > 0) {
        setPersonnes(resultats);
      } else {
        setErreur("Personne non trouvée dans le système DigiID");
        setResultat("infirme");
        await verifierIdentite({ personne_digiid: digiid, notes: "Non trouvé" });
      }
    } catch {
      setErreur("Erreur lors de la recherche");
      setResultat("infirme");
    } finally {
      setEnRecherche(false);
    }
  }

  async function handleVerification(p: PersonneRecherchee) {
    setPersonneSelectionnee(p);
    try {
      await verifierIdentite({ personne_digiid: p.digiid || digiid, personne_nom: p.nom });
      setResultat("confirme");
    } catch {
      setErreur("Erreur lors de la vérification");
      setResultat("infirme");
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/police/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Verification identite</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l ordre</p>
        <h1 className="mt-1">Verification d identite</h1>
        <p className="text-ardoise-clair mt-2">
          Retrouve une personne par son <strong>numero CNI</strong>, son DigiID, son nom ou son telephone.
          En cas de carte perdue, tu peux aussi la retrouver sans le document physique.
        </p>
      </div>

      {/* ========== RECHERCHE D UNE PERSONNE ========== */}
      <Carte titre="⌨️ Recherche d une personne">
        <div className="max-w-md space-y-4">
          <p className="text-sm text-ardoise-clair">
            Saisis le <strong>numero CNI</strong>, le <strong>DigiID</strong>, le <strong>nom</strong> ou le
            <strong> telephone</strong> de la personne a identifier.
          </p>
          <ChampSaisie
            libelle="Numero CNI, DigiID, nom ou telephone"
            value={digiid}
            onChange={(e) => setDigiid(e.target.value)}
            placeholder="Ex: 5005310826, DIG-A1B2C3D4E5F6, Awa Diop ou 771234567"
          />
          <Bouton variante="primaire" disabled={digiid.length < 4 || enRecherche}
            onClick={handleRecherche} id="btn-recherche-digiid">
            {enRecherche ? "Recherche..." : "Verifier l identite"}
          </Bouton>
        </div>
      </Carte>

      {/* ========== ERREURS ========== */}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* ========== LISTE DES RESULTATS ========== */}
      {personnes.length > 0 && !personneSelectionnee && (
        <Carte titre={`🔍 ${personnes.length} personne${personnes.length > 1 ? 's' : ''} trouvée${personnes.length > 1 ? 's' : ''}`}>
          <div className="space-y-3">
            <p className="text-sm text-ardoise-clair">
              Clique sur <strong>Vérifier</strong> pour confirmer l'identité de la personne.
            </p>
            {personnes.map((p, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-sable/50 rounded-lg border border-ardoise-clair/10 hover:border-ocre/30 transition-all"
              >
                {p.photo_url ? (
                  <img src={p.photo_url} alt="Photo" className="w-14 h-14 rounded-full object-cover border-2 border-lagune/30 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold text-lg shrink-0">
                    {(p.nom || "?").split(" ").map((n) => n[0] || "").join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ardoise truncate">{p.nom || "Nom inconnu"}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {p.numero_cni && (
                      <span className="text-xs text-ardoise-clair">CNI: {p.numero_cni}</span>
                    )}
                    {p.telephone && (
                      <span className="text-xs text-ardoise-clair">📞 {p.telephone}</span>
                    )}
                    {p.email && (
                      <span className="text-xs text-ardoise-clair">✉️ {p.email}</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variante={p.est_actif ? "succes" : "terre"} taille="petit">
                      {p.est_actif ? "Actif" : "Inactif"}
                    </Badge>
                    <span className="text-xs text-ardoise-clair">Score: {p.score}</span>
                    {p.est_verifie && (
                      <Badge variante="lagune" taille="petit">✓ Vérifié</Badge>
                    )}
                  </div>
                </div>
                <Bouton
                  variante="primaire"
                  taille="petit"
                  onClick={() => handleVerification(p)}
                >
                  ✅ Vérifier
                </Bouton>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {/* ========== RESULTAT CONFIRME ========== */}
      {resultat === "confirme" && personneSelectionnee && (
        <Carte titre="✅ Identite confirmee">
          <div className="flex items-center gap-4 p-3 bg-succes/5 rounded-lg">
            {personneSelectionnee.photo_url ? (
              <img src={personneSelectionnee.photo_url} alt="Photo" className="w-16 h-16 rounded-full object-cover border-2 border-lagune/30" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-succes/10 flex items-center justify-center text-succes font-bold text-xl">
                {(personneSelectionnee.nom || "?").split(" ").map((n) => n[0] || "").join("").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <p className="font-bold text-lg text-ardoise">{personneSelectionnee.nom || "Nom inconnu"}</p>
              {personneSelectionnee.numero_cni && (
                <p className="text-sm text-ardoise-clair">N° CNI: {personneSelectionnee.numero_cni}</p>
              )}
              {personneSelectionnee.telephone && (
                <p className="text-sm text-ardoise-clair"> {personneSelectionnee.telephone}</p>
              )}
              {personneSelectionnee.email && (
                <p className="text-sm text-ardoise-clair">✉️ {personneSelectionnee.email}</p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variante={personneSelectionnee.est_actif ? "succes" : "terre"}>
                  {personneSelectionnee.est_actif ? "Actif" : "Inactif"}
                </Badge>
                <span className="text-xs text-ardoise-clair">Score: {personneSelectionnee.score}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Bouton variante="secondaire" onClick={() => {
              setPersonneSelectionnee(null);
              setResultat(null);
            }}>
              ← Voir les autres résultats
            </Bouton>
          </div>
        </Carte>
      )}

      {/* ========== RESULTAT INFIRME ========== */}
      {resultat === "infirme" && !personneSelectionnee && personnes.length === 0 && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre font-semibold">Identite non confirmee</p>
          <p className="text-xs text-ardoise-clair mt-1">{erreur || "Aucune correspondance trouvée"}</p>
        </div>
      )}

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">Cette verification a ete enregistree dans l historique.</p>
      </div>

      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}