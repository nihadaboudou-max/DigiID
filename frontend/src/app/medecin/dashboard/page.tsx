"use client";

/**
 * Tableau de bord Médecin — Gestion des dossiers médicaux.
 * 
 * Modules accessibles :
 *   - creation_dossier    → /medecin/nouveau-dossier
 *   - suivi_dossier       → /medecin/dossiers
 *   - recherche_patient   → (recherche intégrée)
 *   - attestations_medicales → /medecin/attestations
 *   - historique_consultations → (timeline intégrée)
 *   - ordonnances         → /medecin/ordonnances
 *   - calendrier_rendezvous → /medecin/rendez-vous
 */
import Link from "next/link";
import { useRoleUI } from "@/crochets/useRoleUI";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";

export default function MedecinDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

// Données statiques de démonstration
const PATIENTS_RECENTS = [
  { id: "DIG-001", nom: "Fatou Diallo", motif: "Consultation générale", date: "2026-06-10", statut: "complet" as const },
  { id: "DIG-002", nom: "Oumar Sall", motif: "Suivi diabète", date: "2026-06-09", statut: "incomplet" as const },
  { id: "DIG-003", nom: "Aïcha Ba", motif: "Bilan annuel", date: "2026-06-08", statut: "complet" as const },
  { id: "DIG-004", nom: "Moussa Ndiaye", motif: "Consultation pédiatrique", date: "2026-06-07", statut: "en_attente" as const },
  { id: "DIG-005", nom: "Ramatoulaye Seck", motif: "Suivi prénatal", date: "2026-06-06", statut: "complet" as const },
];

function Contenu() {
  const { can, chargement } = useRoleUI();

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <header>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
          <h1 className="mt-1">Tableau de bord</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-12">Chargement de ton espace médecin...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
          <h1 className="mt-1">Tableau de bord médecin</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Gère tes patients, crée et suis les dossiers médicaux, émets des attestations.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {can.createMedicalRecord && (
            <Link href="/medecin/nouveau-dossier">
              <Bouton variante="primaire">
                + Nouveau dossier
              </Bouton>
            </Link>
          )}
          <Link href="/medecin/dossiers">
            <Bouton variante="ghost">Voir tous les dossiers</Bouton>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-lagune">8</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wide">Patients aujourd'hui</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-ocre">23</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wide">Dossiers ouverts</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-succes">15</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wide">Attestations émises</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-terre">5</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wide">Rendez-vous planifiés</p>
        </div>
      </div>

      {/* Recherche patient */}
      {can.searchPatient && (
        <Carte titre="Recherche patient">
          <p className="text-sm text-ardoise-clair mb-3">Recherche par ID DigiID, CNI ou nom</p>
          <ChampRecherche
            placeholder="DigiID, CNI ou nom du patient..."
            onChange={(e) => console.log("Recherche:", e.target.value)}
          />
        </Carte>
      )}

      {/* Patients du jour */}
      {can.viewMedicalRecords && (
        <Carte titre="Patients actifs">
          <div className="space-y-2">
            {PATIENTS_RECENTS.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-3 bg-sable rounded-lg hover:bg-sable/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold">
                    {patient.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{patient.nom}</p>
                    <p className="text-xs text-ardoise-clair">
                      {patient.motif} · {new Date(patient.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variante={
                      patient.statut === "complet"
                        ? "succes"
                        : patient.statut === "incomplet"
                        ? "terre"
                        : "ocre"
                    }
                  >
                    {patient.statut === "complet"
                      ? "Complet"
                      : patient.statut === "incomplet"
                      ? "Incomplet"
                      : "En attente"}
                  </Badge>
                  {can.viewMedicalRecords && (
                    <Link
                      href={`/medecin/dossiers/${patient.id}`}
                      className="text-xs text-ocre hover:underline"
                    >
                      Voir →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {/* Alertes dossiers incomplets */}
      {PATIENTS_RECENTS.filter((p) => p.statut === "incomplet").length > 0 && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm font-semibold text-ocre">
            ⚠ {PATIENTS_RECENTS.filter((p) => p.statut === "incomplet").length} dossier(s) incomplet(s)
          </p>
          <p className="text-xs text-ardoise-clair mt-1">
            Complète les informations manquantes pour assurer un suivi optimal.
          </p>
        </div>
      )}

      {/* Grille d'accès rapide */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.createMedicalRecord && (
          <CarteAction
            titre="Créer un dossier"
            description="Nouveau dossier médical pour un patient"
            href="/medecin/nouveau-dossier"
            icone="📋"
          />
        )}
        {can.viewMedicalRecords && (
          <CarteAction
            titre="Suivi des dossiers"
            description="Consulte et mets à jour les dossiers existants"
            href="/medecin/dossiers"
            icone="📂"
          />
        )}
        {can.managePrescriptions && (
          <CarteAction
            titre="Ordonnances"
            description="Gère les prescriptions et documents"
            href="/medecin/ordonnances"
            icone="💊"
          />
        )}
        {can.manageMedicalAttestations && (
          <CarteAction
            titre="Attestations médicales"
            description="Émets et gère les certificats médicaux"
            href="/medecin/attestations"
            icone="📄"
          />
        )}
        {can.manageAppointments && (
          <CarteAction
            titre="Calendrier"
            description="Planifie et gère tes rendez-vous"
            href="/medecin/rendez-vous"
            icone="📅"
          />
        )}
        {can.viewConsultationHistory && (
          <CarteAction
            titre="Historique"
            description="Timeline complète des consultations"
            href="/medecin/historique"
            icone="🕐"
          />
        )}
      </div>

      {/* Navigation modules inaccessibles (si certains sont désactivés) */}
      {!can.createMedicalRecord && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">
            Le module de création de dossiers est actuellement désactivé. Contacte le super administrateur si nécessaire.
          </p>
        </div>
      )}
    </div>
  );
}

function CarteAction({
  titre,
  description,
  href,
  icone,
}: {
  titre: string;
  description: string;
  href: string;
  icone: string;
}) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all duration-200 h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">
              {titre}
            </h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">
          Accéder →
        </p>
      </div>
    </Link>
  );
}
