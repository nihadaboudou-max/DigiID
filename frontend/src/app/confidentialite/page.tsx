/**
 * Politique de confidentialité — texte légal accessible publiquement.
 */
import { PiedDePage } from "@/composants/layouts/PiedDePage";

export default function PageConfidentialite() {
  return (
    <>
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
              DigiID est une plateforme numérique béninoise de gestion d'identité et de
              services logistiques. L'entité responsable du traitement sera DigiID SARL,
              immatriculée au RCCM de Cotonou (Bénin). Pour ce prototype académique, les
              coordonnées définitives du responsable et du délégué seront publiées avant
              toute mise en production.
            </p>
          </Section>

          <Section titre="2. Quelles données sont collectées ?">
            <p>Nous collectons et traitons les catégories suivantes :</p>
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li><strong>Identité et contact :</strong> nom, prénom, téléphone, email et ville.</li>
              <li><strong>Données de transport :</strong> expéditeur, destinataire, trajet, gare, véhicule, voyage, description et photo du colis.</li>
              <li><strong>Suivi logistique :</strong> scans, statuts, dates, acteurs, gare et localisation déclarée des événements.</li>
              <li><strong>Remise sécurisée :</strong> code de confirmation à 4 chiffres, durée de validité, tentatives et confirmation de remise.</li>
              <li><strong>Qualité et réclamations :</strong> avis, étoiles, litiges et décisions de traitement.</li>
              <li><strong>Sécurité :</strong> journaux techniques et journal d'audit des actions sensibles.</li>
            </ul>
          </Section>

          <Section titre="3. À quelles fins ?">
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li>Créer et sécuriser ton compte DigiID.</li>
              <li>Enregistrer, suivre et remettre les colis au bon destinataire.</li>
              <li>Notifier les étapes du transport et fournir la preuve de remise.</li>
              <li>Prévenir les erreurs, les fraudes et traiter les litiges.</li>
              <li>Améliorer la qualité du service grâce aux avis et indicateurs logistiques.</li>
              <li>Respecter le Code du numérique du Bénin et les demandes de l'APDP.</li>
            </ul>
          </Section>

          <Section titre="4. Comment sont protégées tes données ?">
            <p>
              Les données personnelles sont chiffrées au repos et en transit. Ton mot de
              passe est haché et n'est jamais stocké en clair. L'accès aux colis, profils
              professionnels, codes de remise et litiges est limité selon le rôle :
              destinataire, expéditeur, receveur, chauffeur, gérant de gare ou
              super-administrateur. Les accès sensibles et les changements de statut sont
              inscrits dans le journal d'audit.
            </p>
          </Section>

          <Section titre="5. Tes droits">
            <p>
              Conformément au Code du numérique du Bénin et aux textes applicables à la
              protection des données personnelles, tu disposes des droits suivants :
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li><strong>Accès :</strong> demander une copie de tes données.</li>
              <li><strong>Rectification :</strong> corriger une donnée inexacte.</li>
              <li><strong>Opposition :</strong> refuser certains traitements (sauf obligation légale).</li>
              <li><strong>Effacement :</strong> demander la suppression des données qui ne sont plus nécessaires, sous réserve des obligations de conservation.</li>
              <li><strong>Portabilité :</strong> récupérer les données pouvant être exportées dans un format structuré.</li>
              <li><strong>Réclamation auprès de l'APDP :</strong> saisir l'Autorité de protection des données à caractère personnel du Bénin si ta demande reste sans réponse.</li>
            </ul>
          </Section>

          <Section titre="6. Durée de conservation">
            <p>
              Les données du compte sont conservées tant que le compte est actif. Les
              données d'un colis sont conservées pendant la durée nécessaire au suivi,
              aux réclamations et à la preuve de remise. Les codes de remise sont
              invalidés après leur expiration ou leur utilisation. Les avis et litiges
              peuvent être conservés pour prévenir les abus et améliorer la qualité.
              Les journaux d'audit sont conservés pendant la durée nécessaire à la
              sécurité et aux obligations légales. Toute suppression respecte les
              obligations de preuve, comptables et réglementaires applicables au Bénin.
            </p>
          </Section>

          <Section titre="7. Délégué à la protection des données">
            <p>
              DigiID désignera un responsable de la protection des données et publiera
              son adresse de contact avant la mise en production. Les demandes relatives
              aux données personnelles pourront être adressées à ce contact ou à l'APDP.
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
            Politique fondée sur le Code du numérique du Bénin (loi n° 2017-20),
            les textes béninois applicables à la protection des données personnelles,
            les orientations de l'APDP et, à titre complémentaire, les principes de la
            Convention de Malabo.
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
