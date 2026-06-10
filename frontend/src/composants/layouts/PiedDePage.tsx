/**
 * Pied de page — design actualisé aux couleurs DigiID.
 * Fond Lagune avec une touche décorative Ocre pour les titres.
 */
import Link from "next/link";
import { Logo } from "@/composants/commun/Logo";

export function PiedDePage() {
  return (
    <footer className="bg-lagune text-white mt-16">
      {/* Bande décorative supérieure */}
      <div className="h-1 bg-gradient-to-r from-ocre via-ocre/80 to-ocre/40" />

      <div className="max-w-contenu mx-auto px-6 py-10 grid md:grid-cols-4 gap-8">
        {/* Colonne marque */}
        <div className="md:col-span-1">
          <Logo variante="monochrome-blanc" taille="petit" />
          <p className="text-sm text-white/70 mt-3 italic leading-relaxed">
            Une identité née de la vie quotidienne.
          </p>
          <p className="text-xs text-white/50 mt-4 leading-relaxed">
            Prototype académique — Mémoire M2<br />
            <span className="text-ocre/80">ABOUDOU TRAORE Nihad</span><br />
            ISM Dakar 2025-2026
          </p>
        </div>

        {/* Colonne Le projet */}
        <div>
          <h4 className="font-semibold text-ocre mb-4 text-sm uppercase tracking-wider">
            Le projet
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/" className="text-white/80 hover:text-ocre transition-colors duration-200">Accueil</Link></li>
            <li><Link href="/aide" className="text-white/80 hover:text-ocre transition-colors duration-200">Centre d'aide</Link></li>
            <li><Link href="/chatbot" className="text-white/80 hover:text-ocre transition-colors duration-200">Assistant DigiID</Link></li>
          </ul>
        </div>

        {/* Colonne Sécurité */}
        <div>
          <h4 className="font-semibold text-ocre mb-4 text-sm uppercase tracking-wider">
            Sécurité & confidentialité
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/cgu" className="text-white/80 hover:text-ocre transition-colors duration-200">Conditions d'utilisation</Link></li>
            <li><Link href="/confidentialite" className="text-white/80 hover:text-ocre transition-colors duration-200">Politique de confidentialité</Link></li>
            <li><Link href="/consentements" className="text-white/80 hover:text-ocre transition-colors duration-200">Mes consentements</Link></li>
          </ul>
        </div>

        {/* Colonne Contact */}
        <div>
          <h4 className="font-semibold text-ocre mb-4 text-sm uppercase tracking-wider">
            Conformité
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li className="text-white/70">Loi 2008-12 SN</li>
            <li className="text-white/70">Loi 2017-20 BJ</li>
            <li className="text-white/70">RGPD (UE) 2016/679</li>
          </ul>
        </div>
      </div>

      {/* Barre inférieure */}
      <div className="border-t border-white/10">
        <div className="max-w-contenu mx-auto px-6 py-4 text-xs text-white/50 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2025-2026 DigiID — Tous droits réservés.</span>
          <span className="text-white/40">Fait avec soin à Dakar 🇸🇳</span>
        </div>
      </div>
    </footer>
  );
}
