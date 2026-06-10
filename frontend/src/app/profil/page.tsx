"use client";

/**
 * Page profil utilisateur — informations personnelles avec mode édition.
 * La partie vérifications d'identité a été déplacée dans le menu Identité dédié.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";

export default function PageProfil() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, rafraichirProfil } = useAuthentification();

  const [modeEdition, setModeEdition] = useState(false);
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (utilisateur) {
      setTelephone(utilisateur.telephone || "");
      setVille(utilisateur.ville || "");
    }
  }, [utilisateur]);

  if (!utilisateur) return null;

  async function sauvegarder() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    try {
      await clientAPI.patch(
        "/api/v1/utilisateur/profil",
        { telephone: telephone || null, ville: ville || null },
        { authentifie: true },
      );
      await rafraichirProfil();
      setMessage("Profil mis à jour avec succès !");
      setModeEdition(false);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise à jour.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mes informations
        </p>
        <h1 className="mt-1">Mon profil</h1>
        <p className="text-ardoise-clair mt-2">
          Toutes les données que DigiID conserve sur toi, classées et chiffrées.
        </p>
      </header>

      <Alerte variante="info" titre="Tes données t'appartiennent">
        Toutes ces informations sont chiffrées au repos avec AES-256-GCM.
        Même les administrateurs de DigiID ne peuvent pas les lire en clair.
      </Alerte>

      {message && <Alerte variante="succes">{message}</Alerte>}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Identité civile */}
      <Carte titre="Identité civile">
        {modeEdition ? (
          <div className="space-y-4">
            <ChampSaisie
              libelle="Téléphone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+221 77 123 45 67"
              aide="Format international recommandé pour recevoir les codes de vérification."
            />
            <ChampSaisie
              libelle="Ville"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Dakar"
            />
            <div className="flex gap-3 pt-2">
              <Bouton variante="primaire" chargement={chargement} onClick={sauvegarder}>
                Enregistrer
              </Bouton>
              <Bouton variante="ghost" onClick={() => setModeEdition(false)}>
                Annuler
              </Bouton>
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Champ libelle="Prénom" valeur={utilisateur.prenom} />
              <Champ libelle="Nom" valeur={utilisateur.nom} />
              <Champ libelle="Email" valeur={utilisateur.email} />
              <Champ libelle="Téléphone" valeur={utilisateur.telephone || "—"} />
              <Champ libelle="Ville" valeur={utilisateur.ville} />
            </div>
            <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModeEdition(true)}>
                Modifier mon profil
              </Bouton>
            </div>
          </>
        )}
      </Carte>

      {/* Identifiant DigiID */}
      <Carte titre="Mon identifiant DigiID" description="C'est ce que tu partages à un tiers">
        <p className="text-3xl font-mono font-bold text-lagune break-all mb-2">
          {utilisateur.digiid_public}
        </p>
        <p className="text-xs text-ardoise-clair italic">
          16 caractères. Unique. Stable. Reconnu par les partenaires DigiID.
        </p>
      </Carte>

      {/* État du compte */}
      <Carte titre="État du compte">
        <div className="space-y-3">
          <LigneÉtat libelle="Statut" valeur={<Badge variante="succes">Actif</Badge>} />
          <LigneÉtat libelle="Rôle" valeur={<Badge variante="lagune">{utilisateur.role.replace(/_/g, " ")}</Badge>} />
          <LigneÉtat
            libelle="Email vérifié"
            valeur={
              utilisateur.est_email_verifie
                ? <Badge variante="succes">Vérifié</Badge>
                : <Link href="/identite/email" className="text-sm text-lagune hover:underline">Vérifier maintenant</Link>
            }
          />
          <LigneÉtat libelle="2FA activée" valeur={utilisateur.deux_fa_active ? <Badge variante="succes">Activée</Badge> : <Badge variante="neutre">Désactivée</Badge>} />
        </div>
        {!utilisateur.deux_fa_active && (
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <p className="text-sm text-ardoise-clair mb-3">
              Protège ton compte avec un code à 6 chiffres en plus de ton mot de passe.
            </p>
            <Gestion2FA varianteBouton="secondaire" />
          </div>
        )}
      </Carte>

      {/* Attestations communautaires */}
      {utilisateur.attestations_recues && utilisateur.attestations_recues.length > 0 && (
        <Carte titre="Attestations reçues" description="Des membres de la communauté attestent pour toi">
          <div className="space-y-3">
            {utilisateur.attestations_recues.map((a) => (
              <div key={a.id} className="flex items-start justify-between p-3 rounded-lg border border-ardoise-clair/10">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variante={a.statut === "APPROUVEE" ? "succes" : a.statut === "EN_ATTENTE" ? "info" : "neutre"}>
                      {a.statut}
                    </Badge>
                    <span className="font-medium text-ardoise">{a.titre}</span>
                  </div>
                  <p className="text-sm text-ardoise-clair mt-1">
                    Type : {a.type_attestation}
                    {a.lien_nature && ` — ${a.lien_nature}`}
                    {a.lien_connu_depuis && ` (${a.lien_connu_depuis})`}
                  </p>
                  <p className="text-xs text-ardoise-clair mt-1">
                    {a.poids_score} pts · {new Date(a.date_soumission).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <Link href="/attestations-communautaires">
              <Bouton variante="primaire">Voir toutes mes attestations →</Bouton>
            </Link>
          </div>
        </Carte>
      )}

      {/* Lien vers le menu identité */}
      <Carte titre="Vérifications d'identité" description="Retrouve toutes les étapes dans le menu dédié">
        <p className="text-sm text-ardoise-clair mb-4">
          Les vérifications d&apos;identité (faciale, CNI, email, 2FA, rôle) 
          sont maintenant regroupées dans le menu <strong>Identité</strong>.
        </p>
        <Link href="/identite">
          <Bouton variante="primaire">Accéder au menu Identité →</Bouton>
        </Link>
      </Carte>

      {/* Actions */}
      <Carte titre="Actions sur mes données" description="Conformément à la loi 2008-12 (Sénégal)">
        <div className="grid sm:grid-cols-2 gap-3">
          <Bouton variante="ghost" onClick={() => setModeEdition(true)}>
            Modifier mon profil
          </Bouton>
          <Bouton variante="ghost" disabled>
            Exporter mes données
          </Bouton>
          <Bouton variante="ghost" disabled>
            Gérer mes consentements
          </Bouton>
          <Bouton variante="ghost" disabled className="!border-terre !text-terre hover:!bg-terre hover:!text-white">
            Supprimer mon compte
          </Bouton>
        </div>
      </Carte>
    </div>
  );
}

function Champ({ libelle, valeur }: { libelle: string; valeur: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1 pb-3 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-xs text-ardoise-clair uppercase tracking-wide">{libelle}</span>
      <span className="font-medium text-ardoise">{valeur || "—"}</span>
    </div>
  );
}

function LigneÉtat({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-ardoise">{libelle}</span>
      {valeur}
    </div>
  );
}
