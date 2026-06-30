"use client";

import { useEffect, useState } from "react";
import { listerInvitations, creerInvitation, type Invitation } from "@/services/invitations";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";

export default function PageInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [nouvelle, setNouvelle] = useState({ email: "", role: "admin_domaine", message: "" });

  const charger = async () => {
    try {
      setChargement(true);
      const reponse = await listerInvitations();
      setInvitations(reponse.invitations);
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
      await creerInvitation(nouvelle);
      setModalOuvert(false);
      setNouvelle({ email: "", role: "admin_domaine", message: "" });
      charger();
    } catch (e: any) {
      setErreur(e.message);
    }
  };

  if (chargement) return <div className="p-8">Chargement...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-lagune">Gestion des Invitations</h1>
        <Bouton onClick={() => setModalOuvert(true)}>+ Nouvelle Invitation</Bouton>
      </div>

      {erreur && <Alerte type="erreur" message={erreur} onClose={() => setErreur(null)} />}

      <div className="bg-white rounded-xl shadow-doux overflow-hidden">
        <table className="w-full">
          <thead className="bg-sable">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Rôle</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Statut</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Créée le</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ardoise">Expire le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sable">
            {invitations.map((i) => (
              <tr key={i.id} className="hover:bg-sable-clair">
                <td className="px-6 py-4 text-sm">{i.email}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-xs bg-lagune-clair text-white">
                    {i.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    i.statut === "acceptee" ? "bg-green-100 text-green-800" :
                    i.statut === "expiree" ? "bg-red-100 text-red-800" :
                    "bg-ocre-clair text-ocre-fonce"
                  }`}>
                    {i.statut}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{new Date(i.date_creation).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm">{new Date(i.date_expiration).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal ouvert={modalOuvert} onClose={() => setModalOuvert(false)} titre="Nouvelle Invitation">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ChampSaisie
            label="Email"
            type="email"
            value={nouvelle.email}
            onChange={(e) => setNouvelle({ ...nouvelle, email: e.target.value })}
            requis
          />
          <div>
            <label className="block text-sm font-medium mb-1">Rôle</label>
            <select
              value={nouvelle.role}
              onChange={(e) => setNouvelle({ ...nouvelle, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="admin_domaine">Admin Domaine</option>
              <option value="chef_police">Chef Police</option>
              <option value="chef_medical">Chef Médical</option>
              <option value="chef_ong">Chef ONG</option>
              <option value="chef_agent">Chef Agent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message (optionnel)</label>
            <textarea
              value={nouvelle.message}
              onChange={(e) => setNouvelle({ ...nouvelle, message: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Bouton variant="secondaire" onClick={() => setModalOuvert(false)}>Annuler</Bouton>
            <Bouton type="submit">Envoyer</Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}