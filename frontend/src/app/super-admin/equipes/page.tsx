"use client";

import { useEffect, useState } from "react";
import { listerEquipes, creerEquipe, type Equipe } from "@/services/equipes";
import { listerDepartements, type Departement } from "@/services/departements";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";

export default function PageEquipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [nouvelle, setNouvelle] = useState({ nom: "", departement_id: "", description: "" });

  const charger = async () => {
    try {
      setChargement(true);
      const [eqs, deps] = await Promise.all([listerEquipes(), listerDepartements()]);
      setEquipes(eqs.equipes);
      setDepartements(deps.departements);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await creerEquipe(nouvelle);
      setModalOuvert(false);
      setNouvelle({ nom: "", departement_id: "", description: "" });
      charger();
    } catch (e: any) {
      setErreur(e.message);
    }
  };

  if (chargement) return <div className="p-8">Chargement...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-lagune">Gestion des Équipes</h1>
        <Bouton onClick={() => setModalOuvert(true)}>+ Nouvelle Équipe</Bouton>
      </div>

      {erreur && <Alerte type="erreur" message={erreur} onClose={() => setErreur(null)} />}

      <div className="bg-white rounded-xl shadow-doux overflow-hidden">
        <table className="w-full">
          <thead className="bg-sable">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Nom</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Département</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Description</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sable">
            {equipes.map((eq) => (
              <tr key={eq.id} className="hover:bg-sable-clair">
                <td className="px-6 py-4 text-sm font-medium">{eq.nom}</td>
                <td className="px-6 py-4 text-sm">
                  {departements.find((d) => d.id === eq.departement_id)?.nom || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-ardoise-clair">{eq.description || "-"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${eq.est_actif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {eq.est_actif ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal ouvert={modalOuvert} onClose={() => setModalOuvert(false)} titre="Nouvelle Équipe">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ChampSaisie
            label="Nom"
            value={nouvelle.nom}
            onChange={(e) => setNouvelle({ ...nouvelle, nom: e.target.value })}
            requis
          />
          <div>
            <label className="block text-sm font-medium mb-1">Département</label>
            <select
              value={nouvelle.departement_id}
              onChange={(e) => setNouvelle({ ...nouvelle, departement_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              requis
            >
              <option value="">Sélectionner un département</option>
              {departements.map((d) => (
                <option key={d.id} value={d.id}>{d.nom} ({d.type_departement})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={nouvelle.description}
              onChange={(e) => setNouvelle({ ...nouvelle, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Bouton variant="secondaire" onClick={() => setModalOuvert(false)}>Annuler</Bouton>
            <Bouton type="submit">Créer</Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}