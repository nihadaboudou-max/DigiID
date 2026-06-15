"use client";

/**
 * Barre de navigation secondaire pour les activités (admin/super admin).
 * Sous-menus : Agent, Médecin, Police, ONG
 */
import Link from "next/link";
import clsx from "clsx";

interface Props {
  active: "enrolements" | "medical" | "police" | "ong";
  prefixe?: string;
}

const PROFILS = [
  { id: "enrolements", label: "Agent terrain", icone: "👤" },
  { id: "medical", label: "Médical", icone: "🏥" },
  { id: "police", label: "Police", icone: "👮" },
  { id: "ong", label: "ONG", icone: "🤝" },
];

export function NavigationActivites({ active, prefixe = "/admin/activites" }: Props) {
  return (
    <nav className="flex flex-wrap gap-2 pb-2 border-b border-ardoise-clair/10">
      {PROFILS.map((p) => (
        <Link
          key={p.id}
          href={`${prefixe}/${p.id}`}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            active === p.id
              ? "bg-lagune text-white shadow-sm"
              : "bg-sable text-ardoise-clair hover:bg-sable/80 hover:text-ardoise",
          )}
        >
          <span>{p.icone}</span>
          <span>{p.label}</span>
        </Link>
      ))}
    </nav>
  );
}
