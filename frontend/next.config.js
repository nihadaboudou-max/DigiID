/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Indique à Next.js d'où viennent les images
  images: {
    remotePatterns: [],
  },
  // Le backend tourne sur le port 8000 en local
  async rewrites() {
    let backendUrl =
      process.env.NEXT_PUBLIC_URL_BACKEND ||
      process.env.URL_BACKEND ||
      "http://localhost:8000";

    // Render injecte URL_BACKEND sans protocole (ex: "digiid-backend.onrender.com")
    // Ajouter https:// si nécessaire
    if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
      backendUrl = `https://${backendUrl}`;
    }

    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
