/**
 * Contenus de l'aide — **une page par profil**.
 *
 * Principe : chacun n'a que SON aide. Le guichet ne lit pas les questions du
 * super-administrateur, le chauffeur ne lit pas celles de la police, et le
 * citoyen ne voit que son QR, ses envois et son score. Chaque réponse tient en
 * deux phrases et propose, quand c'est utile, l'écran où l'on fait la chose.
 *
 * `profilDepuisRole()` fait la correspondance rôle serveur → contenu d'aide.
 */
export type ProfilAide =
  | "visiteur"
  | "citoyen"
  | "receveur"
  | "gerant_gare"
  | "chauffeur"
  | "commercant"
  | "police"
  | "medical"
  | "ong"
  | "enrolement"
  | "admin"
  | "super_admin";

export interface LienAide {
  href: string;
  libelle: string;
}

export interface QuestionAide {
  question: string;
  reponse: string;
  /** Écran où faire la chose soi-même. */
  lien?: LienAide;
}

export interface ContenuAide {
  titre: string;
  resume: string;
  actions: LienAide[];
  questions: QuestionAide[];
}

/** Libellé court du profil (sélecteur d'aperçu). */
export const LIBELLES_PROFIL: Record<ProfilAide, string> = {
  visiteur: "Sans compte",
  citoyen: "Citoyen",
  receveur: "Guichet (receveur)",
  gerant_gare: "Gérant de gare",
  chauffeur: "Chauffeur",
  commercant: "Commerçant",
  police: "Police",
  medical: "Médical",
  ong: "ONG",
  enrolement: "Agent terrain",
  admin: "Administration",
  super_admin: "Super-administration",
};

// ─── Questions partagées ─────────────────────────────────────────────

/** Socle « guichet » : colis, passagers, scan, encaissement. */
const QUESTIONS_GUICHET: QuestionAide[] = [
  {
    question: "Comment enregistrer un colis ?",
    reponse:
      "Étape 1 l'expéditeur (nom + téléphone), étape 2 le destinataire, puis les gares, le contenu et les frais. À la fin, un ticket avec code de suivi est remis à l'expéditeur.",
    lien: { href: "/receveur/colis/nouveau", libelle: "Enregistrer un colis" },
  },
  {
    question: "Pourquoi scanner le QR du client au lieu de taper son code ?",
    reponse:
      "Le client affiche un QR dynamique valable 30 secondes, à usage unique : nom et téléphone se remplissent tout seuls, sans faute de frappe — donc les SMS partent au bon numéro. La saisie manuelle reste possible, mais elle est plus lente.",
    lien: { href: "/guichet/carte", libelle: "Scanner la carte du client" },
  },
  {
    question: "Le QR est refusé, que faire ?",
    reponse:
      "Il a expiré (plus de 30 secondes) ou il a déjà servi : demandez au client de rafraîchir son écran pour obtenir un nouveau code. En dernier recours, saisissez son DigiID public.",
  },
  {
    question: "Et si le client n'a pas de compte DigiID ?",
    reponse:
      "Ce n'est pas un problème : tapez simplement son nom et son téléphone. Le compte sert seulement à éviter la ressaisie.",
  },
  {
    question: "Mon enfant voyage seul, comment prévenir la famille ?",
    reponse:
      "Enregistrez un proche de confiance : il reçoit un SMS au départ, un SMS d'approche et un SMS à l'arrivée.",
    lien: {
      href: "/receveur/suivi-familial/nouveau",
      libelle: "Enregistrer un enfant",
    },
  },
  {
    question: "Comment marquer un colis comme livré ?",
    reponse:
      "Scannez le code du ticket à la remise : le colis passe en « livré ». Un second scan affiche « déjà livré » — la remise n'est pas comptée deux fois.",
    lien: { href: "/receveur/scan", libelle: "Scanner un ticket" },
  },
  {
    question: "Combien ai-je encaissé aujourd'hui ?",
    reponse:
      "La cagnotte du jour regroupe vos recettes colis et passagers, consultable à tout moment.",
    lien: { href: "/receveur/cagnotte", libelle: "Ma cagnotte" },
  },
  {
    question: "Comment inscrire un car et le confier à un chauffeur ?",
    reponse:
      "Écran « Cars & chauffeurs » : plaque, marque, capacité, gare et le chauffeur à qui le car appartient — en une seule fois. Un car n'a qu'un chauffeur.",
    lien: { href: "/receveur/vehicules", libelle: "Cars & chauffeurs" },
  },
];

