"use client";
/**
 * Page Documents — upload de fichiers pour enrichir le chatbot.
 * Le chatbot utilise ces documents pour répondre aux questions de l'utilisateur.
 */
import { useEffect, useRef, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import {
  uploaderDocument,
  listerDocuments,
  supprimerDocument,
  type DocumentDetail,
} from "@/services/documents";
import { ErreurAPI } from "@/services/client_api";

export default function PageDocuments() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [documents, setDocuments] = useState<DocumentDetail[]>([]);
  const [chargement, setChargement] = useState(true);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listerDocuments()
      .then((r) => setDocuments(r.documents))
      .catch((e) => {
        const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
        notifier(msg, "erreur");
      })
      .finally(() => setChargement(false));
  }, []);

  async function gererUpload(evt: React.ChangeEvent<HTMLInputElement>) {
    const fichier = evt.target.files?.[0];
    if (!fichier) return;

    setUploadEnCours(true);
    try {
      const nouveau = await uploaderDocument(fichier);
      setDocuments((d) => [nouveau, ...d]);
      notifier(`Document "${nouveau.nom_fichier}" uploadé. Ton chatbot peut l'utiliser maintenant.`, "succes");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur d'upload";
      notifier(msg, "erreur");
    } finally {
      setUploadEnCours(false);
      if (refInput.current) refInput.current.value = "";
    }
  }

  async function gererSuppression(doc: DocumentDetail) {
    if (!confirm(`Supprimer "${doc.nom_fichier}" ?`)) return;
    try {
      await supprimerDocument(doc.id);
      setDocuments((d) => d.filter((x) => x.id !== doc.id));
      notifier("Document supprimé", "info");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  }

  const tailleTotaleMo = documents.reduce((s, d) => s + d.taille_octets, 0) / 1024 / 1024;

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mes documents
        </p>
        <h1 className="mt-1">Documents pour le chatbot</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Uploade des fichiers PDF, TXT ou Markdown. Ton assistant DigiID
          les utilisera pour répondre à tes questions personnelles.
        </p>
      </header>

      <Carte variante="accent">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="mb-1">Uploader un nouveau document</h3>
            <p className="text-sm text-ardoise-clair">
              Formats supportés : PDF, TXT, Markdown · Taille maximum : 5 Mo
            </p>
          </div>
          <div>
            <input
              ref={refInput}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={gererUpload}
              className="hidden"
              disabled={uploadEnCours}
            />
            <Bouton
              variante="primaire"
              onClick={() => refInput.current?.click()}
              chargement={uploadEnCours}
            >
              Choisir un fichier
            </Bouton>
          </div>
        </div>
      </Carte>

      {!chargement && documents.length > 0 && (
        <div className="flex justify-between text-sm text-ardoise-clair">
          <span>
            <strong className="text-lagune">{documents.length}</strong>
            {" "}document{documents.length > 1 ? "s" : ""}
          </span>
          <span>
            Espace utilisé : <strong className="text-lagune">{tailleTotaleMo.toFixed(2)} Mo</strong>
          </span>
        </div>
      )}

      {chargement ? (
        <p className="text-center text-ardoise-clair italic py-8">Chargement...</p>
      ) : documents.length === 0 ? (
        <Alerte variante="info" titre="Aucun document encore">
          Uploade ton premier document pour permettre à ton assistant de répondre dessus.
          Exemples : CV, attestation bancaire, notes personnelles, FAQ d'entreprise...
        </Alerte>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {documents.map((doc) => (
            <CarteDocument key={doc.id} doc={doc} surSuppression={gererSuppression} />
          ))}
        </div>
      )}

      <Carte variante="pointilles" titre="Comment ça marche">
        <ol className="space-y-2 text-sm text-ardoise list-decimal list-inside">
          <li>Tu uploades un fichier ici (PDF, TXT, Markdown).</li>
          <li>DigiID extrait le texte et le stocke en sécurité.</li>
          <li>Tu vas sur ton chatbot et poses une question.</li>
          <li>L'assistant lit tes documents en plus de ses connaissances générales.</li>
          <li>Il peut citer le document qu'il a utilisé pour répondre.</li>
        </ol>
        <p className="text-xs text-ardoise-clair italic mt-4">
          Tes documents sont privés — seul toi et ton assistant y avez accès.
          Personne d'autre, y compris les administrateurs DigiID, ne les voit.
        </p>
      </Carte>
    </div>
  );
}

function CarteDocument({
  doc,
  surSuppression,
}: {
  doc: DocumentDetail;
  surSuppression: (d: DocumentDetail) => void;
}) {
  const tailleKo = (doc.taille_octets / 1024).toFixed(1);
  const dateAffichee = new Date(doc.cree_le).toLocaleDateString("fr-FR");
  const typeAffiche =
    doc.type_mime.includes("pdf") ? "PDF"
    : doc.type_mime.includes("markdown") ? "MD"
    : "TXT";

  return (
    <div className="carte">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-grow min-w-0">
          <div className="w-10 h-10 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs">
            {typeAffiche}
          </div>
          <div className="min-w-0 flex-grow">
            <p className="font-medium text-ardoise truncate" title={doc.nom_fichier}>
              {doc.nom_fichier}
            </p>
            <p className="text-xs text-ardoise-clair mt-0.5">
              {tailleKo} Ko · {dateAffichee}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => surSuppression(doc)}
          className="text-terre hover:bg-terre/10 rounded-lg p-1.5 transition-colors flex-shrink-0"
          aria-label={`Supprimer ${doc.nom_fichier}`}
          title="Supprimer"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
      {doc.resume && (
        <p className="text-xs text-ardoise-clair italic line-clamp-3 bg-sable-clair p-3 rounded-lg">
          {doc.resume}
        </p>
      )}
    </div>
  );
}
