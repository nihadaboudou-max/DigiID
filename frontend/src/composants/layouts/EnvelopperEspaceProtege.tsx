"use client";
/**
 * Enveloppe de protection — vérifie l'authentification et le rôle.
 * NE rend PLUS de layout/sidebar (géré par /super-admin/layout.tsx).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthentification } from "@/contextes/authentification";
import { Alerte } from "@/composants/commun/Alerte";

interface Proprietes {
  rolesAutorises: string[];
  children: React.ReactNode;
}

export function EnvelopperEspaceProtege({ rolesAutorises, children }: Proprietes) {
  const { utilisateur, estConnecte, chargement } = useAuthentification();
  const router = useRouter();

  useEffect(() => {
    if (!chargement && !estConnecte) {
      router.push("/connexion");
    }
  }, [chargement, estConnecte, router]);

  if (chargement) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-ardoise-clair italic">Chargement...</p>
      </div>
    );
  }

  if (!estConnecte || !utilisateur) {
    return null;
  }

  // Vérification du rôle
  if (!rolesAutorises.includes(utilisateur.role)) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <Alerte variante="erreur" titre="Accès refusé">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          Rôle requis : {rolesAutorises.join(", ")}
        </Alerte>
      </div>
    );
  }

  // Rend uniquement le contenu (pas de layout/sidebar)
  return <>{children}</>;
}