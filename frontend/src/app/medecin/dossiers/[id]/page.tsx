"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import {
  obtenirDossier,
  listerConsultations,
  listerOrdonnances,
  creerOrdonnance,
  modifierOrdonnance,
  supprimerOrdonnance,
} from "@/services/medical";
import type { DossierMedical, Consultation, Ordonnance } from "@/services/medical";

export default function DossierDetailPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const dossierId = params.id as string;
  const [dossier, setDossier] = useState<DossierMedical | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState("");

  // Nouvelle ordonnance
  const [nouvMedicaments, setNouvMedicaments] = useState("");
  const [nouvInstructions, setNouvInstructions] = useState("");
  const [nouvDateExp, setNouvDateExp] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Modification ordonnance
  const [editId, setEditId] = useState<string | null>(null);
  const [editMedicaments, setEditMedicaments] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editDateExp, setEditDateExp] = useState("");

  // Confirmation suppression
  const [supprId, setSupprId] = useState<string | null>(null);

  useEffect(() => { if (dossierId) charger(); }, [dossierId]);

  async function charger() {
    setChargement(true);
    try {
      const [d, c, o] = await Promise.all([
        obtenirDossier(dossierId),
        listerConsultations(dossierId),
        listerOrdonnances(dossierId),
      ]);
      setDossier(d); setConsultations(c); setOrdonnances(o);
    } catch { setMessage("Erreur lors du chargement du dossier."); }
    finally { setChargement(false); }
  }

  async function handleCreer() {
    if (!nouvMedicaments) return;
    setEnvoi(true); setMessage("");
    try {
      await creerOrdonnance({
        dossier_id: dossierId,
        medicaments: nouvMedicaments,
        instructions: nouvInstructions || undefined,
        date_expiration: nouvDateExp || undefined,
      });
      setNouvMedicaments(""); setNouvInstructions(""); setNouvDateExp("");
      const o = await listerOrdonnances(dossierId);
      setOrdonnances(o);
      setMessage("Ordonnance créée avec succès.");
    } catch { setMessage("Erreur lors de la création."); }
    finally { setEnvoi(false); }
  }

  function ouvrirEdition(o: Ordonnance) {
    setEditId(o.id);
    setEditMedicaments(o.medicaments);
    setEditInstructions(o.instructions || "");
    setEditDateExp(o.date_expiration || "");
  }

  async function handleModifier() {
    if (!editId || !editMedicaments) return;
    setMessage("");
    try {
      await modifierOrdonnance(editId, {
        medicaments: editMedicaments,
        instructions: editInstructions || undefined,
        date_expiration: editDateExp || undefined,
      });
      setEditId(null); setEditMedicaments(""); setEditInstructions(""); setEditDateExp("");
      setMessage("Ordonnance modifiée avec succès.");
      // Rechargement silencieux — ne pas afficher d'erreur si le refresh échoue
      try {
        const o = await listerOrdonnances(dossierId);
        setOrdonnances(o);
      } catch { /* silencieux */ }
    } catch (e: any) {
      console.error("Erreur modification ordonnance:", e);
      setMessage(e?.message_utilisateur || "Erreur lors de la modification.");
    }
  }

  async function handleSupprimer() {
    if (!supprId) return;
    setMessage("");
    try {
      await supprimerOrdonnance(supprId);
      setSupprId(null);
      const o = await listerOrdonnances(dossierId);
      setOrdonnances(o);
      setMessage("Ordonnance supprimée avec succès.");
    } catch { setMessage("Erreur lors de la suppression."); }
  }

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ardoise-clair italic py-12 text-center">Chargement du dossier...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="space-y-8 apparition">
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Dossier introuvable.</p>
        </div>
        <Link href="/medecin/dossiers"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <Link href="/medecin/dossiers" className="hover:text-ocre">Dossiers</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">{dossier.patient_nom}</span>
      </nav>

      {message && (
        <div className="bg-vert/10 border-l-4 border-vert p-3 rounded">
          <p className="text-sm text-vert">{message}</p>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-ardoise">{dossier.patient_prenom ? `${dossier.patient_prenom} ${dossier.patient_nom}` : dossier.patient_nom}</h1>
            <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"}>
              {dossier.statut === "ouvert" ? "Ouvert" : "Archive"}
            </Badge>
          </div>
          <p className="text-ardoise-clair mt-1 font-mono text-sm">{dossier.patient_digiid}</p>
          {dossier.hopital && (
            <p className="text-xs text-ocre mt-1">?? {dossier.hopital}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Carte titre="Informations patient">
          <div className="space-y-2 text-sm">
            <p><strong>Nom :</strong> {dossier.patient_prenom ? `${dossier.patient_prenom} ${dossier.patient_nom}` : dossier.patient_nom}</p>
            <p><strong>DigiID :</strong> <span className="font-mono">{dossier.patient_digiid}</span></p>
            {dossier.patient_date_naissance && <p><strong>Né(e) le :</strong> {new Date(dossier.patient_date_naissance).toLocaleDateString("fr-FR")}</p>}
            {dossier.hopital && <p><strong>Établissement :</strong> ?? {dossier.hopital}</p>}
            <p><strong>Motif :</strong> {dossier.motif}</p>
            <p><strong>Diagnostic :</strong> {dossier.diagnostic || "Non renseigné"}</p>
            <p><strong>Crée le :</strong> {new Date(dossier.date_creation).toLocaleString("fr-FR")}</p>
            <p><strong>Modifié le :</strong> {new Date(dossier.date_modification).toLocaleString("fr-FR")}</p>
          </div>
        </Carte>

        <Carte titre={"Consultations (" + consultations.length + ")"}>
          {consultations.length === 0 ? (
            <p className="text-sm text-ardoise-clair italic">Aucune consultation</p>
          ) : (
            <div className="space-y-3">
              {consultations.map((c) => (
                <div key={c.id} className="p-2 bg-sable rounded text-sm">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold">{c.motif}</p>
                    {c.type_consultation && <Badge variante="ocre">{c.type_consultation}</Badge>}
                  </div>
                  {c.diagnostic && <p className="text-xs text-ardoise-clair mt-1">{c.diagnostic}</p>}
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-ardoise-clair">
                    <span>{new Date(c.date_consultation).toLocaleString("fr-FR")}</span>
                    {c.poids && <span>?? {c.poids} kg</span>}
                    {c.taille && <span>?? {c.taille} cm</span>}
                    {c.temperature && <span>??? {(c.temperature / 10).toFixed(1)}°C</span>}
                    {c.pression_arterielle && <span>?? {c.pression_arterielle}</span>}
                  </div>
                  {c.observations && <p className="text-xs text-ardoise-clair mt-1">{c.observations}</p>}
                  {c.conclusion && <p className="text-xs font-medium text-ardoise mt-1">Conclusion : {c.conclusion}</p>}
                </div>
              ))}
            </div>
          )}
        </Carte>

        {/* Ordonnances du dossier */}
        <Carte titre={"Ordonnances (" + ordonnances.length + ")"}>
          {ordonnances.length === 0 ? (
            <p className="text-sm text-ardoise-clair italic">Aucune ordonnance pour ce dossier</p>
          ) : (
            <div className="space-y-3">
              {ordonnances.map((o) => (
                <div key={o.id} className="p-2 bg-sable rounded text-sm">
                  {editId === o.id ? (
                    /* Mode édition */
                    <div className="space-y-2">
                      <textarea
                        value={editMedicaments}
                        onChange={(e) => setEditMedicaments(e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 border border-ardoise-clair/20 rounded text-xs resize-none"
                      />
                      <textarea
                        value={editInstructions}
                        onChange={(e) => setEditInstructions(e.target.value)}
                        rows={1}
                        className="w-full px-2 py-1 border border-ardoise-clair/20 rounded text-xs resize-none"
                        placeholder="Instructions..."
                      />
                      <input
                        type="date"
                        value={editDateExp}
                        onChange={(e) => setEditDateExp(e.target.value)}
                        className="w-full px-2 py-1 border border-ardoise-clair/20 rounded text-xs"
                      />
                      <div className="flex gap-2">
                        <Bouton variante="primaire" taille="petit" onClick={handleModifier}>
                          Sauvegarder
                        </Bouton>
                        <Bouton variante="ghost" taille="petit" onClick={() => setEditId(null)}>
                          Annuler
                        </Bouton>
                      </div>
                    </div>
                  ) : (
                    /* Mode affichage */
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{o.medicaments}</p>
                            <span className="text-xs text-ardoise-clair font-mono">#{o.numero_ordonnance}</span>
                            {o.statut !== "active" && (
                              <Badge variante={o.statut === "expiree" ? "neutre" : "terre"}>
                                {o.statut === "expiree" ? "Expirée" : "Annulée"}
                              </Badge>
                            )}
                          </div>
                          {o.instructions && <p className="text-xs text-ardoise-clair mt-1">{o.instructions}</p>}
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-ardoise-clair">
                            <span>?? {new Date(o.date_prescription).toLocaleDateString("fr-FR")} à {new Date(o.date_prescription).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"})}</span>
                            {o.date_expiration && <span className="text-terre">? Expire le {new Date(o.date_expiration).toLocaleDateString("fr-FR")}</span>}
                            {o.medecin_nom && <span>????? Dr. {o.medecin_nom}</span>}
                            {o.hopital && <span>?? {o.hopital}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            onClick={() => ouvrirEdition(o)}
                            className="text-xs text-ocre hover:text-ocre-fonce px-1.5 py-0.5 rounded hover:bg-ocre/10 transition-colors"
                            title="Modifier"
                          >
                            ??
                          </button>
                          <button
                            onClick={() => setSupprId(o.id)}
                            className="text-xs text-terre hover:text-terre-fonce px-1.5 py-0.5 rounded hover:bg-terre/10 transition-colors"
                            title="Supprimer"
                          >
                            ???
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nouvelle ordonnance */}
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <p className="text-xs uppercase font-semibold text-ardoise-clair mb-2">Nouvelle prescription</p>
            <div className="space-y-2">
              <textarea
                value={nouvMedicaments}
                onChange={(e) => setNouvMedicaments(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Médicaments et posologie..."
              />
              <textarea
                value={nouvInstructions}
                onChange={(e) => setNouvInstructions(e.target.value)}
                rows={1}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Instructions (optionnel)"
              />
              <input
                type="date"
                value={nouvDateExp}
                onChange={(e) => setNouvDateExp(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              />
              <Bouton variante="primaire" taille="petit" disabled={!nouvMedicaments || envoi} onClick={handleCreer}>
                {envoi ? "Création..." : "+ Prescrire"}
              </Bouton>
            </div>
          </div>
        </Carte>
      </div>

      {/* Modale de confirmation suppression */}
      {supprId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise/50">
          <div className="bg-white rounded-xl p-6 max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-ardoise mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-ardoise-clair mb-4">
              Cette action est irréversible. L&apos;ordonnance sera définitivement supprimée.
              L&apos;historique reste consultable par le super administrateur.
            </p>
            <div className="flex gap-3 justify-end">
              <Bouton variante="ghost" onClick={() => setSupprId(null)}>
                Annuler
              </Bouton>
              <Bouton variante="danger" onClick={handleSupprimer}>
                Supprimer
              </Bouton>
            </div>
          </div>
        </div>
      )}

      <Link href="/medecin/dossiers"><Bouton variante="ghost">Retour aux dossiers</Bouton></Link>
    </div>
  );
}
