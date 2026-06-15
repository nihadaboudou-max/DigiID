"use client";

/**
 * Page d'administration des enrôlements — tous les enrôlements, filtrés par statut/agent.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";

interface AdminEnrolement {
  id: string;
  agent_id: string;
  agent_nom: string;
  citoyen_nom: string;
  citoyen_prenom: string;
  citoyen_digiid: string | null;
  citoyen_telephone: string | null;
  citoyen_email: string | null;
  statut: string;
  notes: string | null;
  scan_cni: boolean;
  capture_biometrique: boolean;
  date_enrolement: string;
  date_validation: string | null;
}

export default function AdminEnrolementsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [enrolements, setEnrolements] = useState<AdminEnrolement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [recherche, setRecherche] = useState("");

  useEffect(() => { charger(); }, [filtreStatut]);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const params = filtreStatut !== "tous" ? `?statut=${filtreStatut}` : "";
      const data = await clientAPI.get<AdminEnrolement[]>(`/api/v1/admin/enrolements${params}`, { authentifie: true });
      setEnrolements(data || []);
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }

  const filtres = ["tous", "en_attente", "valide", "rejete"];
  const enrolementsFiltres = enrolements.filter((e) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      e.citoyen_nom.toLowerCase().includes(q) ||
      e.citoyen_prenom.toLowerCase().includes(q) ||
      (e.citoyen_digiid && e.citoyen_digiid.toLowerCase().includes(q)) ||
      e.agent_nom.toLowerCase().includes(q) ||
      (e.citoyen_telephone && e.citoyen_telephone.includes(q))
    );
  });

  const stats = {
    total: enrolements.length,
    en_attente: enrolements.filter((e) => e.statut === "en_attente").length,
    valide: enrolements.filter((e) => e.statut === "valide").length,
    rejete: enrolements.filter((e) => e.statut === "rejete").length,
  };

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-terre font-semibold text-sm uppercase tracking-wider">Administration</p>
        <h1 className="mt-1">Enrolements citoyens</h1>
        <p className="text-ardoise-clair mt-2">
          Tous les enrolements effectues par les agents terrain.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CarteStat libelle="Total" valeur={stats.total} couleur="lagune" />
        <CarteStat libelle="En attente" valeur={stats.en_attente} couleur="ocre" />
        <CarteStat libelle="Valides" valeur={stats.valide} couleur="succes" />
        <CarteStat libelle="Rejetes" valeur={stats.rejete} couleur="terre" />
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte titre="Liste des enrolements">
        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-ardoise-clair/10">
          <div className="flex gap-1">
            {filtres.map((f) => (
              <button
                key={f}
                onClick={() => setFiltreStatut(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filtreStatut === f
                    ? "bg-lagune text-white"
                    : "bg-sable text-ardoise-clair hover:bg-sable/80"
                }`}
              >
                {f === "tous" ? "Tous" : f === "en_attente" ? "En attente" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher nom, DigiID, telephone..."
            className="ml-auto px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm max-w-xs"
          />
        </div>

        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : enrolementsFiltres.length === 0 ? (
          <p className="text-ardoise-clair italic text-center py-8">Aucun enrolement trouve.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4">Citoyen</th>
                  <th className="pb-3 pr-4">Telephone</th>
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrolementsFiltres.map((e) => (
                  <tr key={e.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-ardoise">{e.citoyen_prenom} {e.citoyen_nom}</p>
                      {e.citoyen_digiid && (
                        <p className="text-xs font-mono text-ardoise-clair/60">{e.citoyen_digiid}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-ardoise">{e.citoyen_telephone || "—"}</td>
                    <td className="py-3 pr-4 text-ardoise-clair">{e.agent_nom || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variante={e.statut === "valide" ? "succes" : e.statut === "rejete" ? "terre" : "ocre"}>
                        {e.statut === "valide" ? "Valide" : e.statut === "rejete" ? "Rejete" : "En attente"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-ardoise-clair text-xs">
                      {new Date(e.date_enrolement).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3">
                      <Link href={`/agent/enrolement/${e.id}`}>
                        <Bouton variante="ghost" taille="petit">Voir</Bouton>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </div>
  );
}

function CarteStat({ libelle, valeur, couleur }: { libelle: string; valeur: number; couleur: string }) {
  const classes = {
    lagune: "border-lagune/30",
    ocre: "border-ocre/30",
    succes: "border-green-400/30",
    terre: "border-terre/30",
  };
  const couleurs = {
    lagune: "text-lagune",
    ocre: "text-ocre",
    succes: "text-green-600",
    terre: "text-terre",
  };
  return (
    <div className={`carte border-l-4 ${classes[couleur as keyof typeof classes]}`}>
      <p className={`text-3xl font-bold ${couleurs[couleur as keyof typeof couleurs]}`}>{valeur}</p>
      <p className="text-xs uppercase text-ardoise-clair font-semibold">{libelle}</p>
    </div>
  );
}