/** Socle « chauffeur » : cars, départs, ce qui est à bord. */
const QUESTIONS_CHAUFFEUR: QuestionAide[] = [
  {
    question: "Comment récupérer mon car ?",
    reponse:
      "Le guichet ou le gérant de gare vous l'affecte. Si la plaque est au référentiel sans chauffeur, vous pouvez aussi la déclarer vous-même : le car devient le vôtre.",
    lien: { href: "/chauffeur/voyages", libelle: "Mes cars & trajets" },
  },
  {
    question: "Puis-je conduire le car d'un collègue ?",
    reponse:
      "Non : l'application refuse de planifier un départ avec le car d'un autre chauffeur. Demandez la réaffectation au guichet ou au gérant de gare.",
  },
  {
    question: "Comment planifier un départ ?",
    reponse:
      "Choisissez la ligne, votre car et l'heure : le départ apparaît aussitôt côté guichet et sur les horaires publics.",
    lien: { href: "/chauffeur/voyages", libelle: "Planifier mes trajets" },
  },
  {
    question: "Comment valider le départ, puis l'arrivée ?",
    reponse:
      "Sur la fiche du voyage : « Valider le départ » met en route tous les passagers et colis à bord ; « Marquer arrivés » à la fin. Les SMS partent automatiquement.",
    lien: { href: "/chauffeur/dashboard", libelle: "Mes départs du jour" },
  },
  {
    question: "Comment rejoindre un départ libre ?",
    reponse:
      "Le tableau de bord liste les départs sans chauffeur : vous les rejoignez en un clic et pouvez vous retirer tant que le car n'est pas parti.",
    lien: { href: "/chauffeur/dashboard", libelle: "Mes départs du jour" },
  },
  {
    question: "Comment enregistrer un client en route ?",
    reponse:
      "Passager monté au bord de la route ou colis confié en cours de trajet : enregistrez-le depuis le car, avec le scan du code du client.",
    lien: { href: "/chauffeur/colis/nouveau", libelle: "Enregistrer en route" },
  },
  {
    question: "Où voir tout ce que je transporte ?",
    reponse:
      "Dans « Mes colis » et « Mes passagers » : codes, gares et contacts masqués. La liste suit votre voyage.",
    lien: { href: "/chauffeur/colis", libelle: "Mes colis" },
  },
  {
    question: "Combien ai-je encaissé aujourd'hui ?",
    reponse:
      "Votre cagnotte du jour rassemble les encaissements des colis et passagers enregistrés avec vous.",
    lien: { href: "/chauffeur/cagnotte", libelle: "Ma cagnotte" },
  },
];

// ─── Contenus par profil ─────────────────────────────────────────────

