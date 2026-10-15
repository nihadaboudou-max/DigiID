"use client";

/**
 * Page Aide / FAQ — questions fréquentes.
 */
import { useState } from "react";
import Link from "next/link";

import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";

interface Question {
  cle: string;
  categorie: string;
  question: string;
  reponse: string;
  /** Écran où l'on fait la chose soi-même (facultatif). */
  lien?: { href: string; libelle: string };
}

/**
 * FAQ — le **pivot logistique** d'abord (colis, passagers, cars, guichet),
 * puis le compte citoyen, le score, les données et la sécurité.
 *
 * Chaque réponse décrit ce que l'application fait réellement, avec un lien
 * direct vers l'écran concerné : l'utilisateur au guichet, sur le car ou dans
 * sa boutique ne doit pas avoir à chercher.
 */
const FAQ: Question[] = [
  // ─── Pivot : colis & passagers ───
  {
    cle: "p1",
    categorie: "Colis & passagers",
    question: "Comment envoyer un colis ?",
    reponse: "Le colis s'enregistre au guichet (receveur, gérant de gare, commerçant) ou directement en route par le chauffeur. On note l'expéditeur, le destinataire, les gares et le contenu, puis un ticket avec code de suivi est remis à l'expéditeur.",
    lien: { href: "/receveur/colis/nouveau", libelle: "Enregistrer un colis" },
  },
  {
    cle: "p2",
    categorie: "Colis & passagers",
    question: "Comment suivre mon colis sans compte ?",
    reponse: "Avec le code du ticket, sur la page de suivi publique : enregistré → en route → arrivé. Elle n'affiche aucune donnée personnelle — juste l'état du colis et les gares.",
    lien: { href: "/suivi", libelle: "Suivre un envoi" },
  },
  {
    cle: "p3",
    categorie: "Colis & passagers",
    question: "Mon enfant voyage seul : comment suis-je prévenu ?",
    reponse: "Le guichet ou le chauffeur enregistre un proche de confiance. Ce proche reçoit un SMS au départ, un SMS d'approche et un SMS à l'arrivée. Le suivi familial s'enregistre depuis le guichet ou depuis le car, en scannant le code du responsable.",
    lien: { href: "/receveur/suivi-familial/nouveau", libelle: "Enregistrer un enfant" },
  },
  {
    cle: "p4",
    categorie: "Colis & passagers",
    question: "Et si le client n'a pas de compte DigiID ?",
    reponse: "Ce n'est pas un problème : le nom et le téléphone saisis à la main suffisent. Le compte DigiID sert seulement à éviter la ressaisie et les fautes de numéro (donc les SMS perdus).",
  },
  {
    cle: "p5",
    categorie: "Colis & passagers",
    question: "Pourquoi scanner le QR plutôt que taper le code ?",
    reponse: "Le scan est plus rapide et plus sûr. Le client affiche un QR dynamique valable 30 secondes : il est à usage unique, donc un code photographié par un tiers ne sert à rien. Une fois scanné, le nom et le téléphone se remplissent seuls.",
    lien: { href: "/guichet/carte", libelle: "Scanner le QR d'un client" },
  },
  {
    cle: "p6",
    categorie: "Colis & passagers",
    question: "Le QR est refusé : que faire ?",
    reponse: "Deux cas : le code a expiré (plus de 30 secondes) ou il a déjà été scanné. Demandez au client d'en générer un nouveau en rafraîchissant son écran. En dernier recours, tapez son DigiID public : le code est bon, mais c'est plus lent.",
  },
  {
    cle: "p7",
    categorie: "Colis & passagers",
    question: "Comment marquer un colis comme livré ?",
    reponse: "En scannant le code du ticket au guichet ou à l'arrivée. Un second scan du même ticket indique « déjà livré » : on ne compte pas deux fois la remise.",
    lien: { href: "/receveur/scan", libelle: "Scanner un ticket" },
  },
  {
    cle: "p8",
    categorie: "Colis & passagers",
    question: "Le destinataire n'a rien reçu : pourquoi ?",
    reponse: "Neuf fois sur dix, le téléphone a été mal recopié. Remplissez la fiche en scannant le QR du destinataire (ou de son proche) : le numéro est alors exact, et les SMS de départ et d'arrivée partent au bon endroit.",
  },

  // ─── Pivot : chauffeur & cars ───
  {
    cle: "p9",
    categorie: "Chauffeur & cars",
    question: "Comment je récupère mon car ?",
    reponse: "De deux façons : le guichet ou le gérant de gare vous l'affecte, ou — si sa plaque est au référentiel sans chauffeur — vous la déclarez vous-même et il devient le vôtre. S'il est déjà affecté à un collègue, il faut passer par le guichet.",
    lien: { href: "/chauffeur/voyages", libelle: "Mes cars" },
  },
  {
    cle: "p10",
    categorie: "Chauffeur & cars",
    question: "Puis-je conduire le car d'un collègue ?",
    reponse: "Non, et ce n'est pas seulement un affichage : le serveur refuse la planification d'un départ avec un car qui ne vous est pas affecté. Un car, un chauffeur — c'est ce qui rend le suivi crédible pour les clients.",
  },
  {
    cle: "p11",
    categorie: "Chauffeur & cars",
    question: "Comment planifier un départ ?",
    reponse: "Depuis « Mes voyages » : choisissez la ligne (trajet), votre car et l'heure. Le départ apparaît aussitôt côté guichet et côté clients sur la page des horaires.",
    lien: { href: "/chauffeur/voyages", libelle: "Planifier mes trajets" },
  },
  {
    cle: "p12",
    categorie: "Chauffeur & cars",
    question: "Comment annoncer le départ, puis l'arrivée ?",
    reponse: "Sur la fiche du voyage : « Valider le départ » fait passer d'un coup tous les passagers et colis à bord en route, et « Marquer arrivés » à la fin. Les SMS partent automatiquement aux destinataires et aux proches.",
    lien: { href: "/chauffeur/dashboard", libelle: "Mes départs du jour" },
  },
  {
    cle: "p13",
    categorie: "Chauffeur & cars",
    question: "Comment rejoindre un départ libre ?",
    reponse: "Le tableau de bord chauffeur liste les départs sans chauffeur. On les rejoint en un clic, et on peut se retirer tant que le car n'est pas parti. Si un collègue l'a pris, son nom est affiché : l'engagement est public.",
  },
  {
    cle: "p14",
    categorie: "Chauffeur & cars",
    question: "Je peux enregistrer un passager ou un colis en route ?",
    reponse: "Oui : passager monté au bord de la route ou colis confié en cours de trajet s'enregistrent depuis le car, avec le scan du code du client. Le colis apparaît aussitôt sur le manifeste du voyage.",
    lien: { href: "/chauffeur/colis/nouveau", libelle: "Enregistrer en route" },
  },
  {
    cle: "p15",
    categorie: "Chauffeur & cars",
    question: "« Ce car est déjà affecté à un autre chauffeur » : que faire ?",
    reponse: "C'est une protection, pas un bug : le car est déjà à quelqu'un. Demandez au guichet (ou au gérant de gare) de le réaffecter — c'est la seule voie, et l'opération est tracée.",
  },

  // ─── Pivot : guichet & référentiel ───
  {
    cle: "p16",
    categorie: "Guichet & référentiel",
    question: "Comment inscrire un car et le donner à un chauffeur ?",
    reponse: "Écran « Cars & chauffeurs » : plaque, marque, capacité, gare, et le chauffeur à qui il appartient — en une seule fois. On peut aussi ajouter ou retirer le chauffeur d'un car déjà inscrit, directement dans le tableau.",
    lien: { href: "/receveur/vehicules", libelle: "Cars & chauffeurs" },
  },
  {
    cle: "p17",
    categorie: "Guichet & référentiel",
    question: "Combien ai-je encaissé aujourd'hui ?",
    reponse: "La cagnotte du jour (guichet ou chauffeur) regroupe les encaissements colis et passagers. Elle se consulte à tout moment sur l'écran « Ma cagnotte ».",
    lien: { href: "/receveur/cagnotte", libelle: "Ma cagnotte" },
  },
  {
    cle: "p18",
    categorie: "Guichet & référentiel",
    question: "Un chauffeur n'apparaît pas dans la liste d'affectation",
    reponse: "Son compte doit avoir une fiche d'acteur logistique « chauffeur » (n° de permis, gare). Le super-administrateur la crée depuis Super-admin → Logistique → Acteurs. Sans elle, il ne peut ni être affecté à un car, ni rejoindre un départ.",
    lien: { href: "/super-admin/logistique", libelle: "Acteurs logistiques" },
  },
  {
    cle: "p19",
    categorie: "Guichet & référentiel",
    question: "Qui a affecté ce car ? Qui a planifié ce départ ?",
    reponse: "Tout est journalisé : enregistrement, affectation, modification et suppression d'un car, planification d'un départ, engagement d'un chauffeur. Le journal d'audit du super-administrateur indique qui, quand, et avec les valeurs avant/après.",
    lien: { href: "/super-admin/audit", libelle: "Journal d'audit" },
  },
  {
    cle: "p20",
    categorie: "Guichet & référentiel",
    question: "Comment créer les gares, les trajets et les horaires ?",
    reponse: "Le super-administrateur inscrit les gares, les lignes (gare de départ → gare d'arrivée) et les cars. Les horaires affichés au public viennent des départs planifiés.",
    lien: { href: "/super-admin/logistique", libelle: "Référentiel logistique" },
  },

  // ─── Compte citoyen ───
  {
    cle: "q1",
    categorie: "Démarrer",
    question: "Comment créer un compte DigiID ?",
    reponse: "Clique sur \"Créer un compte\" en haut à droite, remplis le formulaire avec ton prénom, nom, email et un mot de passe d'au moins 12 caractères. Tu reçois ton DigiID immédiatement, puis tu peux te connecter.",
  },
  {
    cle: "q2",
    categorie: "Démarrer",
    question: "Que se passe-t-il si je n'ai pas de smartphone ?",
    reponse: "DigiID fonctionne aussi en USSD : compose *346# depuis n'importe quel téléphone GSM. L'inscription dure 2 minutes, sans internet.",
  },
  {
    cle: "q3",
    categorie: "Score",
    question: "Comment est calculé mon score ?",
    reponse: "Quatre familles de signaux : ancienneté SIM (25%), régularité mobile money (35%), stabilité géographique (20%), réseau de contacts (20%). Le tout passe dans un algorithme combinant régression logistique (interprétable) et XGBoost (précis).",
  },
  {
    cle: "q4",
    categorie: "Score",
    question: "Pourquoi mon score est-il bas ?",
    reponse: "Un score bas n'est pas un jugement : il signifie simplement que DigiID a peu d'historique sur toi. Avec quelques mois d'utilisation régulière de tes services habituels (mobile money, téléphone), ton score augmentera naturellement.",
  },
  {
    cle: "q5",
    categorie: "Score",
    question: "À quelle fréquence le score est-il mis à jour ?",
    reponse: "Automatiquement tous les 30 jours. Tu peux aussi demander un recalcul manuel via la page \"Mon score\".",
  },
  {
    cle: "q6",
    categorie: "Données",
    question: "DigiID lit-il mes SMS ou écoute mes appels ?",
    reponse: "Non. Jamais. DigiID ne collecte que des métadonnées agrégées : volume de transactions mobile money, ancienneté de ton numéro, stabilité de ta ville. Aucun contenu personnel.",
  },
  {
    cle: "q7",
    categorie: "Données",
    question: "Mes données sont-elles vendues à des publicitaires ?",
    reponse: "Absolument pas. DigiID se finance par les vérifications d'identité demandées par les banques et fintech. Tes données ne sont jamais vendues ni partagées sans ton consentement explicite.",
  },
  {
    cle: "q8",
    categorie: "Données",
    question: "Comment supprimer définitivement mon compte ?",
    reponse: "Va dans Mes Paramètres → Zone sensible → Supprimer mon compte. Tes données seront effacées sous 30 jours maximum, conformément à la loi 2008-12.",
  },
  {
    cle: "q9",
    categorie: "Sécurité",
    question: "Comment activer la double authentification (2FA) ?",
    reponse: "Disponible en Phase 4 du prototype. À terme : Mes Paramètres → 2FA → Scanner le QR code avec Google Authenticator (ou équivalent). Pour les administrateurs, c'est obligatoire.",
  },
  {
    cle: "q10",
    categorie: "Sécurité",
    question: "Mon mot de passe est-il stocké en clair ?",
    reponse: "Jamais. DigiID utilise Argon2id, l'algorithme recommandé par l'OWASP en 2024. Même nous, nous ne pouvons pas voir ton mot de passe.",
  },
];

