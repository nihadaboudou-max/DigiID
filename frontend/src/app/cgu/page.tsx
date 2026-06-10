/**
 * Conditions générales d'utilisation — texte légal accessible publiquement.
 */
import { EnTete } from "@/composants/layouts/EnTete";
import { PiedDePage } from "@/composants/layouts/PiedDePage";

export default function PageCGU() {
  return (
    <>
      <EnTete />
      <main className="flex-grow bg-sable-clair">
        <article className="max-w-3xl mx-auto px-6 py-12 space-y-6 text-ardoise">
          <header>
            <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
              Mentions légales
            </p>
            <h1 className="mt-1">Conditions Générales d'Utilisation</h1>
            <p className="text-sm text-ardoise-clair mt-2">
              Version 1.0 · En vigueur depuis le 1<sup>er</sup> janvier 2026
            </p>
          </header>

          <Section titre="Article 1 — Objet">
            <p>
              Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'usage
              du service DigiID, système d'identité numérique conçu pour les populations
              sous-documentées d'Afrique de l'Ouest.
            </p>
          </Section>

          <Section titre="Article 2 — Acceptation">
            <p>
              L'inscription au service DigiID vaut acceptation pleine et entière des
              présentes CGU. Si tu n'acceptes pas une partie de ces conditions, tu ne dois
              pas utiliser le service.
            </p>
          </Section>

          <Section titre="Article 3 — Description du service">
            <p>
              DigiID propose un identifiant numérique de 16 caractères, calculé à partir
              des données comportementales que tu autorises à partager. Cet identifiant peut
              être utilisé pour prouver ton identité auprès de tiers partenaires (banques,
              fintech, administrations) qui en font la demande.
            </p>
          </Section>

          <Section titre="Article 4 — Tes obligations">
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li>Fournir des informations exactes lors de l'inscription.</li>
              <li>Maintenir la confidentialité de ton mot de passe.</li>
              <li>Ne pas partager ton compte avec un tiers.</li>
              <li>Signaler immédiatement toute utilisation suspecte de ton compte.</li>
              <li>Respecter les lois en vigueur dans ton pays.</li>
            </ul>
          </Section>

          <Section titre="Article 5 — Nos engagements">
            <ul className="list-disc list-inside space-y-1 text-sm pl-2">
              <li>Protéger tes données selon les meilleurs standards techniques (AES-256, Argon2id, TLS 1.3).</li>
              <li>Ne collecter que les données strictement nécessaires.</li>
              <li>Ne jamais vendre tes données à un tiers.</li>
              <li>Respecter ton droit à l'oubli sous 30 jours maximum.</li>
              <li>Maintenir une disponibilité du service supérieure à 99,5 % mensuel.</li>
            </ul>
          </Section>

          <Section titre="Article 6 — Tarification">
            <p>
              Le service de base DigiID est gratuit pour les utilisateurs. Un service
              premium optionnel pourra être proposé à terme à un tarif symbolique
              (autour de 1 000 FCFA par mois). Les tiers partenaires (banques, fintech)
              paient pour chaque vérification d'identité qu'ils effectuent.
            </p>
          </Section>

          <Section titre="Article 7 — Suspension et résiliation">
            <p>
              Tu peux supprimer ton compte à tout moment via la page « Mes Paramètres ».
              Nous nous réservons le droit de suspendre un compte en cas de violation
              manifeste des présentes CGU, après notification préalable lorsque possible.
            </p>
          </Section>

          <Section titre="Article 8 — Limitation de responsabilité">
            <p>
              DigiID met en œuvre les meilleurs efforts pour assurer la sécurité et la
              disponibilité du service. Toutefois, en tant que prototype académique, le
              service est fourni « en l'état », sans garantie de résultat. Notre
              responsabilité est limitée aux dommages directs et prévisibles.
            </p>
          </Section>

          <Section titre="Article 9 — Droit applicable">
            <p>
              Les présentes CGU sont soumises au droit sénégalais. En cas de litige,
              les parties chercheront d'abord une résolution amiable. À défaut, les
              tribunaux compétents de Dakar seront seuls compétents.
            </p>
          </Section>

          <Section titre="Article 10 — Contact et réclamations">
            <p>
              Pour toute question, suggestion ou réclamation relative aux présentes CGU,
              tu peux contacter notre Délégué à la Protection des Données (DPO) — adresse
              de contact rendue disponible en version production.
            </p>
            <p>
              En cas de litige non résolu, tu peux saisir la Commission de Protection
              des Données Personnelles (CDP) du Sénégal ou son équivalent dans ton pays.
            </p>
          </Section>

          <p className="text-xs text-ardoise-clair italic pt-8 border-t border-ardoise-clair/10">
            Conditions conformes à la loi 2008-12 du Sénégal, au Code numérique du Bénin
            (loi 2017-20), à la Convention de Malabo et inspirées des principes du RGPD européen.
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
