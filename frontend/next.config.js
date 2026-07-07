/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Indique à Next.js d'où viennent les images externes
  images: {
    remotePatterns: [],
  },

  // Proxy vers le backend — toutes les requêtes /api/* sont
  // redirigées vers l'URL du backend définie dans les variables d'environnement.
  //
  // IMPORTANT : next.config.js est évalué au moment du BUILD (pas au runtime).
  // La variable URL_BACKEND doit donc être définée AVANT le build
  // sur le VPS OVH (dans .env du conteneur frontend).
  //
  // Priorité de résolution :
  //   1. URL_BACKEND (variable Docker : http://backend:8000)
  //   2. NEXT_PUBLIC_URL_BACKEND (fallback IP publique)
  //   3. http://backend:8000 (développement local)
  async rewrites() {
    const backendUrl =
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
        // ✅ CORRECTION : Ajouter /api dans la destination
        // Frontend : /api/v1/invitations/...
        // Backend  : http://backend:8000/api/v1/invitations/...
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;