const CATEGORIES = [
  "Toutes",
  "Colis & passagers",
  "Chauffeur & cars",
  "Guichet & référentiel",
  "Démarrer",
  "Score",
  "Données",
  "Sécurité",
] as const;

/** Raccourcis par profil : chacun part de SON écran (pivot logistique). */
const GUIDES = [
  {
    profil: "Guichet / receveur",
    resume: "Enregistrer colis et passagers, encaisser, scanner les tickets, affecter les cars.",
    liens: [
      { href: "/receveur/colis/nouveau", libelle: "Nouveau colis" },
      { href: "/receveur/suivi-familial/nouveau", libelle: "Enfant voyageant seul" },
      { href: "/receveur/vehicules", libelle: "Cars & chauffeurs" },
      { href: "/receveur/cagnotte", libelle: "Cagnotte" },
    ],
  },
  {
    profil: "Gérant de gare",
    resume: "Tout le guichet, plus la planification des départs et le référentiel de la gare.",
    liens: [
      { href: "/receveur/dashboard", libelle: "Départs du jour" },
      { href: "/receveur/vehicules", libelle: "Référentiel roulant" },
      { href: "/logistique/profil", libelle: "Mon dossier pro" },
    ],
  },
  {
    profil: "Chauffeur",
    resume: "Mes cars, mes départs, ce qui est à bord, ma cagnotte.",
    liens: [
      { href: "/chauffeur/voyages", libelle: "Mes cars & trajets" },
      { href: "/chauffeur/dashboard", libelle: "Mon tableau de bord" },
      { href: "/chauffeur/colis/nouveau", libelle: "Enregistrer en route" },
      { href: "/chauffeur/scan", libelle: "Scanner un code" },
    ],
  },
  {
    profil: "Commerçant",
    resume: "Expédier depuis la boutique et suivre ses colis, sans conduire.",
    liens: [
      { href: "/receveur/colis/nouveau", libelle: "Expédier un colis" },
      { href: "/receveur/tickets", libelle: "Mes colis" },
      { href: "/logistique/profil", libelle: "Mon dossier pro" },
    ],
  },
  {
    profil: "Super-administrateur",
    resume: "Gares, lignes, cars, acteurs logistiques et journal d'audit.",
    liens: [
      { href: "/super-admin/logistique", libelle: "Référentiel" },
      { href: "/super-admin/audit", libelle: "Audit" },
    ],
  },
] as const;

