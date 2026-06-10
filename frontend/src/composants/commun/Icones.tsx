/**
 * Icônes SVG inline DigiID — aucune dépendance externe.
 * Chaque icône est un composant React qui accepte className.
 */
import type { SVGProps } from "react";

const proprietesDefaut: SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

export const IconeAccueil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M3 12L12 3l9 9" />
    <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
  </svg>
);

export const IconeUtilisateur = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const IconeScore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export const IconeChat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

export const IconePartage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

export const IconeParametres = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

export const IconeDeconnexion = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const IconeBouclier = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const IconeStatistique = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export const IconeAlerte = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconeJournal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const IconeEnvoyer = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const IconeCopier = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

export const IconeCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const IconeFlecheRetour = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const IconeVisage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 00-16 0" />
    <circle cx="8" cy="11" r="1" />
    <circle cx="16" cy="11" r="1" />
    <path d="M9 15h6" />
  </svg>
);

export const IconeCle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15L19 4M16 7l3 3M14 8l3 3" />
  </svg>
);

export const IconeLangue = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

export const IconeIdentite = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="12" cy="11" r="3.5" />
    <path d="M7 19v-2a4 4 0 014-4h2a4 4 0 014 4v2" />
  </svg>
);

export const IconeEmail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="22,4 12,13 2,4" />
  </svg>
);

export const IconeCadenas = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M9 11V7a3 3 0 016 0v4" />
  </svg>
);

export const IconeScan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <path d="M3 7V5a2 2 0 012-2h2" />
    <path d="M17 3h2a2 2 0 012 2v2" />
    <path d="M21 17v2a2 2 0 01-2 2h-2" />
    <path d="M7 21H5a2 2 0 01-2-2v-2" />
    <rect x="7" y="9" width="10" height="6" rx="1" />
  </svg>
);

export const IconeFlecheBas = (p: SVGProps<SVGSVGElement>) => (
  <svg {...proprietesDefaut} {...p}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
