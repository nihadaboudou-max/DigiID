"use client";

/**
 * Scan CNI — agent terrain.
 * Réutilise le module verification-cni (UploadCNI + ResultatCNI).
 */
import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import UploadCNI from "@/composants/verification-cni/UploadCNI";
import ResultatCNI from "@/composants/verification-cni/ResultatCNI";
import { useRoleUI } from "@/crochets/useRoleUI";
import { modifierEnrolement } from "@/services/enrolement";
import type { ReponseUploadCNI } from "@/services/verification_cni";

export default function ScanPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Suspense fallback={<Chargement />}>
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Chargement() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-ardoise-clair animate-pulse">Chargement...</p>
    </div>
  );
}

function Contenu() {
  const { can, chargement: chargementPerms, avertissement } = useRoleUI();
  const searchParams = useSearchParams();
  const router = useRouter();
  const enrolementId = searchParams.get("enrolement_id");

  const [resultatRecto, setResultatRecto] = useState<ReponseUploadCNI | null>(null);
  const [resultatVerso, setResultatVerso] = useState<ReponseUploadCNI | null>(null);
  const [imageRecto, setImageRecto] = useState<string | null>(null);
  const [imageVerso, setImageVerso] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [marquage, setMarquage] = useState(false);

  const appliquerDonneesOCR = useCallback((resultat: ReponseUploadCNI) => {
    const d = resultat.resultat_ocr?.donnees;
    if (!d) return;
    // Stocke pour préremplir l'enrôlement si l'agent y retourne
    try {
      sessionStorage.setItem(
        "digiid_ocr_enrolement",
        JSON.stringify({
          nom: d.nom_famille || "",
          prenom: d.prenoms || "",
          numero_cni: d.numero_cni || "",
          date_naissance: d.date_naissance || "",
        }),
      );
    } catch {
      // sessionStorage indisponible — ignorer
    }
  }, []);

  const marquerScanSurEnrolement = useCallback(
    async (resultat: ReponseUploadCNI) => {
      if (!enrolementId || !resultat.resultat_ocr?.succes) return;
      setMarquage(true);
      try {
        await modifierEnrolement(enrolementId, { scan_cni: true });
        setSucces("Scan CNI enregistré sur l'enrôlement.");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Impossible de marquer le scan sur l'enrôlement";
        setErreur(msg);
      } finally {
        setMarquage(false);
      }
    },
    [enrolementId],
  );

  const handleSuccesRecto = useCallback(
    async (resultat: ReponseUploadCNI, imageUrl?: string) => {
      setResultatRecto(resultat);
      setErreur("");
      if (imageUrl) setImageRecto(imageUrl);
      appliquerDonneesOCR(resultat);

      if (resultat.resultat_ocr?.succes) {
        setSucces("OCR recto réussi — données extraites.");
        await marquerScanSurEnrolement(resultat);
      } else {
        const nb = resultat.resultat_ocr?.champs_extraits ?? 0;
        setErreur(
          `L'OCR n'a pas pu extraire assez de données (${nb} champ(s)). Réessaie avec une photo mieux cadrée.`,
        );
      }
    },
    [appliquerDonneesOCR, marquerScanSurEnrolement],
  );

  const handleSuccesVerso = useCallback(
    async (resultat: ReponseUploadCNI, imageUrl?: string) => {
      setResultatVerso(resultat);
      setErreur("");
      if (imageUrl) setImageVerso(imageUrl);
      if (resultat.resultat_ocr?.succes) {
        setSucces("OCR verso réussi.");
        await marquerScanSurEnrolement(resultat);
      }
    },
    [marquerScanSurEnrolement],
  );

  if (chargementPerms) return <Chargement />;

  if (!can.scanCNI) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Scan CNI</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module scan désactivé.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  const aResultat = resultatRecto || resultatVerso;

  return (
    <div className="space-y-8 apparition">
      {avertissement && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm text-ocre">{avertissement}</p>
        </div>
      )}

      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/agent/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Scan CNI</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Scan de carte d&apos;identité</h1>
        <p className="text-ardoise-clair mt-2">
          Module OCR DigiID — upload recto/verso pour extraire automatiquement les données de la CNI.
        </p>
      </div>

      {enrolementId && (
        <Alerte variante="info">
          Scan lié à l&apos;enrôlement <span className="font-mono text-xs">{enrolementId.slice(0, 8)}…</span>
          {marquage && " — enregistrement en cours…"}
        </Alerte>
      )}

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}
      {succes && <Alerte variante="succes">{succes}</Alerte>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadCNI
          face="recto"
          label="Recto de la CNI"
          description="Face avant avec photo et identité"
          onSucces={handleSuccesRecto}
          onErreur={setErreur}
        />
        <UploadCNI
          face="verso"
          label="Verso de la CNI"
          description="Face arrière (informations complémentaires)"
          onSucces={handleSuccesVerso}
          onErreur={setErreur}
        />
      </div>

      {aResultat && (
        <Carte titre="Résultats OCR">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-ardoise uppercase tracking-wide mb-3">Recto</h3>
              <ResultatCNI
                resultat={resultatRecto}
                synthese={null}
                imageUrl={imageRecto}
                face="recto"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ardoise uppercase tracking-wide mb-3">Verso</h3>
              <ResultatCNI
                resultat={resultatVerso}
                synthese={null}
                imageUrl={imageVerso}
                face="verso"
              />
            </div>
          </div>
        </Carte>
      )}

      <div className="flex flex-wrap gap-3">
        {resultatRecto?.resultat_ocr?.succes && (
          <Bouton
            variante="primaire"
            onClick={() => router.push("/agent/enrolement?depuis_scan=1")}
          >
            Créer un enrôlement avec ces données
          </Bouton>
        )}
        {enrolementId && (
          <Link href={`/agent/enrolement/${enrolementId}`}>
            <Bouton variante="secondaire">Retour à l&apos;enrôlement</Bouton>
          </Link>
        )}
        <Link href="/agent/dashboard">
          <Bouton variante="ghost">Tableau de bord</Bouton>
        </Link>
      </div>
    </div>
  );
}
