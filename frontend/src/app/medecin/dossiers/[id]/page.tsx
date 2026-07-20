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
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
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
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);

  // États pour nouvelle ordonnance
  const [nouvMedicaments, setNouvMedicaments] = useState("");
  const [nouvInstructions, setNouvInstructions] = useState("");
  const [nouvDateExp, setNouvDateExp] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // États pour modification ordonnance
  const [editId, setEditId] = useState<string | null>(null);
  const [editMedicaments, setEditMedicaments] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editDateExp, setEditDateExp] = useState("");

  // États pour nouvelle consultation
  const [afficherConsultation, setAfficherConsultation] = useState(false);
  const [consMotif, setConsMotif] = useState("");
  const [consType, setConsType] = useState("consultation");
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

  useEffect(() => { 
    if (dossierId) charger(); 
  }, [dossierId]);

  async function charger() {
    setChargement(true);
    setMessage(null);
    try {
      const [d, c, o] = await Promise.all([
        obtenirDossier(dossierId),
        listerConsultations(dossierId),
        listerOrdonnances(dossierId),
      ]);
      setDossier(d); 
      setConsultations(c); 
      setOrdonnances(o);
    } catch (error: any) { 
      setMessage({ 
        type: "erreur", 
        texte: error?.message_utilisateur || "Erreur lors du chargement du dossier." 
      }); 
    } finally { 
      setChargement(false); 
    }
  }

  async function handleCreerOrdonnance() {
    if (!nouvMedicaments.trim()) {
      setMessage({ type: "erreur", texte: "Les médicaments sont obligatoires." });
      return;
    }
    setEnvoi(true); 
    setMessage(null);
    try {
      await creerOrdonnance({
        dossier_id: dossierId,
        medicaments: nouvMedicaments,
        instructions: nouvInstructions || undefined,
        date_expiration: nouvDateExp || undefined,
      });
      setNouvMedicaments(""); 
      setNouvInstructions(""); 
      setNouvDateExp("");
      const o = await listerOrdonnances(dossierId);
      setOrdonnances(o);
      setMessage({ type: "succes", texte: "Ordonnance créée avec succès." });
    } catch (error: any) { 
      setMessage({ 
        type: "erreur", 
        texte: error?.message_utilisateur || "Erreur lors de la création." 
      }); 
    } finally { 
      setEnvoi(false); 
    }
  }

  function ouvrirEdition(o: Ordonnance) {
    setEditId(o.id);
    setEditMedicaments(o.medicaments);
    setEditInstructions(o.instructions || "");
    setEditDateExp(o.date_expiration || "");
  }

  async function handleModifierOrdonnance() {
    if (!editId || !editMedicaments.trim()) {
      setMessage({ type: "erreur", texte: "Les médicaments sont obligatoires." });
      return;
    }
    setMessage(null);
    try {
      await modifierOrdonnance(editId, {
        medicaments: editMedicaments,
        instructions: editInstructions || undefined,
        date_expiration: editDateExp || undefined,
      });
      setEditId(null); 
      setEditMedicaments(""); 
      setEditInstructions(""); 
      setEditDateExp("");
      setMessage({ type: "succes", texte: "Ordonnance modifiée avec succès." });
      const o = await listerOrdonnances(dossierId);
      setOrdonnances(o);
    } catch (error: any) {
      setMessage({ 
        type: "erreur", 
        texte: error?.message_utilisateur || "Erreur lors de la modification." 
      });
    }
  }

  async function handleAjouterConsultation() {
    if (!consMotif.trim()) { 
      setMessage({ type: "erreur", texte: "Le motif est obligatoire." }); 
      return; 
    }
    setEnvoiConsultation(true);
    setMessage(null);
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
      setConsMotif(""); 
      setConsType("consultation"); 
      setConsPoids(""); 
      setConsTaille("");
      setConsTemperature(""); 
      setConsPression(""); 
      setConsObservations("");
      setConsDiagnostic(""); 
      setConsConclusion(""); 
      setConsDateControle("");
      setAfficherConsultation(false);
      // Recharger les consultations
      const c = await listerConsultations(dossierId);
      setConsultations(c);
      setMessage({ type: "succes", texte: "Consultation ajoutée avec succès." });
    } catch (error: any) {
      setMessage({ 
        type: "erreur", 
        texte: error?.message_utilisateur || "Erreur lors de l'ajout de la consultation." 
      });
    } finally {
      setEnvoiConsultation(false);
    }
  }

  async function handleSupprimerOrdonnance() {
    if (!supprId) return;
    setMessage(null);
    try {
      await supprimerOrdonnance(supprId);
      setSupprId(null);
      const o = await listerOrdonnances(dossierId);
      setOrdonnances(o);
      setMessage({ type: "succes", texte: "Ordonnance supprimée avec succès." });
    } catch (error: any) { 
      setMessage({ 
        type: "erreur", 
        texte: error?.message_utilisateur || "Erreur lors de la suppression." 
      }); 
    }
  }

  function formaterNomMedecin(medecinNom: string | null | undefined): string {
    if (!medecinNom) return "Non renseigné";
    // Si le nom commence déjà par "Dr." ou "Dr", on le retourne tel quel
    if (medecinNom.trim().startsWith("Dr")) {
      return medecinNom;
    }
    // Sinon on ajoute "Dr."
    return `Dr. ${medecinNom}`;
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-ardoise-clair">Chargement du dossier...</p>
        </div>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="space-y-6">
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded-lg">
          <p className="text-sm text-terre font-medium">Dossier introuvable.</p>
        </div>
        <Link href="/medecin/dossiers">
          <Bouton variante="ghost">← Retour aux dossiers</Bouton>
        </Link>
      </div>
    );
  }

  const nomCompletPatient = dossier.patient_prenom 
    ? `${dossier.patient_prenom} ${dossier.patient_nom}` 
    : dossier.patient_nom;

  return (
    <div className="space-y-6 apparition pb-20">
      {/* Navigation */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/medecin/dossiers" className="hover:text-ocre transition-colors">Dossiers</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold truncate">{nomCompletPatient}</span>
      </nav>

      {/* Messages */}
      {message && (
        <div className={`p-4 rounded-lg border-l-4 ${
          message.type === "succes" 
            ? "bg-succes/10 border-succes text-succes" 
            : "bg-terre/10 border-terre text-terre"
        }`}>
          <p className="text-sm font-medium">{message.texte}</p>
        </div>
      )}

      {/* En-tête du patient */}
      <div className="bg-white rounded-xl p-6 border border-ardoise-clair/10 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-bold text-ardoise">{nomCompletPatient}</h1>
              <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"}>
                {dossier.statut === "ouvert" ? "✓ Ouvert" : " Archivé"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-ardoise-clair">
              <span className="font-mono bg-sable px-2 py-1 rounded">
                 {dossier.patient_digiid}
              </span>
              {dossier.hopital && (
                <span className="flex items-center gap-1">
                  🏥 {dossier.hopital}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/medecin/dossiers">
              <Bouton variante="ghost" taille="petit">← Retour</Bouton>
            </Link>
          </div>
        </div>
      </div>

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Colonne 1: Informations patient */}
        <div className="lg:col-span-1 space-y-6">
          <Carte titre="📋 Informations patient">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Nom complet</p>
                <p className="font-medium text-ardoise">{nomCompletPatient}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">DigiID</p>
                <p className="font-mono text-ardoise bg-sable px-2 py-1 rounded inline-block">
                  {dossier.patient_digiid}
                </p>
              </div>
              {dossier.patient_date_naissance && (
                <div>
                  <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Date de naissance</p>
                  <p className="text-ardoise">
                    📅 {new Date(dossier.patient_date_naissance).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Motif de consultation</p>
                <p className="text-ardoise">{dossier.motif}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Diagnostic</p>
                <p className={dossier.diagnostic ? "text-ardoise" : "text-ardoise-clair italic"}>
                  {dossier.diagnostic || "Non renseigné"}
                </p>
              </div>
              <div className="pt-3 border-t border-ardoise-clair/10 space-y-2">
                <div>
                  <p className="text-xs text-ardoise-clair">Créé le</p>
                  <p className="text-ardoise font-medium">
                    {new Date(dossier.date_creation).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ardoise-clair">Modifié le</p>
                  <p className="text-ardoise font-medium">
                    {new Date(dossier.date_modification).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            </div>
          </Carte>

          {/* Statistiques rapides */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sable rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-lagune">{consultations.length}</p>
              <p className="text-xs text-ardoise-clair uppercase font-semibold">Consultations</p>
            </div>
            <div className="bg-sable rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-ocre">{ordonnances.length}</p>
              <p className="text-xs text-ardoise-clair uppercase font-semibold">Ordonnances</p>
            </div>
          </div>
        </div>

        {/* Colonne 2: Consultations */}
        <div className="lg:col-span-1">
          <Carte titre={`💬 Consultations (${consultations.length})`}>
            {/* Bouton pour ajouter */}
            <div className="mb-4">
              <Bouton
                variante={afficherConsultation ? "ghost" : "primaire"}
                taille="petit"
                onClick={() => setAfficherConsultation(!afficherConsultation)}
                className="w-full"
              >
                {afficherConsultation ? "✕ Annuler" : "+ Nouvelle consultation"}
              </Bouton>
            </div>

            {/* Formulaire */}
            {afficherConsultation && (
              <div className="mb-4 p-4 bg-sable/50 rounded-lg space-y-3 border border-ardoise-clair/10">
                <p className="text-xs uppercase font-semibold text-ardoise">
                  Nouvelle consultation
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                      Motif *
                    </label>
                    <input
                      type="text"
                      value={consMotif}
                      onChange={(e) => setConsMotif(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                      placeholder="Ex: Fièvre persistante, douleurs abdominales..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">Type</label>
                    <select
                      value={consType}
                      onChange={(e) => setConsType(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lagune/30"
                    >
                      <option value="consultation">Consultation</option>
                      <option value="suivi">Suivi</option>
                      <option value="urgence">🚨 Urgence</option>
                      <option value="controle"> Contrôle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                      📅 Date contrôle
                    </label>
                    <input
                      type="date"
                      value={consDateControle}
                      onChange={(e) => setConsDateControle(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                      ⚖️ Poids (kg)
                    </label>
                    <input
                      type="number"
                      value={consPoids}
                      onChange={(e) => setConsPoids(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                      placeholder="70"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                      📏 Taille (cm)
                    </label>
                    <input
                      type="number"
                      value={consTaille}
                      onChange={(e) => setConsTaille(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                      placeholder="175"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                      🌡️ Temp. (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={consTemperature}
                      onChange={(e) => setConsTemperature(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                      placeholder="37.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                      💉 Tension
                    </label>
                    <input
                      type="text"
                      value={consPression}
                      onChange={(e) => setConsPression(e.target.value)}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                      placeholder="120/80"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                    🔬 Diagnostic
                  </label>
                  <input
                    type="text"
                    value={consDiagnostic}
                    onChange={(e) => setConsDiagnostic(e.target.value)}
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                    placeholder="Ex: Infection respiratoire aiguë"
                  />
                </div>

                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                    📝 Observations
                  </label>
                  <textarea
                    value={consObservations}
                    onChange={(e) => setConsObservations(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm resize-none"
                    placeholder="Notes cliniques..."
                  />
                </div>

                <div>
                  <label className="block text-xs text-ardoise-clair font-semibold mb-1">
                    ✅ Conclusion
                  </label>
                  <textarea
                    value={consConclusion}
                    onChange={(e) => setConsConclusion(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm resize-none"
                    placeholder="Conclusion et recommandations..."
                  />
                </div>

                <Bouton
                  variante="primaire"
                  taille="petit"
                  disabled={!consMotif.trim() || envoiConsultation}
                  onClick={handleAjouterConsultation}
                  chargement={envoiConsultation}
                  className="w-full"
                >
                  {envoiConsultation ? "Enregistrement..." : "💾 Enregistrer la consultation"}
                </Bouton>
              </div>
            )}

            {/* Liste des consultations */}
            {consultations.length === 0 ? (
              <div className="text-center py-8 text-ardoise-clair">
                <p className="text-4xl mb-2">💬</p>
                <p className="text-sm italic">Aucune consultation</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {consultations.map((c) => (
                  <div key={c.id} className="p-3 bg-sable/50 rounded-lg border border-ardoise-clair/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-ardoise">{c.motif}</p>
                        {c.type_consultation && (
                          <Badge variante="ocre" taille="petit" className="mt-1">
                            {c.type_consultation}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-ardoise-clair">
                        {new Date(c.date_consultation).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    
                    {c.diagnostic && (
                      <p className="text-xs text-ardoise mb-1">
                        <span className="font-semibold">Diagnostic:</span> {c.diagnostic}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 text-xs text-ardoise-clair mb-2">
                      {c.poids && <span>⚖️ {c.poids} kg</span>}
                      {c.taille && <span>📏 {c.taille} cm</span>}
                      {c.temperature && <span>️ {(c.temperature / 10).toFixed(1)}°C</span>}
                      {c.pression_arterielle && <span> {c.pression_arterielle}</span>}
                    </div>
                    
                    {c.observations && (
                      <p className="text-xs text-ardoise-clair mb-1">
                        <span className="font-semibold"> Obs:</span> {c.observations}
                      </p>
                    )}
                    
                    {c.conclusion && (
                      <p className="text-xs text-ardoise mb-1">
                        <span className="font-semibold">✅ Conclusion:</span> {c.conclusion}
                      </p>
                    )}
                    
                    {c.date_controle && (
                      <p className="text-xs text-ocre mt-2 font-medium">
                        📅 Contrôle prévu: {new Date(c.date_controle).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Carte>
        </div>

        {/* Colonne 3: Ordonnances */}
        <div className="lg:col-span-1">
          <Carte titre={`💊 Ordonnances (${ordonnances.length})`}>
            {ordonnances.length === 0 ? (
              <div className="text-center py-8 text-ardoise-clair">
                <p className="text-4xl mb-2">💊</p>
                <p className="text-sm italic">Aucune ordonnance</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 mb-4">
                {ordonnances.map((o) => (
                  <div key={o.id} className="p-3 bg-sable/50 rounded-lg border border-ardoise-clair/10">
                    {editId === o.id ? (
                      /* Mode édition */
                      <div className="space-y-2">
                        <textarea
                          value={editMedicaments}
                          onChange={(e) => setEditMedicaments(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm resize-none"
                          placeholder="Médicaments..."
                        />
                        <textarea
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          rows={1}
                          className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm resize-none"
                          placeholder="Instructions..."
                        />
                        <input
                          type="date"
                          value={editDateExp}
                          onChange={(e) => setEditDateExp(e.target.value)}
                          className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm"
                        />
                        <div className="flex gap-2">
                          <Bouton 
                            variante="primaire" 
                            taille="petit" 
                            onClick={handleModifierOrdonnance}
                            className="flex-1"
                          >
                            ✓ Sauvegarder
                          </Bouton>
                          <Bouton 
                            variante="ghost" 
                            taille="petit" 
                            onClick={() => setEditId(null)}
                          >
                            ✕
                          </Bouton>
                        </div>
                      </div>
                    ) : (
                      /* Mode affichage */
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-semibold text-ardoise text-sm">{o.medicaments}</p>
                              <span className="text-xs text-ardoise-clair font-mono bg-sable px-1.5 py-0.5 rounded">
                                #{o.numero_ordonnance}
                              </span>
                            </div>
                            {o.instructions && (
                              <p className="text-xs text-ardoise-clair mb-1">{o.instructions}</p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-ardoise-clair">
                              <span>
                                📅 {new Date(o.date_prescription).toLocaleDateString("fr-FR")}
                              </span>
                              {o.date_expiration && (
                                <span className="text-terre">
                                  ⏳ Exp: {new Date(o.date_expiration).toLocaleDateString("fr-FR")}
                                </span>
                              )}
                              {o.medecin_nom && (
                                <span className="text-lagune">
                                  👨‍⚕️ {formaterNomMedecin(o.medecin_nom)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => ouvrirEdition(o)}
                              className="text-xs text-ocre hover:text-ocre/80 p-1 rounded hover:bg-ocre/10 transition-colors"
                              title="Modifier"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setSupprId(o.id)}
                              className="text-xs text-terre hover:text-terre/80 p-1 rounded hover:bg-terre/10 transition-colors"
                              title="Supprimer"
                            >
                              ️
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
            <div className="pt-4 border-t border-ardoise-clair/10">
              <p className="text-xs uppercase font-semibold text-ardoise mb-3">
                💊 Nouvelle prescription
              </p>
              <div className="space-y-2">
                <textarea
                  value={nouvMedicaments}
                  onChange={(e) => setNouvMedicaments(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  placeholder="Médicaments et posologie (obligatoire)..."
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
                <Bouton 
                  variante="primaire" 
                  taille="petit" 
                  disabled={!nouvMedicaments.trim() || envoi} 
                  onClick={handleCreerOrdonnance}
                  chargement={envoi}
                  className="w-full"
                >
                  {envoi ? "Création..." : "+ Prescrire"}
                </Bouton>
              </div>
            </div>
          </Carte>
        </div>
      </div>

      {/* Modale de confirmation suppression */}
      {supprId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm shadow-2xl border border-ardoise-clair/10">
            <h3 className="text-lg font-bold text-ardoise mb-2">
              ⚠️ Confirmer la suppression
            </h3>
            <p className="text-sm text-ardoise-clair mb-6">
              Cette action est irréversible. L'ordonnance sera définitivement supprimée.
            </p>
            <div className="flex gap-3 justify-end">
              <Bouton variante="ghost" onClick={() => setSupprId(null)}>
                Annuler
              </Bouton>
              <Bouton variante="danger" onClick={handleSupprimerOrdonnance}>
                🗑️ Supprimer
              </Bouton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}