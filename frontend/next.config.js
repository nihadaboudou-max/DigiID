/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Indique à Next.js d'où viennent les images externes
  images: {
    remotePatterns: [],
  },

  // Proxy vers le backend — /api/v1/* → backend FastAPI.
  //
  // IMPORTANT : next.config.js est évalué au moment du BUILD (pas au runtime).
  // La variable URL_BACKEND doit donc être définie AVANT le build
  // sur le VPS (dans .env du conteneur frontend).
  //
  // Priorité de résolution :
  //   1. URL_BACKEND (variable Docker : http://backend:8000)
  //   2. NEXT_PUBLIC_URL_BACKEND (fallback IP publique)
  //   3. http://backend:8000 (développement local)
  async rewrites() {
    let backendUrl =
      process.env.URL_BACKEND ||              // ← priorité 1 (Docker interne : http://backend:8000)
      process.env.NEXT_PUBLIC_URL_BACKEND ||  // ← priorité 2 (IP publique OVH)
      "http://backend:8000";

    // Ajouter https:// si l'URL est fournie sans protocole
    if (
      !backendUrl.startsWith("http://") &&
      !backendUrl.startsWith("https://")
    ) {
      backendUrl = `https://${backendUrl}`;
    }

    console.log("[next.config.js] URL_BACKEND utilisée :", backendUrl);

    return [
      {
        // Frontend : /api/v1/...  →  Backend : http://backend:8000/api/v1/...
        // Ne pas matcher /api/backend/* (évite destination cassée /api/backend/api/v1/...)
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;