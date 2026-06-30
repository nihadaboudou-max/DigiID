"use client";

import { useEffect, useState } from "react";
import { listerDomaines, creerDomaine, supprimerDomaine, type Domaine } from "@/services/domaines";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";

export default function PageDomaines() {
  const [domaines, setDomaines] = useState<Domaine[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [nouveauDomaine, setNouveauDomaine] = useState({ nom: "", code: "", region: "" });

  const chargerDomaines = async () => {
    try {
      setChargement(true);
      const reponse = await listerDomaines();
      setDomaines(reponse.domaines);
    } catch (e: any) {
      setErreur(e.message || "Erreur lors du chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerDomaines();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creerDomaine(nouveauDomaine);
      setModalOuvert(false);
      setNouveauDomaine({ nom: "", code: "", region: "" });
      chargerDomaines();
    } catch (e: any) {
      setErreur(e.message || "Erreur lors de la création");
    }
  };

  const handleSupprimer = async (id: string) => {
    if (!confirm("Supprimer ce domaine ?")) return;
    try {
      await supprimerDomaine(id);
      chargerDomaines();
    } catch (e: any) {
      setErreur(e.message || "Erreur lors de la suppression");
    }
  };

  if (chargement) return <div className="p-8">Chargement...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-lagune">Gestion des Domaines</h1>
        <Bouton onClick={() => setModalOuvert(true)}>+ Nouveau Domaine</Bouton>
      </div>

      {erreur && <Alerte type="erreur" message={erreur} onClose={() => setErreur(null)} />}

      <div className="bg-white rounded-xl shadow-doux overflow-hidden">
        <table className="w-full">
          <thead className="bg-sable">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Nom</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Code</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Région</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Statut</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sable">
            {domaines.map((d) => (
              <tr key={d.id} className="hover:bg-sable-clair">
                <td className="px-6 py-4 text-sm">{d.nom}</td>
                <td className="px-6 py-4 text-sm font-mono text-ocre">{d.code}</td>
                <td className="px-6 py-4 text-sm">{d.region || "-"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${d.est_actif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {d.est_actif ? "Actif" : "Suspendu"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Bouton variant="danger" taille="sm" onClick={() => handleSupprimer(d.id)}>
                    Supprimer
                  </Bouton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal ouvert={modalOuvert} onClose={() => setModalOuvert(false)} titre="Nouveau Domaine">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ChampSaisie
            label="Nom"
            value={nouveauDomaine.nom}
            onChange={(e) => setNouveauDomaine({ ...nouveauDomaine, nom: e.target.value })}
            requis
          />
          <ChampSaisie
            label="Code"
            value={nouveauDomaine.code}
            onChange={(e) => setNouveauDomaine({ ...nouveauDomaine, code: e.target.value.toUpperCase() })}
            requis
          />
          <ChampSaisie
            label="Région"
            value={nouveauDomaine.region}
            onChange={(e) => setNouveauDomaine({ ...nouveauDomaine, region: e.target.value })}
          />
          <div className="flex gap-2 justify-end">
            <Bouton variant="secondaire" onClick={() => setModalOuvert(false)}>Annuler</Bouton>
            <Bouton type="submit">Créer</Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}