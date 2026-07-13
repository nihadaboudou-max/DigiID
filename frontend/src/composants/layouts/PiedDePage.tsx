/**
 * Pied de page — design compact et moderne aux couleurs DigiID.
 */
import Link from "next/link";

export function PiedDePage() {
  return (
    <footer className="bg-ardoise text-white">
      {/* Bande décorative supérieure */}
      <div className="h-1 bg-gradient-to-r from-ocre via-lagune to-ocre" />

      <div className="max-w-contenu mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        {/* Colonne marque */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-lagune to-ocre rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-bold text-xl">DigiID</span>
          </div>
          <p className="text-sm text-white/70 italic leading-relaxed mb-3">
            Une identité née de la vie quotidienne.
          </p>
          <p className="text-xs text-white/50 leading-relaxed">
            Prototype académique — Mémoire M2<br />
            <span className="text-ocre font-semibold">ABOUDOU TRAORE Nihad</span><br />
            ISM Dakar 2025-2026
          </p>
        </div>

        {/* Colonne Navigation */}
        <div>
          <h4 className="font-semibold text-ocre mb-4 text-sm uppercase tracking-wider">
            Navigation
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/" className="text-white/80 hover:text-ocre transition-colors">Accueil</Link></li>
            <li><Link href="/inscription" className="text-white/80 hover:text-ocre transition-colors">Inscription</Link></li>
            <li><Link href="/connexion" className="text-white/80 hover:text-ocre transition-colors">Connexion</Link></li>
            <li><Link href="/aide" className="text-white/80 hover:text-ocre transition-colors">Centre d'aide</Link></li>
          </ul>
        </div>

        {/* Colonne Légal */}
        <div>
          <h4 className="font-semibold text-ocre mb-4 text-sm uppercase tracking-wider">
            Légal & Sécurité
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/cgu" className="text-white/80 hover:text-ocre transition-colors">Conditions d'utilisation</Link></li>
            <li><Link href="/confidentialite" className="text-white/80 hover:text-ocre transition-colors">Politique de confidentialité</Link></li>
            <li><Link href="/consentements" className="text-white/80 hover:text-ocre transition-colors">Mes consentements</Link></li>
          </ul>
        </div>

        {/* Colonne Conformité */}
        <div>
          <h4 className="font-semibold text-ocre mb-4 text-sm uppercase tracking-wider">
            Conformité
          </h4>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-succes"></span>
              Loi 2008-12 SN
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-succes"></span>
              Loi 2017-20 BJ
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-succes"></span>
              RGPD (UE) 2016/679
            </li>
          </ul>
        </div>
      </div>

      {/* Barre inférieure */}
      <div className="border-t border-white/10">
        <div className="max-w-contenu mx-auto px-6 py-4 text-xs text-white/50 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2025-2026 DigiID — Tous droits réservés.</span>
          <span className="flex items-center gap-1">
            Fait avec soin à Dakar 
            <span className="text-lg">🇸🇳</span>
          </span>
        </div>
      </div>
    </footer>
  );
}