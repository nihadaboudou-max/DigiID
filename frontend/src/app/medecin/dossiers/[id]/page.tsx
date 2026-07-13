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
  ajouterConsultation,
  creerOrdonnance,
  modifierOrdonnance,
  supprimerOrdonnance,
} from "@/services/medical";
import type { DossierMedical, Consultation, Ordonnance } from "@/services/medical";

export default function DossierDetailPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical"]}>
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

    // Nouvelle consultation
  const [afficherConsultation, setAfficherConsultation] = useState(false);
  const [consMotif, setConsMotif] = useState("");
  const [consType, setConsType] = useState("");
  const [consPoids, setConsPoids] = useState("");
  const [consTaille, setConsTaille] = useState("");
  const [consTemperature, setConsTemperature] = useState("");
  const [consPression, setConsPression] = useState("");
  const [consObservations, setConsObservations] = useState("");
  const [consDiagnostic, setConsDiagnostic] = useState("");
  const [consConclusion, setConsConclusion] = useState("");
  const [consDateControle, setConsDateControle] = useState("");
  const [envoiConsultation, setEnvoiConsultation] = useState(false);

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

  async function handleAjouterConsultation() {
    if (!consMotif) { setMessage("Le motif est obligatoire."); return; }
    setEnvoiConsultation(true);
    setMessage("");
    try {
      await ajouterConsultation({
        dossier_id: dossierId,
        motif: consMotif,
        type_consultation: consType || undefined,
        observations: consObservations || undefined,
        diagnostic: consDiagnostic || undefined,
        conclusion: consConclusion || undefined,
        poids: consPoids ? parseInt(consPoids) : undefined,
        taille: consTaille ? parseInt(consTaille) : undefined,
        temperature: consTemperature ? Math.round(parseFloat(consTemperature) * 10) : undefined,
        pression_arterielle: consPression || undefined,
        date_controle: consDateControle || undefined,
      });
      // Réinitialiser le formulaire
      setConsMotif(""); setConsType(""); setConsPoids(""); setConsTaille("");
      setConsTemperature(""); setConsPression(""); setConsObservations("");
      setConsDiagnostic(""); setConsConclusion(""); setConsDateControle("");
      setAfficherConsultation(false);
      // Recharger les consultations
      const c = await listerConsultations(dossierId);
      setConsultations(c);
      setMessage("Consultation ajoutée avec succès.");
    } catch (error: any) {
      console.error("Erreur ajout consultation:", error);
      setMessage(error?.message_utilisateur || "Erreur lors de l'ajout de la consultation.");
    } finally {
      setEnvoiConsultation(false);
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
            <p className="text-xs text-ocre mt-1">🏥 {dossier.hopital}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Carte titre="Informations patient">
          <div className="space-y-2 text-sm">
            <p><strong>Nom :</strong> {dossier.patient_prenom ? `${dossier.patient_prenom} ${dossier.patient_nom}` : dossier.patient_nom}</p>
            <p><strong>DigiID :</strong> <span className="font-mono">{dossier.patient_digiid}</span></p>
            {dossier.patient_date_naissance && <p><strong>Né(e) le :</strong> {new Date(dossier.patient_date_naissance).toLocaleDateString("fr-FR")}</p>}
            {dossier.hopital && <p><strong>Établissement :</strong> 🏥 {dossier.hopital}</p>}
            <p><strong>Motif :</strong> {dossier.motif}</p>
            <p><strong>Diagnostic :</strong> {dossier.diagnostic || "Non renseigné"}</p>
            <p><strong>Crée le :</strong> {new Date(dossier.date_creation).toLocaleString("fr-FR")}</p>
            <p><strong>Modifié le :</strong> {new Date(dossier.date_modification).toLocaleString("fr-FR")}</p>
          </div>
        </Carte>

                <Carte titre={"Consultations (" + consultations.length + ")"}>
          {/* Bouton pour ajouter une consultation */}
          <div className="mb-3">
            <Bouton
              variante={afficherConsultation ? "ghost" : "primaire"}
              taille="petit"
              onClick={() => setAfficherConsultation(!afficherConsultation)}
            >
              {afficherConsultation ? "Annuler" : "+ Nouvelle consultation"}
            </Bouton>
          </div>

          {/* Formulaire d'ajout de consultation */}
          {afficherConsultation && (
            <div className="mb-4 p-3 bg-sable rounded-lg space-y-3">
              <p className="text-xs uppercase font-semibold text-ardoise-clair">
                Ajouter une consultation
              </p>

              {/* Motif + Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Motif *</label>
                  <input
                    type="text"
                    value={consMotif}
                    onChange={(e) => setConsMotif(e.target.value)}
                    className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                    placeholder="Ex: Fièvre persistante"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Type</label>
                  <select
                    value={consType}
                    onChange={(e) => setConsType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs bg-white"
                  >
                    <option value="">-- Type --</option>
                    <option value="consultation">Consultation</option>
                    <option value="suivi">Suivi</option>
                    <option value="controle">🔍 Contrôle</option>
                    <option value="urgence">Urgence</option>
                  </select>
                </div>
              </div>

              {/* Signes vitaux */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Poids (kg)</label>
                  <input
                    type="number"
                    value={consPoids}
                    onChange={(e) => setConsPoids(e.target.value)}
                    className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                    placeholder="70"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Taille (cm)</label>
                  <input
                    type="number"
                    value={consTaille}
                    onChange={(e) => setConsTaille(e.target.value)}
                    className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                    placeholder="175"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Temp. (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={consTemperature}
                    onChange={(e) => setConsTemperature(e.target.value)}
                    className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                    placeholder="37.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Tension</label>
                  <input
                    type="text"
                    value={consPression}
                    onChange={(e) => setConsPression(e.target.value)}
                    className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                    placeholder="120/80"
                  />
                </div>
              </div>

              {/* Diagnostic */}
              <div>
                <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Diagnostic</label>
                <input
                  type="text"
                  value={consDiagnostic}
                  onChange={(e) => setConsDiagnostic(e.target.value)}
                  className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                  placeholder="Ex: Infection respiratoire aiguë"
                />
              </div>

              {/* Observations */}
              <div>
                <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Observations</label>
                <textarea
                  value={consObservations}
                  onChange={(e) => setConsObservations(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs resize-none"
                  placeholder="Notes complémentaires..."
                />
              </div>

              {/* Conclusion */}
              <div>
                <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">Conclusion</label>
                <textarea
                  value={consConclusion}
                  onChange={(e) => setConsConclusion(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs resize-none"
                  placeholder="Conclusion médicale..."
                />
              </div>

              {/* Date de contrôle */}
              <div>
                <label className="block text-xs text-ardoise-clair font-semibold mb-0.5">
                  📅 Date de contrôle recommandé
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={consDateControle}
                    onChange={(e) => setConsDateControle(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 px-2 py-1.5 border border-ardoise-clair/20 rounded text-xs"
                  />
                  {/* Boutons rapides : +7j, +14j, +30j */}
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setConsDateControle(d.toISOString().split("T")[0]);
                    }}
                    className="text-xs px-2 py-1.5 bg-ocre/10 text-ocre rounded hover:bg-ocre/20 transition-colors"
                  >
                    +7j
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 14);
                      setConsDateControle(d.toISOString().split("T")[0]);
                    }}
                    className="text-xs px-2 py-1.5 bg-ocre/10 text-ocre rounded hover:bg-ocre/20 transition-colors"
                  >
                    +14j
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 30);
                      setConsDateControle(d.toISOString().split("T")[0]);
                    }}
                    className="text-xs px-2 py-1.5 bg-ocre/10 text-ocre rounded hover:bg-ocre/20 transition-colors"
                  >
                    +30j
                  </button>
                </div>
                {consDateControle && (
                  <p className="text-xs text-ocre mt-1">
                    🔍 Contrôle prévu le {new Date(consDateControle).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>

              <Bouton
                variante="primaire"
                taille="petit"
                disabled={!consMotif || envoiConsultation}
                onClick={handleAjouterConsultation}
              >
                {envoiConsultation ? "Enregistrement..." : "Enregistrer la consultation"}
              </Bouton>
            </div>
          )}

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
                    {c.poids && <span>⚖️ {c.poids} kg</span>}
                    {c.taille && <span>📏 {c.taille} cm</span>}
                    {c.temperature && <span>🌡️ {(c.temperature / 10).toFixed(1)}°C</span>}
                    {c.pression_arterielle && <span>💉 {c.pression_arterielle}</span>}
                  </div>
                                    {c.observations && <p className="text-xs text-ardoise-clair mt-1">{c.observations}</p>}
                  {c.conclusion && <p className="text-xs font-medium text-ardoise mt-1">Conclusion : {c.conclusion}</p>}
                  {c.date_controle && (
                    <p className="text-xs mt-2 font-medium">📅 Contrôle recommandé : {new Date(c.date_controle).toLocaleDateString("fr-FR")}</p>
                  )}
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
                            <span>📅 {new Date(o.date_prescription).toLocaleDateString("fr-FR")} à {new Date(o.date_prescription).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"})}</span>
                            {o.date_expiration && <span className="text-terre">⏳ Expire le {new Date(o.date_expiration).toLocaleDateString("fr-FR")}</span>}
                            {o.medecin_nom && <span>👨‍⚕️ Dr. {o.medecin_nom}</span>}
                            {o.hopital && <span>🏥 {o.hopital}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            onClick={() => ouvrirEdition(o)}
                            className="text-xs text-ocre hover:text-ocre-fonce px-1.5 py-0.5 rounded hover:bg-ocre/10 transition-colors"
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setSupprId(o.id)}
                            className="text-xs text-terre hover:text-terre-fonce px-1.5 py-0.5 rounded hover:bg-terre/10 transition-colors"
                            title="Supprimer"
                          >
                            🗑️
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
