/**
 * Page d'accueil publique.
 * Pitch du projet + CTA inscription/connexion.
 */
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { Logo } from "@/composants/commun/Logo";
import { EnTete } from "@/composants/layouts/EnTete";
import { PiedDePage } from "@/composants/layouts/PiedDePage";

export default function PageAccueil() {
  return (
    <>
      <EnTete />

      <main className="flex-grow">
        {/* Section héros */}
        <section className="bg-gradient-to-b from-sable-clair to-white py-16 md:py-24">
          <div className="max-w-contenu mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="apparition">
              <p className="text-ocre font-semibold mb-3 text-sm uppercase tracking-wider">
                Système d'identité numérique
              </p>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-lagune">
                Ton téléphone
                <br />
                devient ton
                <br />
                <span className="text-ocre">identité.</span>
              </h1>
              <p className="text-lg text-ardoise-clair mb-8 max-w-lg leading-relaxed">
                DigiID transforme tes habitudes quotidiennes — mobile money, déplacements, contacts —
                en identifiant numérique fiable, reconnu et inclusif.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/inscription">
                  <Bouton variante="primaire" taille="grand">
                    Créer mon DigiID
                  </Bouton>
                </Link>
                <Link href="/connexion">
                  <Bouton variante="ghost" taille="grand">
                    J'ai déjà un compte
                  </Bouton>
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="carte-accent max-w-md w-full">
                <p className="text-xs uppercase text-ocre font-bold mb-2 tracking-wider">
                  Un exemple de score
                </p>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-7xl font-bold text-lagune">76</span>
                  <span className="text-2xl text-ardoise-clair">/ 100</span>
                </div>
                <p className="text-sm text-ardoise mb-4">
                  Score moyen-élevé. <strong>Amadou</strong> peut ouvrir un compte bancaire et
                  partager son identifiant à sa banque.
                </p>
                <div className="space-y-2 text-sm">
                  <FacteurScore libelle="Ancienneté SIM" valeur="+24" />
                  <FacteurScore libelle="Régularité Wave" valeur="+19" />
                  <FacteurScore libelle="Stabilité géographique" valeur="+22" />
                  <FacteurScore libelle="Réseau de contacts" valeur="+11" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section les chiffres clés */}
        <section className="py-16 bg-white">
          <div className="max-w-contenu mx-auto px-6">
            <h2 className="text-3xl font-bold mb-12 text-center">
              Le besoin en quelques chiffres
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <ChiffreCle
                gros="540 M"
                libelle="Personnes sans identité officielle"
                detail="en Afrique subsaharienne"
                source="Banque Mondiale ID4D 2022"
              />
              <ChiffreCle
                gros="1 / 3"
                libelle="Enfants non enregistrés"
                detail="à l'état civil en Afrique de l'Ouest"
                source="ANSD / INStaD 2023"
              />
              <ChiffreCle
                gros="+6 %"
                libelle="Gain de PIB potentiel"
                detail="avec une identité numérique solide"
                source="McKinsey 2019"
              />
            </div>
          </div>
        </section>

        {/* Section comment ça marche */}
        <section className="py-16 bg-sable">
          <div className="max-w-contenu mx-auto px-6">
            <h2 className="text-3xl font-bold mb-12 text-center">
              Comment ça fonctionne
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <Etape numero="1" titre="Inscription" detail="Nom, ville, photo. 2 minutes. Zéro papier." />
              <Etape numero="2" titre="Consentement" detail="Tu choisis ce que tu partages." />
              <Etape numero="3" titre="Calcul" detail="Notre algorithme produit ton score 0-100." />
              <Etape numero="4" titre="Usage" detail="Banque, microcrédit, aides. Ton DigiID ouvre les portes." />
            </div>
          </div>
        </section>
      </main>

      <PiedDePage />
    </>
  );
}

// -------- Composants internes --------

function ChiffreCle({ gros, libelle, detail, source }: {
  gros: string; libelle: string; detail: string; source: string;
}) {
  return (
    <div className="carte text-center">
      <p className="text-6xl font-bold text-ocre mb-3">{gros}</p>
      <p className="text-lagune font-semibold mb-1">{libelle}</p>
      <p className="text-sm text-ardoise-clair mb-3">{detail}</p>
      <p className="text-xs italic text-ardoise-clair/70">Source : {source}</p>
    </div>
  );
}

function Etape({ numero, titre, detail }: {
  numero: string; titre: string; detail: string;
}) {
  return (
    <div className="carte">
      <div className="w-12 h-12 bg-lagune text-ocre rounded-full flex items-center justify-center text-xl font-bold mb-4">
        {numero}
      </div>
      <h3 className="text-lagune font-semibold mb-2">{titre}</h3>
      <p className="text-sm text-ardoise-clair">{detail}</p>
    </div>
  );
}

function FacteurScore({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between items-center pb-2 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-ardoise-clair">{libelle}</span>
      <span className="font-bold text-ocre">{valeur}</span>
    </div>
  );
}
