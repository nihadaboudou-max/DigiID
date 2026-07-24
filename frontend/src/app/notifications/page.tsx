"use client";

/**
 * Page Parrainage — compacte, l'essentiel.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { IconeCopier, IconeCheck, IconePartage } from "@/composants/commun/Icones";
import { useNotifications } from "@/contextes/notifications";
import { obtenirMonParrainage, type CodeParrainage } from "@/services/gamification";
import { ErreurAPI } from "@/services/client_api";

export default function PageParrainage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical",
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine",
      "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [donnees, setDonnees] = useState<CodeParrainage | null>(null);
  const [chargement, setChargement] = useState(true);
  const [codeCopie, setCodeCopie] = useState(false);
  const [lienCopie, setLienCopie] = useState(false);

  useEffect(() => {
    obtenirMonParrainage()
      .then(setDonnees)
      .catch((e) => notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur"))
      .finally(() => setChargement(false));
  }, []);

  async function copierCode() {
    if (!donnees) return;
    await navigator.clipboard.writeText(donnees.code);
    setCodeCopie(true);
    notifier("Code copie !", "succes");
    setTimeout(() => setCodeCopie(false), 2000);
  }

  async function copierLien() {
    if (!donnees) return;
    await navigator.clipboard.writeText(donnees.lien_invitation);
    setLienCopie(true);
    notifier("Lien copie !", "succes");
    setTimeout(() => setLienCopie(false), 2000);
  }

  function partagerWhatsApp() {
    if (!donnees) return;
    const text = `Rejoins-moi sur DigiID avec mon code : ${donnees.code}\n${donnees.lien_invitation}`;
    if (navigator.share) {
      navigator.share({ title: "Invitation DigiID", text, url: donnees.lien_invitation })
        .catch(() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"));
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (chargement) return <p className="text-ardoise-clair italic">Chargement...</p>;
  if (!donnees) return null;

  return (
    <div className="space-y-4 apparition">
      {/* Code + Stats en ligne */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Carte variante="accent" className="md:col-span-2 text-center py-5">
          <p className="text-xs uppercase text-ocre font-bold mb-1 tracking-wider">Ton code</p>
          <p className="text-5xl font-mono font-bold text-lagune tracking-widest">{donnees.code}</p>
          <div className="flex justify-center gap-2 mt-3">
            <Bouton variante="primaire" onClick={copierCode}>
              {codeCopie ? <><IconeCheck /> Copie !</> : <><IconeCopier /> Copier</>}
            </Bouton>
            <Bouton variante="secondaire" onClick={partagerWhatsApp}>
              <IconePartage /> Partager
            </Bouton>
          </div>
        </Carte>
        <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
          <Carte className="text-center py-4">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Filleuls</p>
            <p className="text-3xl font-bold text-lagune">{donnees.nombre_filleuls}</p>
          </Carte>
          <Carte className="text-center py-4">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Bonus</p>
            <p className="text-3xl font-bold text-ocre">+{donnees.bonus_recus}</p>
          </Carte>
        </div>
      </div>

      {/* Lien direct + gain */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Carte className="md:col-span-2">
          <p className="text-xs font-semibold">Lien d'invitation</p>
          <div className="flex gap-2 mt-1 items-stretch">
            <code className="flex-grow bg-sable-clair p-2 rounded text-xs text-ardoise overflow-x-auto whitespace-nowrap font-mono">
              {donnees.lien_invitation}
            </code>
            <Bouton variante="ghost" onClick={copierLien}>
              {lienCopie ? <IconeCheck /> : <IconeCopier />}
            </Bouton>
          </div>
        </Carte>
        <Carte variante="pointilles" className="text-center py-3">
          <p className="text-xs text-ardoise-clair">Tu gagnes <strong className="text-ocre">+5 pts</strong> par filleul, ton ami <strong className="text-lagune">+3 pts</strong></p>
        </Carte>
      </div>
    </div>
  );
}
