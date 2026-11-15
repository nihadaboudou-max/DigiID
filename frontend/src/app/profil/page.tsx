"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import {
  IconeAlerte,
  IconeCadenas,
  IconeCloche,
  IconeCheck,
  IconeColis,
  IconeCopier,
  IconeIdentite,
  IconeFlecheBas,
  IconeEmail,
  IconeParametres,
  IconeVisage,
} from "@/composants/commun/Icones";
import { EtatVerificationsCitoyen } from "@/composants/verifications";
import { CarteTelephone } from "@/composants/profil/CarteTelephone";
import { useEtatVerifications } from "@/crochets/useEtatVerifications";
import { useAuthentification } from "@/contextes/authentification";
import { modifierMonProfil, type ProfilModification } from "@/services/profil";
import { ErreurAPI } from "@/services/client_api";
import type { Utilisateur } from "@/types/api";

export default function PageProfil() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical",
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine",
      "administrateur", "super_administrateur"
    ]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, chargement, rafraichirProfil } = useAuthentification();
  const etatVerifications = useEtatVerifications();
  const [copie, setCopie] = useState(false);

  if (chargement || !utilisateur) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-ardoise-clair italic">Chargement du profil...</p>
      </div>
    );
  }

  const initiales = ((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?";
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;
  const digiId = utilisateur.digiid_public || "DigiID non généré";
  const estCitoyen = utilisateur.role === "citoyen";
  const urlProfil = typeof window !== "undefined"
    ? `${window.location.origin}/profil/${digiId}`
    : `https://digiid.africa/profil/${digiId}`;

  async function copierIdentifiant() {
    try {
      await navigator.clipboard.writeText(digiId);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = digiId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(urlProfil);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = urlProfil;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function partager() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon identité numérique DigiID",
          text: `Voici mon identifiant DigiID : ${digiId}`,
          url: urlProfil,
        });
      } catch { /* Annulé */ }
    } else {
      copierLien();
    }
  }

  // ✅ CORRECTION : Utiliser les champs existants (est_cni_verifiee + est_visage_verifie)
  const identiteVerifiee = utilisateur.est_cni_verifiee && utilisateur.est_visage_verifie;
  const aIncoherencePotentielle = !identiteVerifiee && (utilisateur.est_cni_verifiee || utilisateur.est_visage_verifie);

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>{estCitoyen ? "Mon profil" : "Mon Profil DigiID"}</h1>
        <p className="text-ardoise-clair mt-2">
          {estCitoyen
            ? "Gérez vos informations et accédez rapidement à vos démarches."
            : "Consultez vos informations personnelles et partagez votre identité numérique."}
        </p>
      </div>

      {!estCitoyen && (
        <>
      {/* Alerte d'incohérence (si CNI ou visage OK mais pas les deux) */}
      {aIncoherencePotentielle && (
        <Alerte variante="avertissement" titre="⚠️ Vérification d'identité incomplète">
          <p className="text-sm">
            Votre CNI ou votre visage a été vérifié, mais votre identité globale n'est pas encore validée. 
            Assurez-vous que le <strong>nom et le premier prénom</strong> sur vos documents correspondent exactement à ceux de votre profil.
            <Link href="/documents-identite" className="underline font-semibold ml-1">Vérifier mes documents →</Link>
          </p>
        </Alerte>
      )}

      {/* Carte principale d'identité */}
      <Carte>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* ✅ CORRECTION : Suppression de photo_profil_url - utilisation des initiales uniquement */}
          <div className="w-20 h-20 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-3xl font-bold flex-shrink-0 border-2 border-lagune/20">
            {initiales}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-bold text-ardoise">{nomComplet}</h2>
            <p className="text-sm text-ardoise-clair font-mono">{digiId}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variante="lagune" taille="petit">
                {utilisateur.role?.replace(/_/g, " ").toUpperCase()}
              </Badge>
              <Badge variante={utilisateur.est_actif ? "succes" : "terre"} taille="petit">
                {utilisateur.est_actif ? "Compte actif" : "Compte inactif"}
              </Badge>
              {/* ✅ CORRECTION : Utiliser identiteVerifiee (calculé localement) */}
              {identiteVerifiee && (
                <Badge variante="succes" taille="petit" className="border border-lagune/30">
                  ️ Identité vérifiée
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-ardoise-clair/10">
          {/* Coordonnées */}
          <div className="space-y-3">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Coordonnées</p>
            <div>
              <span className="text-sm text-ardoise-clair">Email :</span> 
              <span className="text-sm text-ardoise ml-2">{utilisateur.email}</span>
            </div>
            <div>
              <span className="text-sm text-ardoise-clair">Téléphone :</span> 
              <span className="text-sm text-ardoise ml-2">{utilisateur.telephone || "Non renseigné"}</span>
            </div>
            <div>
              <span className="text-sm text-ardoise-clair">Ville :</span> 
              <span className="text-sm text-ardoise ml-2">{utilisateur.ville || "Non renseignée"}</span>
            </div>
          </div>

          {/* État des vérifications (compte + documents d'identité fournis) */}
          <div className="space-y-3">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">État des vérifications</p>
            <EtatVerificationsCitoyen
              etat={etatVerifications}
              variante="complet"
              afficherProgression
            />
          </div>
        </div>
      </Carte>

      {/* Téléphone : complétion + vérification OTP (indicatif +229 imposé). */}
      <CarteTelephone />

      {/* Section identifiant DigiID */}
      <Carte>
        <p className="text-xs uppercase text-ocre font-bold mb-4 tracking-wider">
          Mon identifiant DigiID
        </p>
        <p className="text-3xl font-mono font-bold text-lagune break-all mb-6 tracking-wider">
          {digiId}
        </p>
        <div className="flex flex-wrap gap-3">
          <Bouton variante="secondaire" onClick={copierIdentifiant}>
            {copie ? (
              <><IconeCheck className="w-4 h-4" /> Copié !</>
            ) : (
              <><IconeCopier className="w-4 h-4" /> Copier mon DigiID</>
            )}
          </Bouton>
          {typeof navigator?.share === 'function' ? (
            <Bouton variante="primaire" onClick={partager}>
              📤 Partager
            </Bouton>
          ) : (
            <Bouton variante="primaire" onClick={copierLien}>
              🔗 Copier le lien
            </Bouton>
          )}
          <Link href="/profil/telecharger">
            <Bouton variante="ghost"> Télécharger mon profil numérique</Bouton>
          </Link>
        </div>
        <div className="mt-6 pt-4 border-t border-ardoise-clair/10">
          <p className="text-xs text-ardoise-clair font-semibold mb-2">Statut du profil</p>
          <div className="flex flex-wrap gap-2">
            {etatVerifications.etapes.map((etape) => (
              <Badge
                key={etape.id}
                variante={
                  etape.statut === "complete"
                    ? "succes"
                    : etape.statut === "attention"
                    ? "ocre"
                    : "terre"
                }
                taille="petit"
              >
                {etape.icone} {etape.titre} {etape.statut === "complete" ? "✓" : "✗"}
              </Badge>
            ))}
          </div>
        </div>
      </Carte>

      {/* Sécurité */}
      <Alerte variante="avertissement" titre="🔐 Sécurité">
        <p className="text-sm">Ne partage ton DigiID qu'avec des institutions ou personne de confiance. Chaque consultation est tracée.</p>
      </Alerte>
        </>
      )}

      {estCitoyen ? (
        <ProfilCitoyen
          utilisateur={utilisateur}
          copie={copie}
          onCopierIdentifiant={copierIdentifiant}
          onCopierLien={copierLien}
          onPartager={partager}
          rafraichirProfil={rafraichirProfil}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link href="/parametres">
            <Bouton variante="primaire">⚙️ Modifier mes informations</Bouton>
          </Link>
          <Link href="/autorisations">
            <Bouton variante="secondaire">🔑 Autorisations</Bouton>
          </Link>
          <Link href="/citoyen/dashboard">
            <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
          </Link>
        </div>
      )}
    </div>
  );
}

