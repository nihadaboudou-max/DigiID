"use client";
/**
Page Super Admin — Gestion complète des attestations communautaires.
Contrôle total : validation, suspension, statistiques, configuration.
*/
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { Tableau, type Colonne } from "@/composants/commun/Tableau";
import { useNotifications } from "@/contextes/notifications";
import { clientAPI, ErreurAPI } from "@/services/client_api";

interface Attestation {
  id: string;
  type_attestation: string;
  titre: string;
  statut: string;
  atteste_id: string;
  atteste_nom: string;
  atteste_email: string;
  attestant_id: string;
  attestant_nom: string;
  attestant_email: string;
  lien_nature: string;
  lien_connu_depuis: string;
  forces: string;
  poids_score: number;
  est_active: boolean;
  date_soumission: string;
  date_expiration: string | null;
  date_validation: string | null;
  valide_par: string | null;
  motif_refus: string | null;
}

interface StatistiquesAttestations {
  total: number;
  en_attente: number;
  validees: number;
  refusees: number;
  expirees: number;
  actives: number;
}

export default function PageAttestationsSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur", "super_admin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [stats, setStats] = useState<StatistiquesAttestations | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [filtreType, setFiltreType] = useState<string>("tous");
  
  const [modaleDetails, setModaleDetails] = useState<Attestation | null>(null);
  const [modaleValidation, setModaleValidation] = useState<Attestation | null>(null);
  const [modaleRefus, setModaleRefus] = useState<Attestation | null>(null);
  const [motifRefus, setMotifRefus] = useState("");
  const [validationEnCours, setValidationEnCours] = useState(false);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [atts, statsData] = await Promise.all([
        clientAPI.get<{ attestations: Attestation[] }>("/api/v1/super-admin/attestations", { authentifie: true }),
        clientAPI.get<{ statistiques: StatistiquesAttestations }>("/api/v1/super-admin/attestations/statistiques", { authentifie: true }),
      ]);
      setAttestations(atts.attestations || []);
      setStats(statsData.statistiques || null);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const attestationsFiltrees = attestations.filter((a) => {
    const correspondRecherche = !recherche || 
      a.titre.toLowerCase().includes(recherche.toLowerCase()) ||
      a.atteste_nom.toLowerCase().includes(recherche.toLowerCase()) ||
      a.attestant_nom.toLowerCase().includes(recherche.toLowerCase()) ||
      a.atteste_email.toLowerCase().includes(recherche.toLowerCase());
    const correspondStatut = filtreStatut === "tous" || a.statut === filtreStatut;
    const correspondType = filtreType === "tous" || a.type_attestation === filtreType;
    return correspondRecherche && correspondStatut && correspondType;
  });

  const gererValidation = async () => {
    if (!modaleValidation) return;
    setValidationEnCours(true);
    try {
      await clientAPI.post(`/api/v1/super-admin/attestations/${modaleValidation.id}/valider`, {}, { authentifie: true });
      notifier("Attestation validée avec succès", "succes");
      setModaleValidation(null);
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de validation", "erreur");
    } finally {
      setValidationEnCours(false);
    }
  };

  const gererRefus = async () => {
    if (!modaleRefus || !motifRefus.trim()) return;
    setValidationEnCours(true);
    try {
      await clientAPI.post(`/api/v1/super-admin/attestations/${modaleRefus.id}/refuser`, { motif: motifRefus.trim() }, { authentifie: true });
      notifier("Attestation refusée", "succes");
      setModaleRefus(null);
      setMotifRefus("");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de refus", "erreur");
    } finally {
      setValidationEnCours(false);
    }
  };

  const gererSuspension = async (id: string, estActive: boolean) => {
    if (!confirm(`${estActive ? "Suspendre" : "Réactiver"} cette attestation ?`)) return;
    try {
      await clientAPI.post(`/api/v1/super-admin/attestations/${id}/${estActive ? "suspendre" : "reactiver"}`, {}, { authentifie: true });
      notifier(`Attestation ${estActive ? "suspendue" : "réactivée"}`, "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    }
  };

  const gererExportCSV = () => {
    if (attestationsFiltrees.length === 0) {
      notifier("Aucune attestation à exporter", "avertissement");
      return;
    }
    const enTetes = ["ID", "Type", "Titre", "Statut", "Attesté", "Email Attesté", "Attestant", "Email Attestant", "Nature Lien", "Poids Score", "Active", "Date Soumission", "Date Expiration"];
    const lignes = attestationsFiltrees.map((a) => [
      a.id, a.type_attestation, a.titre, a.statut,
      a.atteste_nom, a.atteste_email, a.attestant_nom, a.attestant_email,
      a.lien_nature, a.poids_score, a.est_active ? "Oui" : "Non",
      new Date(a.date_soumission).toLocaleDateString("fr-FR"),
      a.date_expiration ? new Date(a.date_expiration).toLocaleDateString("fr-FR") : "—",
    ]);
    const csv = [enTetes.join(","), ...lignes.map((l) => l.join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attestations-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notifier("Export CSV téléchargé", "succes");
  };

  const colonnes: Colonne<Attestation>[] = [
    {
      cle: "titre",
      libelle: "Attestation",
      rendu: (a) => (
        <div>
          <p className="font-medium text-ardoise">{a.titre}</p>
          <p className="text-xs text-ardoise-clair">{a.type_attestation}</p>
        </div>
      ),
    },
    {
      cle: "atteste",
      libelle: "Attesté",
      rendu: (a) => (
        <div>
          <p className="text-sm text-ardoise">{a.atteste_nom}</p>
          <p className="text-xs text-ardoise-clair">{a.atteste_email}</p>
        </div>
      ),
    },
    {
      cle: "attestant",
      libelle: "Attestant",
      rendu: (a) => (
        <div>
          <p className="text-sm text-ardoise">{a.attestant_nom}</p>
          <p className="text-xs text-ardoise-clair">{a.attestant_email}</p>
        </div>
      ),
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (a) => {
        const variante = a.statut === "validee" ? "succes" : a.statut === "refusee" ? "terre" : "ocre";
        return <Badge variante={variante}>{a.statut}</Badge>;
      },
    },
    {
      cle: "active",
      libelle: "Active",
      alignement: "centre",
      rendu: (a) => (
        <Badge variante={a.est_active ? "succes" : "neutre"}>
          {a.est_active ? "✓" : "✗"}
        </Badge>
      ),
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (a) => (
        <div className="flex gap-1">
          <Bouton variante="ghost" taille="petit" onClick={() => setModaleDetails(a)}>Voir</Bouton>
          {a.statut === "en_attente" && (
            <>
              <Bouton variante="primaire" taille="petit" onClick={() => setModaleValidation(a)}>Valider</Bouton>
              <Bouton variante="danger" taille="petit" onClick={() => setModaleRefus(a)}>Refuser</Bouton>
            </>
          )}
          <Bouton
            variante="ghost"
            taille="petit"
            onClick={() => gererSuspension(a.id, a.est_active)}
            className={a.est_active ? "!border-terre !text-terre" : ""}
          >
            {a.est_active ? "Suspendre" : "Réactiver"}
          </Bouton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Gestion des Attestations</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Contrôle total sur toutes les attestations communautaires du système.
          Validation, suspension, statistiques et export.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="carte text-center p-3">
            <p className="text-2xl font-bold text-lagune">{stats.total}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Total</p>
          </div>
          <div className="carte text-center p-3">
            <p className="text-2xl font-bold text-ocre">{stats.en_attente}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">En attente</p>
          </div>
          <div className="carte text-center p-3">
            <p className="text-2xl font-bold text-succes">{stats.validees}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Validées</p>
          </div>
          <div className="carte text-center p-3">
            <p className="text-2xl font-bold text-terre">{stats.refusees}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Refusées</p>
          </div>
          <div className="carte text-center p-3">
            <p className="text-2xl font-bold text-ardoise-clair">{stats.expirees}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Expirées</p>
          </div>
          <div className="carte text-center p-3">
            <p className="text-2xl font-bold text-lagune">{stats.actives}</p>
            <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Actives</p>
          </div>
        </div>
      )}

      {/* Filtres et actions */}
      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{attestationsFiltrees.length}</strong> attestation{attestationsFiltrees.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <select
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value)}
              className="px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="tous">Tous les types</option>
              <option value="professionnelle">Professionnelle</option>
              <option value="personnelle">Personnelle</option>
              <option value="communautaire">Communautaire</option>
              <option value="medicale">Médicale</option>
            </select>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="tous">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="validee">Validée</option>
              <option value="refusee">Refusée</option>
              <option value="expiree">Expirée</option>
            </select>
            <div className="flex-grow sm:w-64">
              <ChampRecherche
                placeholder="Rechercher titre, nom, email..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            <Bouton variante="ghost" taille="petit" onClick={gererExportCSV} title="Exporter en CSV">
              Exporter
            </Bouton>
          </div>
        </div>
        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau
            colonnes={colonnes}
            donnees={attestationsFiltrees}
            cleLigne={(a) => a.id}
            vide="Aucune attestation trouvée."
          />
        )}
      </Carte>

      {/* Modale Détails */}
      {modaleDetails && (
        <Modal ouvert={true} surFermeture={() => setModaleDetails(null)} titre="Détails de l'attestation" taille="grand">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ardoise-clair">Titre</p><p className="font-semibold">{modaleDetails.titre}</p></div>
              <div><p className="text-xs text-ardoise-clair">Type</p><Badge variante="lagune">{modaleDetails.type_attestation}</Badge></div>
              <div><p className="text-xs text-ardoise-clair">Statut</p><Badge variante={modaleDetails.statut === "validee" ? "succes" : modaleDetails.statut === "refusee" ? "terre" : "ocre"}>{modaleDetails.statut}</Badge></div>
              <div><p className="text-xs text-ardoise-clair">Active</p><Badge variante={modaleDetails.est_active ? "succes" : "neutre"}>{modaleDetails.est_active ? "Oui" : "Non"}</Badge></div>
              <div><p className="text-xs text-ardoise-clair">Attesté</p><p>{modaleDetails.atteste_nom}</p><p className="text-xs text-ardoise-clair">{modaleDetails.atteste_email}</p></div>
              <div><p className="text-xs text-ardoise-clair">Attestant</p><p>{modaleDetails.attestant_nom}</p><p className="text-xs text-ardoise-clair">{modaleDetails.attestant_email}</p></div>
              <div><p className="text-xs text-ardoise-clair">Nature du lien</p><p>{modaleDetails.lien_nature}</p></div>
              <div><p className="text-xs text-ardoise-clair">Connu depuis</p><p>{modaleDetails.lien_connu_depuis}</p></div>
              <div className="col-span-2"><p className="text-xs text-ardoise-clair">Forces/Qualités</p><p>{modaleDetails.forces}</p></div>
              <div><p className="text-xs text-ardoise-clair">Poids score</p><p className="font-bold text-lagune">+{modaleDetails.poids_score} points</p></div>
              <div><p className="text-xs text-ardoise-clair">Date soumission</p><p>{new Date(modaleDetails.date_soumission).toLocaleDateString("fr-FR")}</p></div>
              {modaleDetails.date_expiration && <div><p className="text-xs text-ardoise-clair">Date expiration</p><p>{new Date(modaleDetails.date_expiration).toLocaleDateString("fr-FR")}</p></div>}
              {modaleDetails.date_validation && <div><p className="text-xs text-ardoise-clair">Date validation</p><p>{new Date(modaleDetails.date_validation).toLocaleDateString("fr-FR")}</p></div>}
              {modaleDetails.motif_refus && <div className="col-span-2"><p className="text-xs text-ardoise-clair">Motif refus</p><p className="text-terre">{modaleDetails.motif_refus}</p></div>}
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModaleDetails(null)}>Fermer</Bouton>
              {modaleDetails.statut === "en_attente" && (
                <>
                  <Bouton variante="primaire" onClick={() => { setModaleDetails(null); setModaleValidation(modaleDetails); }}>Valider</Bouton>
                  <Bouton variante="danger" onClick={() => { setModaleDetails(null); setModaleRefus(modaleDetails); }}>Refuser</Bouton>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modale Validation */}
      {modaleValidation && (
        <Modal ouvert={true} surFermeture={() => !validationEnCours && setModaleValidation(null)} titre="Valider l'attestation" taille="moyen">
          <div className="space-y-3">
            <div className="bg-succes/10 border border-succes/30 rounded-lg p-3">
              <p className="text-sm font-semibold text-succes">Confirmation de validation</p>
              <p className="text-xs text-ardoise-clair mt-1">
                Cette action va valider l'attestation "{modaleValidation.titre}" et attribuer +{modaleValidation.poids_score} points au score de {modaleValidation.atteste_nom}.
              </p>
            </div>
            <div className="text-sm space-y-1">
              <p><strong>Attesté :</strong> {modaleValidation.atteste_nom}</p>
              <p><strong>Attestant :</strong> {modaleValidation.attestant_nom}</p>
              <p><strong>Type :</strong> {modaleValidation.type_attestation}</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Bouton variante="ghost" onClick={() => setModaleValidation(null)} disabled={validationEnCours}>Annuler</Bouton>
              <Bouton variante="primaire" chargement={validationEnCours} onClick={gererValidation}>✓ Confirmer la validation</Bouton>
            </div>
          </div>
        </Modal>
      )}

      {/* Modale Refus */}
      {modaleRefus && (
        <Modal ouvert={true} surFermeture={() => !validationEnCours && setModaleRefus(null)} titre="Refuser l'attestation" taille="moyen">
          <div className="space-y-3">
            <div className="bg-terre/10 border border-terre/30 rounded-lg p-3">
              <p className="text-sm font-semibold text-terre">Motif de refus obligatoire</p>
              <p className="text-xs text-ardoise-clair mt-1">
                Expliquez pourquoi cette attestation est refusée. Cette information sera visible par l'utilisateur.
              </p>
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Motif du refus</label>
              <textarea
                value={motifRefus}
                onChange={(e) => setMotifRefus(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
                rows={4}
                placeholder="Ex: Informations insuffisantes, lien non vérifiable..."
                required
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Bouton variante="ghost" onClick={() => { setModaleRefus(null); setMotifRefus(""); }} disabled={validationEnCours}>Annuler</Bouton>
              <Bouton variante="danger" chargement={validationEnCours} onClick={gererRefus} disabled={!motifRefus.trim()}> Confirmer le refus</Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}