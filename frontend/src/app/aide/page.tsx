"use client";

/**
 * Page Aide / FAQ — questions fréquentes.
 */
import { useState } from "react";
import Link from "next/link";

import { EnTete } from "@/composants/layouts/EnTete";
import { PiedDePage } from "@/composants/layouts/PiedDePage";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";

interface Question {
  cle: string;
  categorie: string;
  question: string;
  reponse: string;
}

const FAQ: Question[] = [
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

const CATEGORIES = ["Toutes", "Démarrer", "Score", "Données", "Sécurité"] as const;

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
    <>
      <EnTete />
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
              Une réponse claire pour chaque question sur DigiID.
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
                          {q.reponse}
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
      <PiedDePage />
    </>
  );
}
