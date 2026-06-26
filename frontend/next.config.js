/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Indique à Next.js d'où viennent les images externes
  images: {
    remotePatterns: [],
  },

  // Proxy vers le backend — toutes les requêtes /api/backend/* sont
  // redirigées vers l'URL du backend définie dans les variables d'environnement.
  //
  // IMPORTANT : next.config.js est évalué au moment du BUILD (pas au runtime).
  // La variable NEXT_PUBLIC_URL_BACKEND doit donc être définie AVANT le build
  // sur Render (dans Environment → Save Changes → redéployer).
  //
  // Priorité de résolution :
  //   1. NEXT_PUBLIC_URL_BACKEND (variable Render recommandée)
  //   2. URL_BACKEND             (fallback Render)
  //   3. http://backend:8000   (développement local)
  async rewrites() {
    const backendUrl =
      process.env.URL_BACKEND ||              // ← priorité 1 (Docker interne : http://backend:8000)
      process.env.NEXT_PUBLIC_URL_BACKEND ||  // ← priorité 2 (IP publique OVH)
      "http://backend:8000";

    // Ajouter https:// si l'URL est fournie sans protocole
    // (ex: "digiid-backend-h99s.onrender.com" → "https://digiid-backend-h99s.onrender.com")
    if (
      !backendUrl.startsWith("http://") &&
      !backendUrl.startsWith("https://")
    ) {
      backendUrl = `https://${backendUrl}`;
    }

    console.log("[next.config.js] URL_BACKEND utilisée :", backendUrl);

    return [
      {
        // Toute requête frontend vers /api/backend/xxx
        // est proxifiée vers <backendUrl>/xxx
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