type SectionProfilId =
  | "informations"
  | "identite"
  | "notifications"
  | "activite"
  | "aide"
  | "parametres";

function ProfilCitoyen({
  utilisateur,
  copie,
  onCopierIdentifiant,
  onCopierLien,
  onPartager,
  rafraichirProfil,
}: {
  utilisateur: Utilisateur;
  copie: boolean;
  onCopierIdentifiant: () => Promise<void>;
  onCopierLien: () => Promise<void>;
  onPartager: () => Promise<void>;
  rafraichirProfil: () => Promise<void>;
}) {
  const [sectionOuverte, setSectionOuverte] =
    useState<SectionProfilId | null>("informations");
  const [prenom, setPrenom] = useState(utilisateur.prenom ?? "");
  const [nom, setNom] = useState(utilisateur.nom ?? "");
  const [ville, setVille] = useState(utilisateur.ville ?? "");
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageEnregistrement, setMessageEnregistrement] = useState<
    { type: "succes" | "erreur"; texte: string } | null
  >(null);

  useEffect(() => {
    setPrenom(utilisateur.prenom ?? "");
    setNom(utilisateur.nom ?? "");
    setVille(utilisateur.ville ?? "");
  }, [utilisateur.prenom, utilisateur.nom, utilisateur.ville]);

  const initiales =
    `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase() || "?";
  const identifiant = utilisateur.digiid_public || "DigiID non généré";
  const basculerSection = (section: SectionProfilId) =>
    setSectionOuverte((ouverte) => (ouverte === section ? null : section));

  async function enregistrerInformations() {
    setMessageEnregistrement(null);

    const prenomSaisi = prenom.trim();
    const nomSaisi = nom.trim();
    const villeSaisie = ville.trim();
    if (
      (prenomSaisi && prenomSaisi.length < 2) ||
      (nomSaisi && nomSaisi.length < 2) ||
      (utilisateur.prenom && !prenomSaisi) ||
      (utilisateur.nom && !nomSaisi)
    ) {
      setMessageEnregistrement({
        type: "erreur",
        texte: "Le prénom et le nom doivent contenir au moins 2 caractères.",
      });
      return;
    }

    const modifications: ProfilModification = {};
    if (prenomSaisi !== (utilisateur.prenom ?? "")) {
      if (prenomSaisi) modifications.prenom = prenomSaisi;
    }
    if (nomSaisi !== (utilisateur.nom ?? "")) {
      if (nomSaisi) modifications.nom = nomSaisi;
    }
    if (villeSaisie !== (utilisateur.ville ?? "")) {
      modifications.ville = villeSaisie;
    }

    if (Object.keys(modifications).length === 0) {
      setMessageEnregistrement({
        type: "succes",
        texte: "Aucune modification à enregistrer.",
      });
      return;
    }

    setEnregistrement(true);
    try {
      await modifierMonProfil(modifications);
      await rafraichirProfil();
      setMessageEnregistrement({
        type: "succes",
        texte: "Informations enregistrées.",
      });
    } catch (erreur) {
      setMessageEnregistrement({
        type: "erreur",
        texte:
          erreur instanceof ErreurAPI
            ? erreur.message_utilisateur
            : "Enregistrement impossible. Réessayez.",
      });
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionProfil
        id="informations"
        titre="Mes informations"
        Icone={IconeIdentite}
        ouverte={sectionOuverte === "informations"}
        onBasculer={() => basculerSection("informations")}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 font-semibold text-ardoise">
              <span>Prénom</span>
              <input
                value={prenom}
                onChange={(event) => setPrenom(event.target.value)}
                autoComplete="given-name"
                className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 px-4 font-normal focus:border-lagune focus:outline-none"
              />
            </label>
            <label className="space-y-2 font-semibold text-ardoise">
              <span>Nom</span>
              <input
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                autoComplete="family-name"
                className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 px-4 font-normal focus:border-lagune focus:outline-none"
              />
            </label>
            <div className="space-y-2">
              <p className="font-semibold text-ardoise">Adresse e-mail</p>
              <p className="min-h-14 break-all rounded-xl bg-sable-clair px-4 py-3 text-ardoise">
                {utilisateur.email}
              </p>
            </div>
            <label className="space-y-2 font-semibold text-ardoise">
              <span>Ville</span>
              <input
                value={ville}
                onChange={(event) => setVille(event.target.value)}
                autoComplete="address-level2"
                className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 px-4 font-normal focus:border-lagune focus:outline-none"
              />
            </label>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-sable-clair p-4">
            <div
              role="img"
              aria-label={`Photo de profil, initiales ${initiales}`}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-lagune/20 bg-lagune/10 text-2xl font-bold text-lagune"
            >
              {initiales}
            </div>
            <div>
              <p className="font-semibold text-ardoise">Photo de profil</p>
              <p className="text-sm text-ardoise-clair">
                La photo n'est pas modifiable depuis cette page.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-ardoise">Numéro WhatsApp</p>
            <CarteTelephone />
          </div>

          <div className="rounded-xl border border-ardoise-clair/15 p-4">
            <p className="text-sm font-semibold text-ocre">Mon identifiant DigiID</p>
            <p className="my-3 break-all font-mono text-2xl font-bold text-lagune">
              {identifiant}
            </p>
            <div className="flex flex-wrap gap-3">
              <Bouton variante="secondaire" onClick={onCopierIdentifiant}>
                {copie ? (
                  <>
                    <IconeCheck className="h-4 w-4" /> Copié !
                  </>
                ) : (
                  <>
                    <IconeCopier className="h-4 w-4" /> Copier mon DigiID
                  </>
                )}
              </Bouton>
              {typeof navigator?.share === "function" ? (
                <Bouton variante="primaire" onClick={onPartager}>
                  📤 Partager
                </Bouton>
              ) : (
                <Bouton variante="primaire" onClick={onCopierLien}>
                  🔗 Copier le lien
                </Bouton>
              )}
              <Link href="/profil/telecharger">
                <Bouton variante="ghost">Télécharger mon profil numérique</Bouton>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Bouton
              variante="primaire"
              onClick={() => void enregistrerInformations()}
              disabled={enregistrement}
              chargement={enregistrement}
            >
              <IconeCheck className="h-5 w-5" />
              Enregistrer
            </Bouton>
            <Badge variante={utilisateur.est_actif ? "succes" : "terre"}>
              {utilisateur.est_actif ? "Compte actif" : "Compte inactif"}
            </Badge>
          </div>
          {messageEnregistrement && (
            <p
              role={messageEnregistrement.type === "erreur" ? "alert" : "status"}
              className={
                messageEnregistrement.type === "erreur"
                  ? "font-semibold text-terre"
                  : "font-semibold text-lagune"
              }
            >
              {messageEnregistrement.texte}
            </p>
          )}
        </div>
      </SectionProfil>

      <SectionProfil
        id="identite"
        titre="Vérifier mon identité"
        Icone={IconeCheck}
        ouverte={sectionOuverte === "identite"}
        onBasculer={() => basculerSection("identite")}
      >
        <div className="space-y-3">
          <LigneVerification
            titre="E-mail"
            fait={utilisateur.est_email_verifie}
            href="/identite/email"
            action="Vérifier"
            Icone={IconeEmail}
          />
          <LigneVerification
            titre="Numéro de téléphone"
            fait={utilisateur.est_telephone_verifie === true}
            action="Modifier"
            Icone={IconeIdentite}
            onAction={() => {
              setSectionOuverte("informations");
              document
                .getElementById("profil-informations")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          />
          <LigneVerification
            titre="Pièce d'identité"
            fait={utilisateur.est_cni_verifiee === true}
            href="/inspection"
            action="Vérifier"
            Icone={IconeIdentite}
          />
          <LigneVerification
            titre="Reconnaissance faciale"
            fait={utilisateur.est_visage_verifie === true}
            href="/identite/verification-visuelle"
            action="Vérifier"
            Icone={IconeVisage}
          />
          <LigneVerification
            titre="Code de sécurité temporaire"
            fait={Boolean(utilisateur.digiid_public)}
            href="/citoyen/qr-code"
            action="Ouvrir"
            Icone={IconeCadenas}
          />
        </div>
      </SectionProfil>

      <SectionProfil
        id="notifications"
        titre="Mes notifications"
        Icone={IconeCloche}
        ouverte={sectionOuverte === "notifications"}
        onBasculer={() => basculerSection("notifications")}
      >
        <p className="mb-4 text-ardoise">
          Ces préférences ne sont pas enregistrables depuis le profil actuel.
        </p>
        <p className="mb-2 font-semibold text-ardoise">Canaux disponibles</p>
        <div className="flex flex-wrap gap-2" aria-label="Canaux disponibles">
          {["WhatsApp", "SMS", "E-mail"].map((canal) => (
            <span
              key={canal}
              className="rounded-full border border-ardoise-clair/20 bg-sable-clair px-4 py-2 font-semibold text-ardoise"
            >
              {canal}
            </span>
          ))}
        </div>
        <p className="mt-4 font-semibold text-ardoise">
          Numéro d'un proche à prévenir
        </p>
        <p className="mt-1 text-ardoise-clair">Non renseigné</p>
      </SectionProfil>

      <SectionProfil
        id="activite"
        titre="Mon activité"
        Icone={IconeColis}
        ouverte={sectionOuverte === "activite"}
        onBasculer={() => basculerSection("activite")}
      >
        <p className="mb-4 text-ardoise">
          Le mode commerçant permet d'enregistrer et de suivre les colis de votre
          activité.
        </p>
        <LienProfil
          href={
            utilisateur.mode_commercant_actif
              ? "/commercant/dashboard"
              : "/commercant/activation"
          }
          libelle={
            utilisateur.mode_commercant_actif
              ? "Ouvrir mon espace commerçant"
              : "Activer le mode commerçant"
          }
          Icone={IconeColis}
        />
      </SectionProfil>

      <SectionProfil
        id="aide"
        titre="Aide et support"
        Icone={IconeAlerte}
        ouverte={sectionOuverte === "aide"}
        onBasculer={() => basculerSection("aide")}
      >
        <LienProfil href="/aide" libelle="Ouvrir l'aide et le support" Icone={IconeAlerte} />
      </SectionProfil>

      <SectionProfil
        id="parametres"
        titre="Paramètres"
        Icone={IconeParametres}
        ouverte={sectionOuverte === "parametres"}
        onBasculer={() => basculerSection("parametres")}
      >
        <LienProfil href="/parametres" libelle="Ouvrir les paramètres" Icone={IconeParametres} />
      </SectionProfil>
    </div>
  );
}

function SectionProfil({
  id,
  titre,
  Icone,
  ouverte,
  onBasculer,
  children,
}: {
  id: SectionProfilId;
  titre: string;
  Icone: typeof IconeIdentite;
  ouverte: boolean;
  onBasculer: () => void;
  children: ReactNode;
}) {
  const identifiant = `profil-${id}`;
  return (
    <section className="overflow-hidden rounded-2xl border border-ardoise-clair/15 bg-white shadow-sm">
      <h2>
        <button
          type="button"
          aria-expanded={ouverte}
          aria-controls={`${identifiant}-contenu`}
          onClick={onBasculer}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-4 text-left text-xl font-bold text-lagune hover:bg-lagune/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagune/50"
        >
          <span className="flex items-center gap-3">
            <Icone className="h-6 w-6 shrink-0" aria-hidden="true" />
            {titre}
          </span>
          <IconeFlecheBas
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 transition-transform ${
              ouverte ? "rotate-180" : ""
            }`}
          />
        </button>
      </h2>
      <div
        id={`${identifiant}-contenu`}
        hidden={!ouverte}
        className="border-t border-ardoise-clair/10 p-5"
      >
        {children}
      </div>
    </section>
  );
}

