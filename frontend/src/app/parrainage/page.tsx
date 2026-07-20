
"use client";

/**
 * Page Parrainage — code unique, lien d'invitation, statistiques.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
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
    const text =
      `Salut ! Je t'invite a rejoindre DigiID, le systeme d'identite numerique africaine. ` +
      `Inscris-toi avec mon code de parrainage : ${donnees.code}\n${donnees.lien_invitation}`;

    if (navigator.share) {
      navigator.share({
        title: "Invitation DigiID",
        text,
        url: donnees.lien_invitation,
      }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      });
      return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (chargement) return <p className="text-ardoise-clair italic">Chargement...</p>;
  if (!donnees) return null;

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Programme de parrainage
        </p>
        <h1 className="mt-1">Invite tes amis</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Partage ton code avec tes amis. A chaque inscription, tu gagnes <strong>2 points</strong> de
          bonus et ton ami gagne <strong>1 point</strong> de bienvenue.
        </p>
      </header>

      {/* Code de parrainage en grand */}
      <Carte variante="accent" className="text-center">
        <p className="text-xs uppercase text-ocre font-bold mb-2 tracking-wider">
          Ton code de parrainage
        </p>
        <p className="text-6xl font-mono font-bold text-lagune mb-4 tracking-widest">
          {donnees.code}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Bouton variante="primaire" onClick={copierCode}>
            {codeCopie ? <><IconeCheck /> Copie !</> : <><IconeCopier /> Copier le code</>}
          </Bouton>
          <Bouton variante="secondaire" onClick={partagerWhatsApp}>
            <IconePartage /> Partager
          </Bouton>
        </div>
      </Carte>

      {/* Lien direct */}
      <Carte>
        <h3 className="mb-2">Lien d'invitation direct</h3>
        <p className="text-sm text-ardoise-clair mb-3">
          Tes amis cliquent dessus et arrivent directement sur l'inscription avec ton code pre-rempli.
        </p>
        <div className="flex gap-2 items-stretch">
          <code className="flex-grow bg-sable-clair p-3 rounded text-sm text-ardoise overflow-x-auto whitespace-nowrap font-mono">
            {donnees.lien_invitation}
          </code>
          <Bouton variante="ghost" onClick={copierLien}>
            {lienCopie ? <IconeCheck /> : <IconeCopier />}
          </Bouton>
        </div>
      </Carte>

      {/* Statistiques */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-1">
            Filleuls inscrits
          </p>
          <p className="text-5xl font-bold text-lagune">{donnees.nombre_filleuls}</p>
        </Carte>
        <Carte>
          <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-1">
            Points gagnes grace aux filleuls
          </p>
          <p className="text-5xl font-bold text-ocre">+{donnees.bonus_recus}</p>
        </Carte>
      </div>

      {/* Comment ca marche */}
      <Carte variante="pointilles" titre="Comment ca marche">
        <ol className="space-y-3 text-sm text-ardoise list-decimal list-inside">
          <li>Tu partages ton code <code className="bg-ocre/15 px-2 py-0.5 rounded font-mono">{donnees.code}</code> avec un ami.</li>
          <li>Ton ami s'inscrit sur DigiID en saisissant ton code dans le formulaire.</li>
          <li>Des qu'il a valide son inscription, tu gagnes <strong>+2 points</strong> et un badge "Sociable".</li>
                      <li>Lui gagne <strong>+1 point</strong> de bienvenue immediats.</li>
          <li>Tu peux parrainer un nombre illimite d'amis !</li>
        </ol>
      </Carte>
    </div>
  );
}
