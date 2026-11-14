"use client";

import { Bouton } from "@/composants/commun/Bouton";

export function PaginationListe({
  page,
  total,
  parPage,
  chargement = false,
  surChangement,
}: {
  page: number;
  total: number;
  parPage: number;
  chargement?: boolean;
  surChangement: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / parPage));

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-center gap-3"
    >
      <Bouton
        variante="ghost"
        taille="petit"
        disabled={chargement || page <= 1}
        onClick={() => surChangement(page - 1)}
      >
        Précédent
      </Bouton>
      <span className="text-sm text-ardoise-clair" aria-live="polite">
        Page {page} sur {pages}
      </span>
      <Bouton
        variante="ghost"
        taille="petit"
        disabled={chargement || page >= pages}
        onClick={() => surChangement(page + 1)}
      >
        Suivant
      </Bouton>
    </nav>
  );
}