export const CONTENUS_AIDE: Record<ProfilAide, ContenuAide> = {
  visiteur: {
    titre: "Aide DigiID",
    resume:
      "Envoyer un colis, suivre un envoi, prévenir la famille : tout est là, sans compte.",
    actions: [
      { href: "/suivi", libelle: "Suivre un envoi" },
      { href: "/inscription", libelle: "Créer un compte" },
      { href: "/horaires", libelle: "Horaires des départs" },
      { href: "/connexion", libelle: "Se connecter" },
    ],
    questions: [
      {
        question: "Comment envoyer un colis ?",
        reponse:
          "Au guichet de la gare (ou directement au chauffeur) : on note votre nom, votre téléphone, ceux du destinataire et les gares. Vous repartez avec un ticket portant un code de suivi.",
      },
      {
        question: "Comment suivre mon colis ?",
        reponse:
          "Avec le code du ticket, sur la page de suivi : enregistré → en route → arrivé. Aucun compte n'est nécessaire.",
        lien: { href: "/suivi", libelle: "Suivre un envoi" },
      },
      {
        question: "Mon enfant voyage seul, comment être prévenu ?",
        reponse:
          "Au guichet, un proche de confiance est enregistré : il reçoit un SMS au départ, un SMS d'approche et un SMS à l'arrivée.",
      },
      {
        question: "Faut-il obligatoirement créer un compte ?",
        reponse:
          "Non. Le compte sert à aller plus vite et à retrouver vos envois ; sinon, votre nom et votre téléphone suffisent.",
      },
      {
        question: "Je n'ai pas de smartphone.",
        reponse:
          "DigiID fonctionne en USSD depuis n'importe quel téléphone : composez *346#. Pas besoin d'internet.",
      },
      {
        question: "Qui voit mes informations ?",
        reponse:
          "Le suivi public n'affiche que l'état du colis et les gares, jamais votre nom ni votre téléphone. Vos données ne sont ni vendues ni partagées sans votre accord.",
      },
    ],
  },

  citoyen: {
    titre: "Aide — votre compte DigiID",
    resume: "Votre QR, votre carte, vos envois et votre score.",
    actions: [
      { href: "/citoyen/qr-code", libelle: "Mon QR dynamique" },
      { href: "/identite/carte", libelle: "Ma carte DigiID" },
      { href: "/suivi", libelle: "Suivre un envoi" },
      { href: "/score", libelle: "Mon score" },
    ],
    questions: [
      {
        question: "À quoi sert mon QR dynamique ?",
        reponse:
          "C'est votre code de 30 secondes, à usage unique, affiché dans « Mon DigiID ». Le guichet ou le chauffeur le scanne : votre nom et votre téléphone se remplissent tout seuls. Un code photographié par quelqu'un ne sert à rien.",
        lien: { href: "/citoyen/qr-code", libelle: "Afficher mon QR" },
      },
      {
        question: "Mon code est refusé : que faire ?",
        reponse:
          "Il a expiré ou il a déjà servi : rafraîchissez l'écran pour en obtenir un nouveau. Si besoin, vous pouvez donner votre DigiID public (12 caractères) pour une saisie manuelle.",
      },
      {
        question: "Où retrouver mes colis et mes voyages ?",
        reponse:
          "Votre tableau de bord liste vos envois et vos billets, avec leur état.",
        lien: { href: "/citoyen/dashboard", libelle: "Mon tableau de bord" },
      },
      {
        question: "Comment suivre un envoi fait par un proche ?",
        reponse:
          "Avec le code de son ticket, sur la page de suivi. Vous ne voyez que l'état du colis, pas ses informations personnelles.",
        lien: { href: "/suivi", libelle: "Suivre un envoi" },
      },
      {
        question: "Comment mon enfant est-il suivi pendant le voyage ?",
        reponse:
          "Le proche de confiance enregistré au guichet reçoit un SMS au départ, un à l'approche et un à l'arrivée.",
      },
      {
        question: "Comment améliorer mon score ?",
        reponse:
          "Un score bas veut dire « peu d'historique ». Il monte avec une utilisation régulière et honnête de vos services habituels : les pistes concrètes sont listées dans votre espace score.",
        lien: { href: "/score/amelioration", libelle: "Améliorer mon score" },
      },
      {
        question: "Comment protéger mon compte ?",
        reponse:
          "Activez la double authentification : enfin, choisissez un mot de passe long et unique. Votre mot de passe n'est jamais stocké en clair.",
        lien: { href: "/parametres/2fa", libelle: "Activer la 2FA" },
      },
      {
        question: "Comment supprimer mon compte ?",
        reponse:
          "Dans Paramètres → Zone sensible → Supprimer mon compte. Vos données sont effacées sous 30 jours.",
        lien: { href: "/parametres", libelle: "Mes paramètres" },
      },
    ],
  },

  receveur: {
    titre: "Aide — Guichet (receveur)",
    resume: "Enregistrer les colis et passagers, encaisser, scanner les tickets.",
    actions: [
      { href: "/receveur/colis/nouveau", libelle: "Nouveau colis" },
      { href: "/guichet/carte", libelle: "Scanner la carte d'un client" },
      { href: "/receveur/scan", libelle: "Scanner / livrer" },
      { href: "/receveur/suivi-familial/nouveau", libelle: "Enfant voyageant seul" },
      { href: "/receveur/cagnotte", libelle: "Ma cagnotte" },
    ],
    questions: QUESTIONS_GUICHET,
  },

  gerant_gare: {
    titre: "Aide — Gérant de gare",
    resume:
      "Le guichet au complet, plus la planification des départs et le référentiel de votre gare.",
    actions: [
      { href: "/receveur/dashboard", libelle: "Départs du jour" },
      { href: "/receveur/vehicules", libelle: "Cars & chauffeurs" },
      { href: "/receveur/colis/nouveau", libelle: "Nouveau colis" },
      { href: "/receveur/suivi-familial/nouveau", libelle: "Enfant voyageant seul" },
      { href: "/logistique/profil", libelle: "Mon dossier pro" },
    ],
    questions: [
      ...QUESTIONS_GUICHET,
      {
        question: "Comment préparer les départs de la journée ?",
        reponse:
          "Les départs sont planifiés par les chauffeurs et s'affichent sur votre tableau de bord ; vous y voyez ce qui est prêt à partir et ce qui manque encore.",
        lien: { href: "/receveur/dashboard", libelle: "Départs du jour" },
      },
      {
        question: "Comment vérifier les cars et les chauffeurs de ma gare ?",
        reponse:
          "Tous les cars de la gare sont sur « Cars & chauffeurs », avec leur chauffeur. C'est là qu'on affecte ou retire un chauffeur.",
        lien: { href: "/receveur/vehicules", libelle: "Cars & chauffeurs" },
      },
      {
        question: "Qui peut voir qui a modifié un car ou un départ ?",
        reponse:
          "Ces opérations sont horodatées dans le journal d'audit, consultable par le super-administrateur. Vous pouvez donc faire corriger une affectation en toute confiance.",
      },
    ],
  },

  chauffeur: {
    titre: "Aide — Chauffeur",
    resume: "Mes cars, mes départs, ce qui est à bord, ma cagnotte.",
    actions: [
      { href: "/chauffeur/dashboard", libelle: "Mon tableau de bord" },
      { href: "/chauffeur/voyages", libelle: "Mes cars & trajets" },
      { href: "/chauffeur/colis/nouveau", libelle: "Enregistrer en route" },
      { href: "/chauffeur/scan", libelle: "Scanner / livrer" },
      { href: "/chauffeur/cagnotte", libelle: "Ma cagnotte" },
    ],
    questions: [
      ...QUESTIONS_CHAUFFEUR,
      {
        question: "Le QR d'un client est refusé : que faire ?",
        reponse:
          "Demandez-lui de rafraîchir son écran : le code de 30 secondes est à usage unique. S'il n'y arrive pas, saisissez son nom et son téléphone à la main.",
      },
    ],
  },

  commercant: {
    titre: "Aide — Commerçant",
    resume: "Expédier les colis de vos clients et suivre vos envois.",
    actions: [
      { href: "/receveur/colis/nouveau", libelle: "Expédier un colis" },
      { href: "/receveur/tickets", libelle: "Mes colis" },
      { href: "/receveur/cagnotte", libelle: "Ma cagnotte" },
      { href: "/logistique/profil", libelle: "Mon dossier pro" },
    ],
    questions: [
      {
        question: "Comment expédier un colis depuis ma boutique ?",
        reponse:
          "Enregistrez-le comme au guichet : nom et téléphone de votre client, ceux du destinataire, les gares et le contenu. Le ticket avec code de suivi est remis à votre client.",
        lien: { href: "/receveur/colis/nouveau", libelle: "Expédier un colis" },
      },
      {
        question: "Comment aller plus vite à la saisie ?",
        reponse:
          "Faites scanner le QR dynamique de votre client (30 secondes, usage unique) : son nom et son téléphone se remplissent sans faute de frappe.",
      },
      {
        question: "Où suivre mes envois ?",
        reponse:
          "Dans « Mes colis » : chaque envoi avec son code, son état et sa gare d'arrivée.",
        lien: { href: "/receveur/tickets", libelle: "Mes colis" },
      },
      {
        question: "Un client dit que son colis n'est pas arrivé.",
        reponse:
          "Demandez-lui son code de suivi : l'état réel (en route / arrivé / livré) est visible sur la page de suivi. S'il est bloqué, contactez la gare d'arrivée avec le code.",
        lien: { href: "/suivi", libelle: "Vérifier un envoi" },
      },
      {
        question: "À quoi sert mon dossier professionnel ?",
        reponse:
          "Il rassemble votre pièce d'identité et votre rattachement : c'est ce qui donne accès aux écrans d'enregistrement.",
        lien: { href: "/logistique/profil", libelle: "Mon dossier pro" },
      },
      {
        question: "Combien ai-je encaissé aujourd'hui ?",
        reponse: "Votre cagnotte du jour regroupe vos recettes d'envois.",
        lien: { href: "/receveur/cagnotte", libelle: "Ma cagnotte" },
      },
    ],
  },

  police: {
    titre: "Aide — Police",
    resume: "Contrôler une identité, comparer une photo, signaler un fait.",
    actions: [
      { href: "/police/scan-qr", libelle: "Scanner un QR" },
      { href: "/police/recherche", libelle: "Rechercher" },
      { href: "/police/comparaison-photos", libelle: "Comparer des photos" },
      { href: "/police/signalement", libelle: "Signaler un fait" },
    ],
    questions: [
      {
        question: "Comment contrôler l'identité d'une personne ?",
        reponse:
          "Faites afficher son QR dynamique et scannez-le : il ne vaut que 30 secondes et une seule fois, donc il ne peut pas être prêté ni rejoué. Puis contrôlez les pièces (CNI, permis, assurance) sur la fiche.",
        lien: { href: "/police/scan-qr", libelle: "Scanner un QR" },
      },
      {
        question: "Le QR est expiré ou déjà scanné.",
        reponse:
          "Demandez à la personne d'en générer un nouveau : un code utilisé est refusé par le système, c'est une sécurité. Une capture d'écran ne fonctionnera pas non plus.",
      },
      {
        question: "Comment vérifier que la personne est bien celle de la carte ?",
        reponse:
          "Utilisez la comparaison de photos entre la pièce présentée et le visage, et consultez l'historique des vérifications sur la fiche.",
        lien: {
          href: "/police/comparaison-photos",
          libelle: "Comparer des photos",
        },
      },
      {
        question: "Comment signaler un incident ?",
        reponse:
          "Rédigez un signalement : il est horodaté et rattaché à votre compte.",
        lien: { href: "/police/signalement", libelle: "Signaler un fait" },
      },
      {
        question: "Où retrouver mes notes et mes contrôles ?",
        reponse:
          "Vos notes et votre historique de contrôles sont conservés dans votre espace.",
        lien: { href: "/police/notes", libelle: "Mes notes" },
      },
      {
        question: "Chef d'équipe : comment suivre mon unité ?",
        reponse:
          "Le tableau de bord chef de police donne l'activité de l'équipe, et l'audit conserve chaque contrôle effectué.",
        lien: { href: "/chef-police/audit", libelle: "Audit de l'équipe" },
      },
    ],
  },

  medical: {
    titre: "Aide — Médical",
    resume: "Dossiers, ordonnances, attestations.",
    actions: [
      { href: "/medecin/dashboard", libelle: "Tableau de bord" },
      { href: "/medecin/nouveau-dossier", libelle: "Nouveau dossier" },
      { href: "/medecin/ordonnances", libelle: "Ordonnances" },
      { href: "/medecin/attestations", libelle: "Attestations" },
    ],
    questions: [
      {
        question: "Comment ouvrir un dossier patient ?",
        reponse:
          "Depuis « Nouveau dossier » : identité du patient et motif de consultation. Le dossier reste rattaché à votre compte soignant.",
        lien: { href: "/medecin/nouveau-dossier", libelle: "Nouveau dossier" },
      },
      {
        question: "Comment émettre une ordonnance ?",
        reponse:
          "Dans « Ordonnances », rattachez l'ordonnance au dossier du patient : elle est datée et archivée.",
        lien: { href: "/medecin/ordonnances", libelle: "Ordonnances" },
      },
      {
        question: "Comment délivrer une attestation ?",
        reponse:
          "Depuis « Attestations » : choisissez le patient et le type d'attestation. Le document est horodaté.",
        lien: { href: "/medecin/attestations", libelle: "Attestations" },
      },
      {
        question: "Comment retrouver un dossier sans son numéro ?",
        reponse:
          "La recherche par photo permet de retrouver un dossier à partir du visage, quand le patient n'a pas ses papiers.",
        lien: { href: "/medecin/recherche-photo", libelle: "Recherche par photo" },
      },
      {
        question: "Où voir mes actes passés ?",
        reponse: "L'historique liste vos consultations et documents émis.",
        lien: { href: "/medecin/historique", libelle: "Mon historique" },
      },
      {
        question: "Chef de service : comment suivre l'équipe ?",
        reponse:
          "Le tableau de bord chef médical donne l'activité des soignants, l'audit et les rapports.",
        lien: { href: "/chef-medical", libelle: "Tableau de bord chef" },
      },
    ],
  },

  ong: {
    titre: "Aide — ONG",
    resume: "Bénéficiaires, missions, attestations, programme.",
    actions: [
      { href: "/ong/dashboard", libelle: "Tableau de bord" },
      { href: "/ong/beneficiaires", libelle: "Bénéficiaires" },
      { href: "/ong/missions", libelle: "Missions" },
      { href: "/ong/attestations", libelle: "Attestations" },
    ],
    questions: [
      {
        question: "Comment enregistrer un bénéficiaire ?",
        reponse:
          "Depuis « Bénéficiaires » : identité et informations utiles au suivi du programme.",
        lien: { href: "/ong/beneficiaires", libelle: "Bénéficiaires" },
      },
      {
        question: "Comment suivre une mission de terrain ?",
        reponse:
          "Les missions listent les actions menées avec leur avancement et l'agent responsable.",
        lien: { href: "/ong/missions", libelle: "Missions" },
      },
      {
        question: "Comment remettre une attestation à un bénéficiaire ?",
        reponse:
          "Générez-la dans « Attestations » : elle est enregistrée et peut être remise ou envoyée.",
        lien: { href: "/ong/attestations", libelle: "Attestations" },
      },
      {
        question: "Où est décrit mon programme ?",
        reponse:
          "Le programme rassemble son objet, sa zone et ses objectifs, pour que toute l'équipe travaille sur la même base.",
        lien: { href: "/ong/programme", libelle: "Mon programme" },
      },
      {
        question: "Coordinateur : comment gérer l'équipe ?",
        reponse:
          "Le tableau de bord chef ONG suit les agents, les rapports et les statistiques de votre organisation.",
        lien: { href: "/chef-ong", libelle: "Tableau de bord coordinateur" },
      },
    ],
  },

  enrolement: {
    titre: "Aide — Agent terrain",
    resume: "Enrôler, prendre la photo, scanner les codes.",
    actions: [
      { href: "/agent/dashboard", libelle: "Tableau de bord" },
      { href: "/agent/enrolement", libelle: "Enrôler une personne" },
      { href: "/agent/capture", libelle: "Capture photo" },
      { href: "/agent/scan", libelle: "Scanner un code" },
    ],
    questions: [
      {
        question: "Comment enrôler une personne ?",
        reponse:
          "Depuis « Enrôler » : renseignez l'identité, puis prenez la photo. Un dossier est créé et rattaché à votre activité.",
        lien: { href: "/agent/enrolement", libelle: "Enrôler" },
      },
      {
        question: "La photo ne passe pas.",
        reponse:
          "Reprenez la capture en évitant le contre-jour et en cadrant le visage. Une photo nette accélère la validation du dossier.",
        lien: { href: "/agent/capture", libelle: "Capture photo" },
      },
      {
        question: "Comment contrôler un code présenté par un citoyen ?",
        reponse:
          "Scannez son QR dynamique (30 secondes, usage unique) : la fiche s'affiche pour vérification.",
        lien: { href: "/agent/scan", libelle: "Scanner un code" },
      },
      {
        question: "Chef d'équipe : comment suivre mes agents ?",
        reponse:
          "Le tableau de bord chef d'enrôlement montre l'activité de l'équipe et vos rapports.",
        lien: { href: "/chef-enrolement/equipe", libelle: "Mon équipe" },
      },
    ],
  },

  admin: {
    titre: "Aide — Administration",
    resume: "Comptes, chefs, droits, attestations, audit de votre périmètre.",
    actions: [
      { href: "/admin/tableau-de-bord", libelle: "Tableau de bord" },
      { href: "/admin/utilisateurs", libelle: "Utilisateurs" },
      { href: "/admin/invitations", libelle: "Invitations" },
      { href: "/admin/audit", libelle: "Journal d'audit" },
    ],
    questions: [
      {
        question: "Comment gérer un compte utilisateur ?",
        reponse:
          "Vous pouvez consulter, corriger et désactiver un compte depuis « Utilisateurs », sans jamais accéder à ses documents personnels.",
        lien: { href: "/admin/utilisateurs", libelle: "Utilisateurs" },
      },
      {
        question: "Comment inviter un chef de service ?",
        reponse:
          "Créez une invitation depuis « Invitations » : la personne reçoit un lien et choisit elle-même son mot de passe.",
        lien: { href: "/admin/invitations", libelle: "Invitations" },
      },
      {
        question: "Comment agir sur les droits et les attestations ?",
        reponse:
          "Les droits d'accès se règlent dans « Droits » ; les attestations communautaires se valident dans l'écran dédié.",
        lien: { href: "/admin/droits", libelle: "Droits" },
      },
      {
        question: "Comment savoir qui a fait une action ?",
        reponse:
          "Le journal d'audit conserve les actions sensibles, avec l'auteur, la date et les valeurs modifiées.",
        lien: { href: "/admin/audit", libelle: "Journal d'audit" },
      },
      {
        question: "Où voir les alertes et la santé du service ?",
        reponse:
          "« Alertes » et « Monitoring » signalent les anomalies : à consulter chaque jour.",
        lien: { href: "/admin/alertes", libelle: "Alertes" },
      },
      {
        question: "Je suis administrateur de domaine : que puis-je faire ?",
        reponse:
          "Votre périmètre est votre domaine : équipes, départements, invitations, statistiques et audit de ce domaine uniquement.",
        lien: { href: "/admin-domaine/tableau-de-bord", libelle: "Mon domaine" },
      },
    ],
  },

  super_admin: {
    titre: "Aide — Super-administration",
    resume:
      "Référentiel logistique, comptes administrateurs, droits UI, audit, configuration.",
    actions: [
      { href: "/super-admin/logistique", libelle: "Référentiel logistique" },
      { href: "/super-admin/administrateurs", libelle: "Administrateurs" },
      { href: "/super-admin/droits-ui", libelle: "Droits UI" },
      { href: "/super-admin/audit", libelle: "Journal d'audit" },
      { href: "/super-admin/configuration", libelle: "Configuration" },
    ],
    questions: [
      {
        question: "Comment créer les gares, les trajets et les cars ?",
        reponse:
          "Dans le référentiel logistique : gares, lignes (départ → arrivée), cars avec leur plaque et leur capacité, puis les acteurs (chauffeurs, receveurs, commerçants).",
        lien: { href: "/super-admin/logistique", libelle: "Référentiel" },
      },
      {
        question: "Un chauffeur n'apparaît pas dans les listes d'affectation.",
        reponse:
          "Il lui manque une fiche d'acteur logistique (n° de permis et gare). Créez-la dans Logistique → Acteurs : il devient affectable et pourra rejoindre des départs.",
        lien: { href: "/super-admin/logistique", libelle: "Acteurs logistiques" },
      },
      {
        question: "Qui a modifié ce car ou ce départ ?",
        reponse:
          "Le journal d'audit enregistre chaque création, affectation, modification et suppression, avec l'auteur et les valeurs avant/après.",
        lien: { href: "/super-admin/audit", libelle: "Journal d'audit" },
      },
      {
        question: "Comment masquer ou réafficher un menu pour un rôle ?",
        reponse:
          "« Droits UI » pilote l'affichage des menus par rôle, sans toucher aux autorisations serveur.",
        lien: { href: "/super-admin/droits-ui", libelle: "Droits UI" },
      },
      {
        question: "Comment suivre la plateforme ?",
        reponse:
          "Monitoring, statistiques et activités (police, médical, ONG, enrôlement) donnent l'état réel du service.",
        lien: { href: "/super-admin/monitoring", libelle: "Monitoring" },
      },
      {
        question: "Comment nommer un administrateur ?",
        reponse:
          "Créez le compte dans « Administrateurs », puis ajustez ses droits. Chaque session est traçable.",
        lien: { href: "/super-admin/administrateurs", libelle: "Administrateurs" },
      },
    ],
  },
};

/**
 * Rôle serveur → contenu d'aide. Un rôle inconnu (ou un visiteur) obtient
 * l'aide publique : envoyer, suivre, créer un compte.
 */
export function profilDepuisRole(role?: string | null): ProfilAide {
  switch (role) {
    case "citoyen":
      return "citoyen";
    case "receveur":
      return "receveur";
    case "gerant_gare":
      return "gerant_gare";
    case "chauffeur":
      return "chauffeur";
    case "commercant":
      return "commercant";
    case "agent_police":
    case "chef_police":
      return "police";
    case "agent_medical":
    case "chef_medical":
    case "agent_medical_chef":
      return "medical";
    case "agent_ong":
    case "chef_ong":
      return "ong";
    case "agent_terrain":
    case "chef_agent":
      return "enrolement";
    case "admin_domaine":
    case "administrateur":
      return "admin";
    case "super_admin":
    case "super_administrateur":
      return "super_admin";
    default:
      return "visiteur";
  }
}
