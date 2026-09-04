/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ CRUCIAL POUR DOCKER : Génère une version "standalone" ultra-légère
  // Cela réduit drastiquement la taille de l'image Docker (de ~1.5 Go à ~300 Mo)
  // et résout l'erreur "no space left on device" lors de l'exportation.
  output: 'standalone',

  reactStrictMode: true,

  // Configuration des images externes
  images: {
    remotePatterns: [
      // Décommente et adapte ces lignes si ton frontend affiche des images 
      // provenant de. ton backend ou d'un CDN (ex: photos de profil, documents)
      // {
      //   protocol: 'https',
      //   hostname: 'dynamiqueid.digital',
      //   pathname: '/**',
      // },
    ],
  },

  // Proxy vers le backend — /api/v1/* → backend FastAPI.
  async rewrites() {
    // 1. Récupérer l'URL du backend (priorité à la variable Docker, puis fallback)
    let backendUrl =
      process.env.URL_BACKEND ||              // Priorité 1 : Variable interne Docker (http://backend:8000)
      process.env.NEXT_PUBLIC_URL_BACKEND ||  // Priorité 2 : URL publique (ex: https://dynamiqueid.digital)
      "http://backend:8000";                  // Priorité 3 : Fallback développement local

    // 2. CORRECTION CRUCIALE : Supprimer le slash final s'il existe.
    // Cela évite d'avoir une destination du type : "https://mon-domaine.com//api/v1/..."
    backendUrl = backendUrl.replace(/\/$/, "");

    // 3. S'assurer que le protocole est bien présent
    if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
      backendUrl = `https://${backendUrl}`;
    }

    console.log("[next.config.js] URL_BACKEND utilisée pour le rewrite :", backendUrl);

    return [
      {
        // Intercepte toutes les requêtes frontend vers /api/v1/...
        source: "/api/v1/:path*",
        // Les redirige proprement vers le backend
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;