/**
 * Page d'accueil publique DigiID.
 * Version finale : sécurité biométrique + confiance communautaire + cas d'usage réels.
 */
import Link from "next/link";
import { Bouton } from "@/composants/commun/Bouton";
import { PiedDePage } from "@/composants/layouts/PiedDePage";

export default function PageAccueil() {
  return (
    <main className="flex-grow">
      {/* ─── SECTION HÉROS ─── */}
      <section className="bg-sable-clair py-12 md:py-20 px-6">
        <div className="max-w-contenu mx-auto grid md:grid-cols-2 gap-10 items-center">
          
          <div className="space-y-6 text-center md:text-left apparition">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ocre/10 text-ocre text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-ocre animate-pulse" />
              Identité numérique souveraine
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-ardoise">
              Ton identité <br />
              <span className="text-lagune">vérifiée</span>, <br />
              ta confiance <span className="text-ocre">communautaire</span>.
            </h1>
            
            <p className="text-lg text-ardoise-clair max-w-lg mx-auto md:mx-0 leading-relaxed">
              DigiID combine <strong className="text-ardoise">vérification biométrique</strong> (CNI + reconnaissance faciale) et <strong className="text-ardoise">attestations humaines</strong> pour créer un identifiant numérique fiable, reconnu par les hôpitaux, la police et les services essentiels.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/inscription">
                <Bouton variante="primaire" taille="grand" className="w-full sm:w-auto">
                  Créer mon DigiID
                </Bouton>
              </Link>
              <Link href="/connexion">
                <Bouton variante="ghost" taille="grand" className="w-full sm:w-auto text-ardoise border-ardoise-clair/30">
                  J'ai déjà un compte
                </Bouton>
              </Link>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-4 text-xs text-ardoise-clair pt-2">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-succes" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                CNI vérifiée
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-succes" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Biométrie faciale
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-succes" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Données chiffrées
              </span>
            </div>
          </div>

          {/* Carte Score Communautaire */}
          <div className="flex justify-center md:justify-end">
            <div className="relative w-full max-w-sm">
              <div className="relative bg-white border border-ardoise-clair/10 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs font-bold text-ocre uppercase tracking-widest">DigiID Score</p>
                    <p className="text-sm text-ardoise-clair">Confiance vérifiée</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-lagune/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-lagune" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-6xl font-black text-ardoise">76</span>
                  <span className="text-xl font-semibold text-ardoise-clair">/ 100</span>
                </div>

                <div className="space-y-3">
                  <BarreScore label="CNI vérifiée" valeur={100} couleur="bg-succes" />
                  <BarreScore label="Visage biométrique" valeur={95} couleur="bg-lagune" />
                  <BarreScore label="Attestations (3)" valeur={72} couleur="bg-ocre" />
                  <BarreScore label="Réseau de confiance" valeur={65} couleur="bg-terre" />
                </div>

                <div className="mt-6 pt-4 border-t border-ardoise-clair/10">
                  <p className="text-xs text-ardoise-clair mb-2">Attestations récentes</p>
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-lagune/20 border-2 border-white flex items-center justify-center text-xs font-bold text-lagune">M</div>
                    <div className="w-8 h-8 rounded-full bg-ocre/20 border-2 border-white flex items-center justify-center text-xs font-bold text-ocre">K</div>
                    <div className="w-8 h-8 rounded-full bg-succes/20 border-2 border-white flex items-center justify-center text-xs font-bold text-succes">A</div>
                  </div>
                  <p className="text-xs text-ardoise-clair mt-2">3 personnes attestent connaître Amadou</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION CAS D'USAGE ─── */}
      <section className="py-16 bg-white border-y border-ardoise-clair/10">
        <div className="max-w-contenu mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ardoise mb-4">Un identifiant, mille usages</h2>
            <p className="text-ardoise-clair max-w-2xl mx-auto">DigiID te suit partout : à l'hôpital, au commissariat, sur le terrain ou à la banque.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <CasUsage 
              icone={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
              titre="Santé d'urgence"
              detail="En cas d'accident, le médecin accède instantanément à ton groupe sanguin, tes allergies et tes contacts d'urgence via ton QR code."
              couleur="text-succes"
              bgCouleur="bg-succes/10"
            />
            <CasUsage 
              icone={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
              titre="Police & Sécurité"
              detail="QR code dynamique anti-fraude. Les forces de l'ordre vérifient ton identité en temps réel, sans contact physique."
              couleur="text-terre"
              bgCouleur="bg-terre/10"
            />
            <CasUsage 
              icone={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              titre="ONG & Humanitaire"
              detail="Les ONG identifient rapidement leurs bénéficiaires sur le terrain, même sans papiers, grâce aux attestations communautaires."
              couleur="text-ocre"
              bgCouleur="bg-ocre/10"
            />
            <CasUsage 
              icone={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
              titre="Services financiers"
              detail="Ouvre un compte bancaire, obtiens un microcrédit ou accède aux aides sociales avec ton DigiID reconnu."
              couleur="text-lagune"
              bgCouleur="bg-lagune/10"
            />
          </div>
        </div>
      </section>

      {/* ── SECTION COMMENT ÇA MARCHE ─── */}
      <section className="py-16 bg-sable px-6">
        <div className="max-w-contenu mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ardoise mb-4">Comment obtenir ton DigiID</h2>
            <p className="text-ardoise-clair max-w-2xl mx-auto">Un processus sécurisé en 4 étapes, conçu pour l'inclusion et la protection de tes données.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Etape numero="01" titre="Inscription" detail="Ton numéro, ta ville et ta photo. Tes données sont chiffrées immédiatement." />
            <Etape numero="02" titre="Vérification CNI" detail="Scanne ta Carte Nationale d'Identité. Notre OCR extrait et vérifie les informations." />
            <Etape numero="03" titre="Biométrie faciale" detail="Reconnaissance faciale pour garantir que tu es bien la personne sur la CNI." />
            <Etape numero="04" titre="Attestations" detail="Ton réseau de confiance (proches, collègues) atteste te connaître. Ton score grimpe." />
          </div>
        </div>
      </section>

      {/* ─── SECTION CONFIANCE COMMUNAUTAIRE ─── */}
      <section className="py-16 bg-white px-6">
        <div className="max-w-contenu mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-ocre text-xs uppercase font-semibold tracking-wider mb-2">Notre innovation</p>
            <h2 className="text-3xl font-bold text-ardoise mb-4">La confiance humaine, numérisée</h2>
            <p className="text-ardoise-clair mb-6 leading-relaxed">
              Contrairement aux systèmes classiques basés uniquement sur des documents, DigiID intègre le <strong className="text-ardoise">réseau social réel</strong> de chaque utilisateur.
            </p>
            <div className="space-y-4">
              <PointFort 
                titre="Attestations pair-à-pair" 
                detail="Des personnes qui te connaissent réellement certifient ton identité, ta moralité ou tes compétences."
              />
              <PointFort 
                titre="Score de confiance transparent" 
                detail="Tu vois exactement pourquoi tu as tel score et comment l'améliorer. Pas d'algorithme opaque."
              />
              <PointFort 
                titre="Protection contre l'usurpation" 
                detail="Un criminel ne peut pas s'inscrire sous une fausse identité : il lui faudrait complice + CNI + visage + attestations."
              />
            </div>
          </div>

          <div className="bg-sable-clair rounded-2xl p-8 border border-ardoise-clair/10">
            <h3 className="font-bold text-ardoise mb-4">Exemple concret</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-lagune/20 flex items-center justify-center text-lagune font-bold text-sm flex-shrink-0">A</div>
                <div>
                  <p className="text-sm font-semibold text-ardoise">Amadou demande une attestation</p>
                  <p className="text-xs text-ardoise-clair">"Je confirme connaître Moussa depuis 5 ans, c'est un voisin de confiance."</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ocre/20 flex items-center justify-center text-ocre font-bold text-sm flex-shrink-0">M</div>
                <div>
                  <p className="text-sm font-semibold text-ardoise">Moussa atteste pour Aminata</p>
                  <p className="text-xs text-ardoise-clair">"Aminata est ma collègue depuis 3 ans, je certifie ses compétences."</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-succes/20 flex items-center justify-center text-succes font-bold text-sm flex-shrink-0">+</div>
                <div>
                  <p className="text-sm font-semibold text-ardoise">Le score de chacun augmente</p>
                  <p className="text-xs text-ardoise-clair">Chaque attestation vérifiée renforce la crédibilité du réseau.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION CTA FINALE ─── */}
      <section className="py-16 px-6 bg-ardoise text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à reprendre le contrôle de ton identité ?</h2>
          <p className="text-lg text-ardoise-clair mb-8">Rejoins les milliers d'utilisateurs qui utilisent déjà DigiID pour simplifier leurs démarches et protéger leur identité.</p>
          <Link href="/inscription">
            <Bouton variante="primaire" taille="grand" className="bg-ocre text-ardoise hover:bg-ocre/90 border-none font-bold">
              Obtenir mon DigiID gratuitement
            </Bouton>
          </Link>
        </div>
      </section>

      <PiedDePage />
    </main>
  );
}

// -------- Composants internes --------

function BarreScore({ label, valeur, couleur }: { label: string; valeur: number; couleur: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ardoise-clair font-medium">{label}</span>
        <span className="font-bold text-ardoise">{valeur}%</span>
      </div>
      <div className="w-full h-2 bg-sable rounded-full overflow-hidden">
        <div className={`h-full ${couleur} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${valeur}%` }} />
      </div>
    </div>
  );
}

function CasUsage({ icone, titre, detail, couleur, bgCouleur }: { 
  icone: React.ReactNode; 
  titre: string; 
  detail: string; 
  couleur: string;
  bgCouleur: string;
}) {
  return (
    <div className="group p-6 rounded-2xl bg-sable-clair border border-ardoise-clair/10 hover:border-lagune/30 transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl ${bgCouleur} ${couleur} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        {icone}
      </div>
      <h3 className="text-lg font-bold text-ardoise mb-2">{titre}</h3>
      <p className="text-sm text-ardoise-clair leading-relaxed">{detail}</p>
    </div>
  );
}

function Etape({ numero, titre, detail }: { numero: string; titre: string; detail: string }) {
  return (
    <div className="relative flex flex-col items-center text-center group">
      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-lagune/20 text-lagune flex items-center justify-center text-xl font-black mb-4 shadow-sm group-hover:border-ocre group-hover:text-ocre transition-colors">
        {numero}
      </div>
      <h3 className="text-lg font-bold text-ardoise mb-2">{titre}</h3>
      <p className="text-sm text-ardoise-clair leading-relaxed">{detail}</p>
    </div>
  );
}

function PointFort({ titre, detail }: { titre: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-succes/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-succes" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
      </div>
      <div>
        <h4 className="font-semibold text-ardoise text-sm mb-1">{titre}</h4>
        <p className="text-sm text-ardoise-clair">{detail}</p>
      </div>
    </div>
  );
}