function LigneVerification({
  titre,
  fait,
  href,
  action,
  Icone,
  onAction,
}: {
  titre: string;
  fait: boolean;
  href?: string;
  action: string;
  Icone: typeof IconeIdentite;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ardoise-clair/15 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <Icone className="h-5 w-5 shrink-0 text-lagune" aria-hidden="true" />
        <span className="font-semibold text-ardoise">{titre}</span>
      </div>
      <span
        className={`inline-flex min-h-10 items-center self-start rounded-full px-4 py-1 font-bold sm:self-auto ${
          fait ? "bg-green-100 text-green-900" : "bg-orange-100 text-orange-900"
        }`}
      >
        {fait ? "fait" : "à faire"}
      </span>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="flex min-h-14 items-center justify-center gap-3 rounded-xl border border-ardoise-clair/15 bg-white px-4 py-3 font-semibold text-lagune"
        >
          <Icone className="h-5 w-5 shrink-0" aria-hidden="true" />
          {action}
        </button>
      ) : (
        <LienProfil
          href={href ?? "/profil"}
          libelle={action}
          Icone={Icone}
        />
      )}
    </div>
  );
}

function BlocUsage({ titre, detail, statut }: {
  titre: string; detail: string; statut: "actif" | "phase-4";
}) {
  return (
    <div className="bg-sable-clair rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-lagune">{titre}</h4>
        {statut === "actif" ? (
          <Badge variante="succes">Actif</Badge>
        ) : (
          <Badge variante="ocre">À venir</Badge>
        )}
      </div>
      <p className="text-xs text-ardoise-clair">{detail}</p>
    </div>
  );
}

function LienProfil({
  href,
  libelle,
  Icone,
}: {
  href: string;
  libelle: string;
  Icone: typeof IconeIdentite;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-ardoise-clair/15 bg-white px-4 py-3 text-lg font-semibold text-lagune transition hover:border-lagune/40 hover:bg-lagune/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagune/50"
    >
      <Icone className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{libelle}</span>
    </Link>
  );
}