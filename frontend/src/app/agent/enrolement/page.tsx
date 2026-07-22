"use client";

/**
 * Enrôlement citoyen — agent terrain.
 * Formulaire API + préremplissage OCR via le module verification-cni.
 */
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import UploadCNI from "@/composants/verification-cni/UploadCNI";
import ResultatCNI from "@/composants/verification-cni/ResultatCNI";
import { useRoleUI } from "@/crochets/useRoleUI";
import { creerEnrolement, modifierEnrolement } from "@/services/enrolement";
import type { Enrolement } from "@/services/enrolement";
import type { ReponseUploadCNI } from "@/services/verification_cni";

export default function EnrolementPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-ardoise-clair animate-pulse">Chargement...</p>
          </div>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement, erreur, avertissement } = useRoleUI();
  const searchParams = useSearchParams();
  const depuisScan = searchParams.get("depuis_scan") === "1";

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [numeroCni, setNumeroCni] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState(false);
  const [enrolementCree, setEnrolementCree] = useState<Enrolement | null>(null);
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const [etape, setEtape] = useState<number | null>(null);
  const [resultatOcr, setResultatOcr] = useState<ReponseUploadCNI | null>(null);
  const [imageOcr, setImageOcr] = useState<string | null>(null);
  const [erreurOcr, setErreurOcr] = useState("");
  const [scanIntegre, setScanIntegre] = useState(false);

  // Étape initiale : scan si autorisé, sinon formulaire
  useEffect(() => {
    if (chargement || etape !== null) return;
    if (depuisScan) {
      try {
        const brut = sessionStorage.getItem("digiid_ocr_enrolement");
        if (brut) {
          const data = JSON.parse(brut) as {
            nom?: string;
            prenom?: string;
            numero_cni?: string;
          };
          if (data.nom) setNom(data.nom);
          if (data.prenom) setPrenom(data.prenom);
          if (data.numero_cni) {
            setNumeroCni(data.numero_cni);
            setNotes((n) => (n ? n : `CNI n° ${data.numero_cni}`));
          }
          setScanIntegre(true);
        }
      } catch {
        // ignore
      }
      setEtape(1);
      return;
    }
    setEtape(can.scanCNI ? 0 : 1);
  }, [chargement, can.scanCNI, depuisScan, etape]);

  if (chargement || etape === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ardoise-clair animate-pulse">Chargement des permissions...</p>
      </div>
    );
  }

  if (erreur && !can.enroll) {
    return (
      <div className="space-y-8 apparition">
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  if (!can.enroll) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
        <h1>Enrôlement</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module désactivé pour votre rôle.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  async function handleSuccesOcr(resultat: ReponseUploadCNI, imageUrl?: string) {
    setResultatOcr(resultat);
    setErreurOcr("");
    if (imageUrl) setImageOcr(imageUrl);

    const d = resultat.resultat_ocr?.donnees;
    if (!d || !resultat.resultat_ocr?.succes) {
      setErreurOcr("OCR incomplet — tu peux quand même saisir les données manuellement.");
      return;
    }

    if (d.nom_famille) setNom(d.nom_famille);
    if (d.prenoms) setPrenom(d.prenoms);
    if (d.numero_cni) {
      setNumeroCni(d.numero_cni);
      setNotes((n) => (n.includes(d.numero_cni!) ? n : [n, `CNI n° ${d.numero_cni}`].filter(Boolean).join(" — ")));
    }
    setScanIntegre(true);
    setEtape(1);
  }

  async function handleSubmit() {
    if (!nom || !prenom || !telephone) return;
    setEnvoi(true);
    setErreurEnvoi("");
    try {
      const cree = await creerEnrolement({
        citoyen_nom: nom,
        citoyen_prenom: prenom,
        citoyen_telephone: telephone,
        citoyen_email: email || undefined,
        notes: notes || undefined,
      });

      if (scanIntegre && cree.id) {
        try {
          const maj = await modifierEnrolement(cree.id, { scan_cni: true });
          setEnrolementCree(maj);
        } catch {
          setEnrolementCree(cree);
        }
      } else {
        setEnrolementCree(cree);
      }

      try {
        sessionStorage.removeItem("digiid_ocr_enrolement");
      } catch {
        // ignore
      }
      setSucces(true);
    } catch (e: unknown) {
      const err = e as { message_utilisateur?: string; message?: string };
      setErreurEnvoi(err?.message_utilisateur || err.message || "Erreur lors de l'enrôlement");
    } finally {
      setEnvoi(false);
    }
  }

  function reinitialiser() {
    setSucces(false);
    setEnrolementCree(null);
    setNom("");
    setPrenom("");
    setTelephone("");
    setEmail("");
    setNotes("");
    setNumeroCni("");
    setEtape(can.scanCNI ? 0 : 1);
    setResultatOcr(null);
    setImageOcr(null);
    setScanIntegre(false);
    setErreurOcr("");
  }

  if (succes && enrolementCree) {
    return (
      <div className="space-y-8 apparition">
        <Carte titre="Enrôlement réussi">
          <div className="flex items-center gap-4 mb-6 p-4 bg-succes/5 rounded-lg border border-succes/20">
            <div>
              <p className="text-lg font-bold text-ardoise">
                {prenom} {nom} a été enrôlé avec succès.
              </p>
              <p className="text-sm text-ardoise-clair">
                Le citoyen peut maintenant utiliser les services DigiID.
              </p>
            </div>
          </div>
          <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
            <h3 className="font-semibold text-ardoise">Récapitulatif</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Nom :</strong> {prenom} {nom}</p>
              <p><strong>Téléphone :</strong> {telephone}</p>
              {email && <p className="col-span-2"><strong>Email :</strong> {email}</p>}
              {numeroCni && <p className="col-span-2"><strong>N° CNI :</strong> {numeroCni}</p>}
              <p className="col-span-2">
                <strong>Scan CNI :</strong>{" "}
                {enrolementCree.scan_cni ? "Effectué" : "Non effectué"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Bouton variante="primaire" onClick={reinitialiser}>
              + Nouvel enrôlement
            </Bouton>
            {!enrolementCree.scan_cni && can.scanCNI && (
              <Link href={`/agent/scan?enrolement_id=${enrolementCree.id}`}>
                <Bouton variante="secondaire">Scanner la CNI</Bouton>
              </Link>
            )}
            {can.captureBiometrics && (
              <Link href={`/agent/capture?enrolement_id=${enrolementCree.id}`}>
                <Bouton variante="secondaire">Capture biométrique</Bouton>
              </Link>
            )}
            <Link href={`/agent/enrolement/${enrolementCree.id}`}>
              <Bouton variante="ghost">Voir le détail</Bouton>
            </Link>
            <Link href="/agent/dashboard"><Bouton variante="ghost">Tableau de bord</Bouton></Link>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {avertissement && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm text-ocre">{avertissement}</p>
        </div>
      )}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/agent/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Nouvel enrôlement</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Enrôlement citoyen</h1>
        <p className="text-ardoise-clair mt-2">
          Inscris un nouveau citoyen — saisie manuelle ou préremplissage via scan CNI (OCR).
        </p>
      </div>

      {/* Étape 0 : scan CNI optionnel */}
      {can.scanCNI && etape === 0 && (
        <Carte titre="Scanner la CNI (optionnel)">
          <p className="text-sm text-ardoise-clair mb-4">
            Utilise le module OCR pour préremplir nom et prénom, ou passe directement à la saisie.
          </p>
          {erreurOcr && <Alerte variante="avertissement">{erreurOcr}</Alerte>}
          <div className="mb-4">
            <UploadCNI
              face="recto"
              label="Recto de la CNI"
              description="Photo de la face avant pour extraction OCR"
              onSucces={handleSuccesOcr}
              onErreur={setErreurOcr}
            />
          </div>
          {resultatOcr && (
            <div className="mb-4">
              <ResultatCNI
                resultat={resultatOcr}
                synthese={null}
                imageUrl={imageOcr}
                face="recto"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Bouton variante="primaire" onClick={() => setEtape(1)} disabled={!nom && !prenom && !resultatOcr}>
              Continuer vers le formulaire →
            </Bouton>
            <Bouton variante="ghost" onClick={() => setEtape(1)}>
              Saisie manuelle (sans scan)
            </Bouton>
          </div>
        </Carte>
      )}

      {etape >= 1 && (
        <Carte titre="Identité du citoyen">
          {scanIntegre && (
            <Alerte variante="succes" className="mb-4">
              Données préremplies depuis le scan OCR
              {numeroCni ? ` (CNI ${numeroCni})` : ""}.
            </Alerte>
          )}

          <div className="flex items-center gap-2 mb-6">
            {can.scanCNI && (
              <>
                <div className={`flex items-center gap-2 ${etape >= 0 ? "text-ocre" : "text-ardoise-clair/40"}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-ocre text-white">0</div>
                  <span className="text-sm font-medium">Scan</span>
                </div>
                <div className="flex-1 h-px bg-ocre" />
              </>
            )}
            <div className={`flex items-center gap-2 ${etape >= 1 ? "text-ocre" : "text-ardoise-clair/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${etape >= 1 ? "bg-ocre text-white" : "bg-ardoise-clair/10"}`}>1</div>
              <span className="text-sm font-medium">Identité</span>
            </div>
            <div className={`flex-1 h-px ${etape >= 2 ? "bg-ocre" : "bg-ardoise-clair/10"}`} />
            <div className={`flex items-center gap-2 ${etape >= 2 ? "text-ocre" : "text-ardoise-clair/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${etape >= 2 ? "bg-ocre text-white" : "bg-ardoise-clair/10"}`}>2</div>
              <span className="text-sm font-medium">Contact</span>
            </div>
            <div className={`flex-1 h-px ${etape >= 3 ? "bg-ocre" : "bg-ardoise-clair/10"}`} />
            <div className={`flex items-center gap-2 ${etape >= 3 ? "text-ocre" : "text-ardoise-clair/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${etape >= 3 ? "bg-ocre text-white" : "bg-ardoise-clair/10"}`}>3</div>
              <span className="text-sm font-medium">Confirmation</span>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            {etape === 1 && (
              <>
                <ChampSaisie libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Diallo" required />
                <ChampSaisie libelle="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex: Fatou" required />
                {numeroCni && (
                  <ChampSaisie libelle="N° CNI (OCR)" value={numeroCni} onChange={(e) => setNumeroCni(e.target.value)} />
                )}
                <div className="flex justify-between pt-2">
                  {can.scanCNI ? (
                    <Bouton variante="ghost" onClick={() => setEtape(0)}>← Scan CNI</Bouton>
                  ) : <span />}
                  <Bouton variante="primaire" onClick={() => setEtape(2)} disabled={!nom || !prenom}>
                    Suivant →
                  </Bouton>
                </div>
              </>
            )}

            {etape === 2 && (
              <>
                <ChampSaisie
                  libelle="Téléphone *"
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex: +221 77 123 45 67"
                  aide="Numéro obligatoire pour la création du compte DigiID"
                  required
                />
                <ChampSaisie libelle="Email (optionnel)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex: fatou@email.com" />
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Notes (optionnel)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                    placeholder="Observations..."
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Bouton variante="ghost" onClick={() => setEtape(1)}>← Retour</Bouton>
                  <Bouton variante="primaire" onClick={() => setEtape(3)} disabled={!telephone}>
                    Suivant →
                  </Bouton>
                </div>
              </>
            )}

            {etape === 3 && (
              <>
                <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
                  <p className="text-xs uppercase text-ardoise-clair font-semibold">Récapitulatif</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Nom :</strong> {prenom} {nom}</p>
                    <p><strong>Téléphone :</strong> {telephone}</p>
                    {email && <p className="col-span-2"><strong>Email :</strong> {email}</p>}
                    {numeroCni && <p className="col-span-2"><strong>N° CNI :</strong> {numeroCni}</p>}
                    {notes && <p className="col-span-2"><strong>Notes :</strong> {notes}</p>}
                    <p className="col-span-2">
                      <strong>Scan CNI :</strong> {scanIntegre ? "Oui (sera marqué)" : "Non"}
                    </p>
                  </div>
                </div>
                {erreurEnvoi && <p className="text-terre text-sm">{erreurEnvoi}</p>}
                <div className="flex justify-between pt-2">
                  <Bouton variante="ghost" onClick={() => setEtape(2)}>← Retour</Bouton>
                  <Bouton
                    variante="primaire"
                    disabled={!nom || !prenom || !telephone || envoi}
                    onClick={handleSubmit}
                    chargement={envoi}
                  >
                    {envoi ? "Enrôlement en cours..." : "Confirmer l'enrôlement"}
                  </Bouton>
                </div>
              </>
            )}
          </div>
        </Carte>
      )}

      {can.scanCNI && etape >= 1 && (
        <div className="bg-lagune/5 border border-lagune/20 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-ardoise">Scanner une CNI</p>
            <p className="text-xs text-ardoise-clair">Module OCR dédié (recto / verso)</p>
          </div>
          <div className="flex gap-2">
            <Bouton variante="ghost" taille="petit" onClick={() => setEtape(0)}>
              Scan dans ce flux
            </Bouton>
            <Link href="/agent/scan">
              <Bouton variante="secondaire" taille="petit">Page scan</Bouton>
            </Link>
          </div>
        </div>
      )}

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