export default function PageAide() {
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<typeof CATEGORIES[number]>("Toutes");
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());

  const filtrees = FAQ.filter((q) => {
    const matchCat = categorie === "Toutes" || q.categorie === categorie;
    const matchR =
      !recherche ||
      q.question.toLowerCase().includes(recherche.toLowerCase()) ||
      q.reponse.toLowerCase().includes(recherche.toLowerCase());
    return matchCat && matchR;
  });

  function basculer(cle: string) {
    setOuvertes((s) => {
      const n = new Set(s);
      n.has(cle) ? n.delete(cle) : n.add(cle);
      return n;
    });
  }

  return (
      <main className="flex-grow">
        <section className="bg-gradient-to-b from-sable-clair to-white py-16">
          <div className="max-w-3xl mx-auto px-6 text-center apparition">
            <p className="text-ocre font-semibold mb-3 text-sm uppercase tracking-wider">
              Centre d'aide
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-lagune">
              Questions fréquentes
            </h1>
            <p className="text-lg text-ardoise-clair mb-8">
              Du guichet au car : colis, passagers, cars, compte et données.
            </p>
            <div className="max-w-xl mx-auto">
              <ChampRecherche
                placeholder="Cherche une question..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-3xl mx-auto px-6">
            {/* Raccourcis par profil : le pivot logistique d'abord. */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold text-lagune mb-1">
                Guides express par profil
              </h2>
              <p className="text-sm text-ardoise-clair mb-4">
                Chacun part de son écran : guichet, chauffeur, commerçant, gérant de gare.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {GUIDES.map((g) => (
                  <Carte key={g.profil}>
                    <p className="font-semibold text-ardoise">{g.profil}</p>
                    <p className="mt-1 mb-3 text-xs text-ardoise-clair">{g.resume}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.liens.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="rounded-full border border-lagune/20 bg-lagune/5 px-3 py-1 text-xs font-medium text-lagune hover:bg-lagune/10"
                        >
                          {l.libelle}
                        </Link>
                      ))}
                    </div>
                  </Carte>
                ))}
              </div>
            </div>

            {/* Catégories */}
            <div className="flex flex-wrap gap-2 mb-8 justify-center">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategorie(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    categorie === c
                      ? "bg-lagune text-white"
                      : "bg-white border border-ardoise-clair/20 text-ardoise hover:bg-sable"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Questions */}
            <div className="space-y-3">
              {filtrees.length === 0 ? (
                <Carte>
                  <p className="text-center text-ardoise-clair italic py-6">
                    Aucune réponse ne correspond à ta recherche.
                  </p>
                </Carte>
              ) : (
                filtrees.map((q) => {
                  const ouvert = ouvertes.has(q.cle);
                  return (
                    <Carte key={q.cle} className="!p-0">
                      <button
                        type="button"
                        onClick={() => basculer(q.cle)}
                        className="w-full text-left p-6 hover:bg-sable-clair transition-colors rounded-2xl flex items-start justify-between gap-4"
                      >
                        <span className="font-semibold text-lagune">{q.question}</span>
                        <span className={`text-ocre flex-shrink-0 transition-transform ${ouvert ? "rotate-45" : ""}`}>
                          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </span>
                      </button>
                      {ouvert && (
                        <div className="px-6 pb-6 -mt-2 text-sm text-ardoise leading-relaxed apparition">
                          <p>{q.reponse}</p>
                          {q.lien && (
                            <Link
                              href={q.lien.href}
                              className="mt-3 inline-flex items-center gap-1 font-medium text-lagune hover:text-ocre underline underline-offset-2"
                            >
                              {q.lien.libelle}
                            </Link>
                          )}
                        </div>
                      )}
                    </Carte>
                  );
                })
              )}
            </div>

            <Carte variante="accent" className="mt-12 text-center">
              <h3 className="mb-2">Tu n'as pas trouvé ta réponse ?</h3>
              <p className="text-sm text-ardoise-clair mb-4">
                Pour l'instant, le support email arrive en Phase 6 avec le déploiement complet.
              </p>
              <Link href="/chatbot">
                <Bouton variante="primaire">Demander à l'assistant</Bouton>
              </Link>
            </Carte>
          </div>
        </section>
      </main>
  );
}
