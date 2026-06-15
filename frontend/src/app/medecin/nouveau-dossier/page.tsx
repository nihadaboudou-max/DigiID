"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";
import { creerDossier, verifierPatient } from "@/services/medical";
import type { VerificationPatient } from "@/services/medical";

export default function NouveauDossier() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const router = useRouter();
  const [patient_nom, setPatientNom] = useState("");
  const [patient_digiid, setPatientDigiid] = useState("");
  const [motif, setMotif] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [etape, setEtape] = useState<"recherche" | "verification" | "formulaire" | "confirmation">("recherche");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [patientVerifie, setPatientVerifie] = useState<VerificationPatient | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState(false);

  if (!can.createMedicalRecord) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace medical</p>
        <h1>Creation de dossier</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module desactive. Contacte le super administrateur.</p>
        </div>
        <Link href="/medecin/dashboard"><Bouton variante="ghost">← Retour</Bouton></Link>
      </div>
    );
  }

  async function handleCreer() {
    setEnvoi(true);
    setErreur("");
    try {
      const dossier = await creerDossier({
        patient_nom,
        patient_digiid,
        motif,
        diagnostic: diagnostic || undefined,
      });
      setEtape("confirmation");
    } catch (e: any) {
      setErreur(e.message || "Erreur lors de la creation du dossier");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Nouveau dossier</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace medical</p>
        <h1 className="mt-1">Nouveau dossier medical</h1>
        <p className="text-ardoise-clair mt-2">Cree un dossier medical pour un patient identifie par son DigiID.</p>
      </div>

      {etape === "recherche" && (
        <Carte titre="Identification du patient">
          <p className="text-sm text-ardoise-clair mb-4">Saisis le nom complet et le DigiID du citoyen.</p>
          <div className="max-w-md space-y-4">
            <ChampSaisie libelle="Nom complet du patient" value={patient_nom}
              onChange={(e) => setPatientNom(e.target.value)}
              placeholder="Ex: Fatou Diallo" />
            <ChampSaisie libelle="DigiID du patient" value={patient_digiid}
              onChange={(e) => setPatientDigiid(e.target.value)}
              placeholder="Ex: DIG-A1B2C3D4E5F6" />
            <Bouton variante="primaire" chargement={verificationEnCours}
              disabled={patient_nom.length < 3 || patient_digiid.length < 4}
              onClick={async () => {
                setVerificationEnCours(true);
                setErreur("");
                try {
                  const resultat = await verifierPatient(patient_digiid);
                  if (resultat.trouvé) {
                    setPatientVerifie(resultat);
                    setEtape("formulaire");
                  } else {
                    setErreur(`Aucun citoyen trouvé avec le DigiID "${patient_digiid}". Vérifie l'identifiant.`);
                  }
                } catch (e: any) {
                  setErreur(e.message_utilisateur || "Erreur lors de la vérification du DigiID");
                } finally {
                  setVerificationEnCours(false);
                }
              }}>
              Vérifier →
            </Bouton>
          </div>
        </Carte>
      )}

      {etape === "verification" && (
        <Carte titre="Vérification en cours...">
          <p className="text-sm text-ardoise-clair">Vérification du DigiID...</p>
        </Carte>
      )}

      {etape === "formulaire" && (
        <>
          <Carte titre="Informations patient vérifié">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold">DigiID</p>
                <p className="text-sm font-medium">{patient_digiid}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Nom complet</p>
                <p className="text-sm font-medium">{patient_nom}</p>
              </div>
              {patientVerifie?.prenom && (
                <div>
                  <p className="text-xs uppercase text-ardoise-clair font-semibold">Prénom</p>
                  <p className="text-sm font-medium">{patientVerifie.prenom}</p>
                </div>
              )}
              {patientVerifie?.email && (
                <div>
                  <p className="text-xs uppercase text-ardoise-clair font-semibold">Email</p>
                  <p className="text-sm font-medium">{patientVerifie.email}</p>
                </div>
              )}
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-vert/10 text-vert text-xs rounded-full font-medium">
                ✓ Citoyen vérifié
              </span>
            </div>
          </Carte>

          <Carte titre="Dossier medical">
            <div className="space-y-4 max-w-lg">
              <ChampSaisie libelle="Motif de la consultation" value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex: Consultation de routine" />
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                  Diagnostic / Observations
                </label>
                <textarea value={diagnostic} onChange={(e) => setDiagnostic(e.target.value)}
                  rows={5} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                  placeholder="Description detaillee du diagnostic..." />
              </div>
              {erreur && <p className="text-red-600 text-sm">{erreur}</p>}
            </div>
          </Carte>

          <div className="flex gap-3">
            <Bouton variante="primaire" disabled={!motif || envoi} onClick={handleCreer}>
              {envoi ? "Creation en cours..." : "Creer le dossier"}
            </Bouton>
            <Bouton variante="ghost" onClick={() => setEtape("recherche")}>Annuler</Bouton>
          </div>
        </>
      )}

      {etape === "confirmation" && (
        <Carte titre="Dossier cree avec succes !">
          <p className="text-sm text-ardoise-clair mb-4">
            Le dossier medical de <strong>{patient_nom}</strong> ({patient_digiid}) a ete cree.
          </p>
          <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
            <p className="text-sm"><strong>Motif :</strong> {motif}</p>
            {diagnostic && <p className="text-sm"><strong>Diagnostic :</strong> {diagnostic}</p>}
          </div>
          <div className="flex gap-3">
            <Link href="/medecin/dossiers"><Bouton variante="primaire">Voir les dossiers</Bouton></Link>
            <Bouton variante="ghost" onClick={() => {
              setEtape("recherche"); setMotif(""); setDiagnostic(""); setPatientNom(""); setPatientDigiid("");
            }}>
              Nouveau dossier
            </Bouton>
          </div>
        </Carte>
      )}

      <Link href="/medecin/dashboard"><Bouton variante="ghost">← Retour</Bouton></Link>
    </div>
  );
}
