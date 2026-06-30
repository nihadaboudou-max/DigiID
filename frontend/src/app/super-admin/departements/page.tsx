"use client";

import { useEffect, useState } from "react";
import { listerDepartements, creerDepartement, type Departement } from "@/services/departements";
import { listerDomaines, type Domaine } from "@/services/domaines";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";

export default function PageDepartements() {
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [domaines, setDomaines] = useState<Domaine[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [nouveau, setNouveau] = useState({
    nom: "",
    type_departement: "police",
    domaine_id: "",
    description: "",
  });

  const charger = async () => {
    try {
      setChargement(true);
      const [deps, doms] = await Promise.all([listerDepartements(), listerDomaines()]);
      setDepartements(deps.departements);
      setDomaines(doms.domaines);
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
      await creerDepartement(nouveau);
      setModalOuvert(false);
      setNouveau({ nom: "", type_departement: "police", domaine_id: "", description: "" });
      charger();
    } catch (e: any) {
      setErreur(e.message);
    }
  };

  if (chargement) return <div className="p-8">Chargement...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-lagune">Gestion des Départements</h1>
        <Bouton onClick={() => setModalOuvert(true)}>+ Nouveau Département</Bouton>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      <div className="bg-white rounded-xl shadow-doux overflow-hidden">
        <table className="w-full">
          <thead className="bg-sable">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Nom</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Domaine</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sable">
            {departements.map((d) => (
              <tr key={d.id} className="hover:bg-sable-clair">
                <td className="px-6 py-4 text-sm">{d.nom}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-xs bg-ocre-clair text-ocre-fonce">
                    {d.type_departement}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {domaines.find((dom) => dom.id === d.domaine_id)?.nom || "-"}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${d.est_actif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {d.est_actif ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal ouvert={modalOuvert} surFermeture={() => setModalOuvert(false)} titre="Nouveau Département">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ChampSaisie
            libelle="Nom"
            value={nouveau.nom}
            onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={nouveau.type_departement}
              onChange={(e) => setNouveau({ ...nouveau, type_departement: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="police">Police</option>
              <option value="medical">Médical</option>
              <option value="ong">ONG</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Domaine</label>
            <select
              value={nouveau.domaine_id}
              onChange={(e) => setNouveau({ ...nouveau, domaine_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Sélectionner un domaine</option>
              {domaines.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Bouton variante="secondaire" onClick={() => setModalOuvert(false)}>Annuler</Bouton>
            <Bouton type="submit">Créer</Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}