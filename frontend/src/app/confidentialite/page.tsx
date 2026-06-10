/**
 * Politique de confidentialité — texte légal accessible publiquement.
 */
import { EnTete } from "@/composants/layouts/EnTete";
import { PiedDePage } from "@/composants/layouts/PiedDePage";

export default function PageConfidentialite() {
  return (
    <>
      <EnTete />
      <main className="flex-grow bg-sable-clair">
        <article className="max-w-3xl mx-auto px-6 py-12 space-y-6 text-ardoise">
          <header>
            <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
              Mentions légales
            </p>
            <h1 className="mt-1">Politique de confidentialité</h1>
            <p className="text-sm text-ardoise-clair mt-2">
              Version 1.0 · En vigueur depuis le 1<sup>er</sup> janvier 2026
            </p>
          </header>

          <Section titre="1. Qui collecte tes données ?">
            <p>
              DigiID est un prototype académique développé dans le cadre du Mémoire de fin
              d'études de Madame ABOUDOU TRAORE Nihad, en Mastère Stratégie Digitale à
              l'ISM Dakar (2025-2026). En production, l'entité juridique sera DigiID SARL,
              immatriculée au RCCM de Dakar.
            </p>
          </Section>

          <Section titre="2. Quelles données sont collectées ?">
            <p>Nous collectons et traitons les catégories suivantes :</p>
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li><strong>Données déclaratives :</strong> prénom, nom, email, ville.</li>
              <li><strong>Métadonnées SIM :</strong> opérateur, ancienneté du numéro (jamais le contenu).</li>
              <li><strong>Métadonnées mobile money :</strong> volume agrégé, régularité (jamais les destinataires individuels).</li>
              <li><strong>Géographie agrégée :</strong> ville et quartier (jamais la position GPS précise).</li>
              <li><strong>Logs techniques :</strong> adresse IP, navigateur, date de connexion (rétention 1 an pour l'audit).</li>
            </ul>
          </Section>

          <Section titre="3. À quelles fins ?">
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li>Calculer ton score de confiance DigiID.</li>
              <li>Te fournir un identifiant numérique utilisable auprès de tiers partenaires.</li>
              <li>Détecter les fraudes et tentatives d'intrusion.</li>
              <li>Respecter nos obligations légales (CDP, APDP, RGPD).</li>
            </ul>
          </Section>

          <Section titre="4. Comment sont protégées tes données ?">
            <p>
              Toutes les données personnelles sont chiffrées au repos en AES-256-GCM, et
              en transit en TLS 1.3. Ton mot de passe est haché avec Argon2id et n'est
              jamais stocké en clair. Les serveurs sont hébergés en priorité chez un
              prestataire africain (Orange Cloud Sénégal), avec un plan de reprise sur
              AWS Cape Town. L'accès aux données est journalisé immuablement et limité
              strictement aux personnes habilitées.
            </p>
          </Section>

          <Section titre="5. Tes droits">
            <p>Conformément à la loi 2008-12, tu disposes des droits suivants :</p>
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li><strong>Accès :</strong> demander une copie de tes données.</li>
              <li><strong>Rectification :</strong> corriger une donnée inexacte.</li>
              <li><strong>Opposition :</strong> refuser certains traitements (sauf obligation légale).</li>
              <li><strong>Effacement (droit à l'oubli) :</strong> demander la suppression complète sous 30 jours.</li>
              <li><strong>Portabilité :</strong> récupérer tes données dans un format structuré (JSON).</li>
              <li><strong>Réclamation auprès de la CDP :</strong> en cas de litige non résolu.</li>
            </ul>
          </Section>

          <Section titre="6. Durée de conservation">
            <p>
              Les données de profil sont conservées tant que ton compte est actif. Les logs
              d'audit sont conservés 1 an minimum. Après suppression de ton compte, toutes
              les données personnelles sont effacées sous 30 jours maximum, sauf si une
              obligation légale impose une rétention plus longue (ex : obligations
              comptables ou fiscales).
            </p>
          </Section>

          <Section titre="7. Délégué à la protection des données">
            <p>
              Conformément à l'article 33 de la loi 2008-12, un Délégué à la Protection
              des Données (DPO) est désigné. En version production, son contact sera
              accessible publiquement.
            </p>
          </Section>

          <Section titre="8. Modifications">
            <p>
              Cette politique peut évoluer. En cas de modification substantielle, tu seras
              notifié par email et au prochain login. La version en vigueur est toujours
              consultable depuis cette page.
            </p>
          </Section>

          <p className="text-xs text-ardoise-clair italic pt-8 border-t border-ardoise-clair/10">
            Politique conforme à la loi 2008-12 du Sénégal, au Code numérique du Bénin (loi 2017-20),
            à la Convention de Malabo et inspirée des principes du RGPD européen.
          </p>
        </article>
      </main>
      <PiedDePage />
    </>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="!text-2xl mb-3">{titre}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
